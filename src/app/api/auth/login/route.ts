import { NextResponse } from "next/server";
import { hashLoginPassword } from "@/lib/auth-password";
import { prisma } from "@/lib/prisma";
import { normalizeUsername } from "@/lib/panel-auth-utils";
import {
  SESSION_COOKIE_NAME,
  SESSION_MAX_AGE_SEC,
  signSession,
  getSessionSecret,
  requestIsHttps,
} from "@/lib/panel-session-server";
import { isDatabaseConfigured } from "@/lib/auth-session-prisma";

export async function POST(request: Request) {
  if (!isDatabaseConfigured()) {
    return NextResponse.json({ error: "Не задан DATABASE_URL." }, { status: 503 });
  }
  if (!getSessionSecret()) {
    return NextResponse.json({ error: "Не задан SESSION_SECRET." }, { status: 503 });
  }

  let body: { login?: string; password?: string };
  try {
    body = (await request.json()) as { login?: string; password?: string };
  } catch {
    return NextResponse.json({ error: "Некорректный JSON." }, { status: 400 });
  }

  const loginNorm = normalizeUsername(body.login ?? "");
  const password = typeof body.password === "string" ? body.password : "";
  if (!loginNorm || !password) {
    return NextResponse.json({ error: "Укажите логин и пароль." }, { status: 400 });
  }

  const user = await prisma.user.findUnique({ where: { login: loginNorm } });
  if (!user?.passwordHash) {
    return NextResponse.json({ error: "Неверный логин или пароль." }, { status: 401 });
  }

  const h = await hashLoginPassword(loginNorm, password);
  if (h !== user.passwordHash) {
    return NextResponse.json({ error: "Неверный логин или пароль." }, { status: 401 });
  }

  const exp = Date.now() + SESSION_MAX_AGE_SEC * 1000;
  const token = signSession({ login: loginNorm, exp });

  const res = NextResponse.json({ ok: true });
  res.cookies.set(SESSION_COOKIE_NAME, token, {
    httpOnly: true,
    sameSite: "lax",
    path: "/",
    maxAge: SESSION_MAX_AGE_SEC,
    secure: requestIsHttps(request),
  });
  return res;
}
