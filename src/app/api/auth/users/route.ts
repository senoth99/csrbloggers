import { NextResponse } from "next/server";
import { hashLoginPassword } from "@/lib/auth-password";
import { getSessionUser, isDatabaseConfigured } from "@/lib/auth-session-prisma";
import { normalizeUsername, SUPERADMIN_LOGIN } from "@/lib/panel-auth-utils";
import { prisma } from "@/lib/prisma";

export async function POST(request: Request) {
  if (!isDatabaseConfigured()) {
    return NextResponse.json({ error: "Не задан DATABASE_URL." }, { status: 503 });
  }

  const actor = await getSessionUser();
  if (!actor || actor.role !== "superadmin" || normalizeUsername(actor.login) !== SUPERADMIN_LOGIN) {
    return NextResponse.json({ error: "Недостаточно прав." }, { status: 403 });
  }

  let body: {
    login?: string;
    password?: string;
    role?: "admin" | "user";
    employeeId?: string;
  };
  try {
    body = (await request.json()) as typeof body;
  } catch {
    return NextResponse.json({ error: "Некорректный JSON." }, { status: 400 });
  }

  const loginNorm = normalizeUsername(body.login ?? "");
  if (!loginNorm || loginNorm === SUPERADMIN_LOGIN || !body.password?.trim()) {
    return NextResponse.json({ error: "Некорректные данные." }, { status: 400 });
  }

  const exists = await prisma.user.findUnique({ where: { login: loginNorm } });
  if (exists) {
    return NextResponse.json({ error: "Такой логин уже занят." }, { status: 409 });
  }

  const role = body.role === "admin" ? "admin" : "user";
  const passwordHash = await hashLoginPassword(loginNorm, body.password);

  await prisma.user.create({
    data: {
      login: loginNorm,
      passwordHash,
      role,
      ...(body.employeeId?.trim() ? { employeeId: body.employeeId.trim() } : {}),
    },
  });

  return NextResponse.json({ ok: true });
}

export async function DELETE(request: Request) {
  if (!isDatabaseConfigured()) {
    return NextResponse.json({ error: "Не задан DATABASE_URL." }, { status: 503 });
  }

  const actor = await getSessionUser();
  if (!actor || actor.role !== "superadmin" || normalizeUsername(actor.login) !== SUPERADMIN_LOGIN) {
    return NextResponse.json({ error: "Недостаточно прав." }, { status: 403 });
  }

  const url = new URL(request.url);
  const raw = url.searchParams.get("login")?.trim() ?? "";
  const loginNorm = normalizeUsername(raw);
  if (!loginNorm || loginNorm === SUPERADMIN_LOGIN) {
    return NextResponse.json({ error: "Некорректный логин." }, { status: 400 });
  }

  await prisma.user.deleteMany({ where: { login: loginNorm } });
  return NextResponse.json({ ok: true });
}
