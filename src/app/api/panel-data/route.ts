import { NextResponse } from "next/server";
import { getSessionUser, isDatabaseConfigured } from "@/lib/auth-session-prisma";
import { coercePanelStoredShape, validatePanelStoredShape } from "@/lib/panel-stored-shape";
import { prisma } from "@/lib/prisma";

const MAX_JSON_BYTES = 12 * 1024 * 1024;

/**
 * Product policy: any authenticated panel user receives the full CRM snapshot.
 * There is no per-employee or per-role filtering on read — scope is enforced on
 * write (PUT requires admin/superadmin) and in UI where applicable.
 */
export async function GET() {
  if (!isDatabaseConfigured()) {
    return NextResponse.json({ error: "Не задан DATABASE_URL." }, { status: 503 });
  }

  const user = await getSessionUser();
  if (!user) {
    return NextResponse.json({ error: "Требуется вход." }, { status: 401 });
  }

  const row = await prisma.panelSnapshot.findUnique({ where: { id: 1 } });
  if (!row) {
    return NextResponse.json({ revision: 0, data: null }, { status: 200 });
  }
  return NextResponse.json({ revision: row.revision, data: row.data }, { status: 200 });
}

export async function PUT(request: Request) {
  if (!isDatabaseConfigured()) {
    return NextResponse.json({ error: "Не задан DATABASE_URL." }, { status: 503 });
  }

  const user = await getSessionUser();
  if (!user) {
    return NextResponse.json({ error: "Требуется вход." }, { status: 401 });
  }
  if (user.role !== "admin" && user.role !== "superadmin") {
    return NextResponse.json({ error: "Недостаточно прав." }, { status: 403 });
  }

  const rawText = await request.text();
  if (rawText.length > MAX_JSON_BYTES) {
    return NextResponse.json({ error: "Слишком большой объём данных." }, { status: 413 });
  }

  let body: unknown;
  try {
    body = rawText ? (JSON.parse(rawText) as unknown) : null;
  } catch {
    return NextResponse.json({ error: "Некорректный JSON." }, { status: 400 });
  }

  if (!body || typeof body !== "object") {
    return NextResponse.json({ error: "Ожидается объект с данными панели." }, { status: 400 });
  }

  const coerced = coercePanelStoredShape(body);
  if (!coerced) {
    return NextResponse.json(
      { error: "Некорректная структура данных панели." },
      { status: 400 },
    );
  }

  const validationError = validatePanelStoredShape(coerced);
  if (validationError) {
    return NextResponse.json(
      { error: `Некорректные данные панели: ${validationError}` },
      { status: 400 },
    );
  }

  const revRaw = request.headers.get("x-panel-base-revision")?.trim();
  const baseRevision =
    revRaw === undefined || revRaw === "" ? 0 : Number.parseInt(revRaw, 10);
  if (!Number.isFinite(baseRevision) || baseRevision < 0) {
    return NextResponse.json({ error: "Некорректный заголовок X-Panel-Base-Revision." }, { status: 400 });
  }

  try {
    const result = await prisma.$transaction(async (tx) => {
      const cur = await tx.panelSnapshot.findUnique({ where: { id: 1 } });
      if (!cur) {
        if (baseRevision !== 0) {
          return { ok: "conflict" as const, revision: 0, data: null };
        }
        const created = await tx.panelSnapshot.create({
          data: { id: 1, data: coerced as object, revision: 1 },
        });
        return { ok: "saved" as const, revision: created.revision };
      }
      if (cur.revision !== baseRevision) {
        return { ok: "conflict" as const, revision: cur.revision, data: cur.data };
      }
      const updated = await tx.panelSnapshot.update({
        where: { id: 1 },
        data: { data: coerced as object, revision: cur.revision + 1 },
      });
      return { ok: "saved" as const, revision: updated.revision };
    });

    if (result.ok === "conflict") {
      return NextResponse.json(
        {
          error: "Конфликт ревизий: на сервере уже есть более новая версия.",
          revision: result.revision,
          data: result.data,
        },
        { status: 409 },
      );
    }

    return NextResponse.json({ revision: result.revision }, { status: 200 });
  } catch (e) {
    console.error("[panel-data] save failed", e);
    return NextResponse.json({ error: "Не удалось сохранить данные." }, { status: 500 });
  }
}
