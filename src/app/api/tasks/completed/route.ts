import { NextResponse } from "next/server";
import { getSessionUser, isDatabaseConfigured } from "@/lib/auth-session-prisma";
import { prisma } from "@/lib/prisma";

const MAX_TASK_KEYS = 500;
const MAX_KEY_LENGTH = 256;

class CorruptTaskKeysError extends Error {
  constructor() {
    super("corrupt completedTaskKeys");
    this.name = "CorruptTaskKeysError";
  }
}

function parseKeys(raw: string): string[] {
  if (!raw || raw.trim() === "") return [];
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    throw new CorruptTaskKeysError();
  }
  if (!Array.isArray(parsed)) {
    throw new CorruptTaskKeysError();
  }
  return parsed.filter((k): k is string => typeof k === "string");
}

function sanitizeKeys(keys: string[]): string[] {
  const unique = Array.from(
    new Set(
      keys
        .map((k) => (typeof k === "string" ? k.trim() : ""))
        .filter((k) => k.length > 0 && k.length <= MAX_KEY_LENGTH),
    ),
  );
  return unique.slice(0, MAX_TASK_KEYS);
}

function corruptResponse() {
  console.error("[tasks/completed] corrupt completedTaskKeys in database");
  return NextResponse.json(
    { error: "Повреждены данные выполненных задач. Обратитесь к администратору." },
    { status: 500 },
  );
}

export async function GET() {
  if (!isDatabaseConfigured()) return NextResponse.json({ error: "DB not configured" }, { status: 503 });
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  try {
    const keys = parseKeys(user.completedTaskKeys);
    return NextResponse.json({ keys });
  } catch (e) {
    if (e instanceof CorruptTaskKeysError) return corruptResponse();
    throw e;
  }
}

export async function PUT(req: Request) {
  if (!isDatabaseConfigured()) return NextResponse.json({ error: "DB not configured" }, { status: 503 });
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const body = (await req.json()) as { keys?: unknown };
  const keys = Array.isArray(body.keys) ? body.keys.filter((k): k is string => typeof k === "string") : [];
  const unique = sanitizeKeys(keys);
  await prisma.user.update({
    where: { id: user.id },
    data: { completedTaskKeys: JSON.stringify(unique) },
  });
  return NextResponse.json({ ok: true, keys: unique });
}

/** Атомарное добавление/удаление ключей без гонки полной перезаписи массива. */
export async function PATCH(req: Request) {
  if (!isDatabaseConfigured()) return NextResponse.json({ error: "DB not configured" }, { status: 503 });
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const body = (await req.json()) as { add?: unknown; remove?: unknown };
  const add = Array.isArray(body.add)
    ? body.add.filter((k): k is string => typeof k === "string" && k.trim().length > 0)
    : [];
  const remove = Array.isArray(body.remove)
    ? body.remove.filter((k): k is string => typeof k === "string" && k.trim().length > 0)
    : [];
  let existing: string[];
  try {
    existing = parseKeys(user.completedTaskKeys);
  } catch (e) {
    if (e instanceof CorruptTaskKeysError) return corruptResponse();
    throw e;
  }
  const removeSet = new Set(remove);
  const next = existing.filter((k) => !removeSet.has(k));
  for (const k of add) {
    if (!next.includes(k)) next.push(k);
  }
  const unique = sanitizeKeys(next);
  await prisma.user.update({
    where: { id: user.id },
    data: { completedTaskKeys: JSON.stringify(unique) },
  });
  return NextResponse.json({ ok: true, keys: unique });
}
