import { NextResponse } from "next/server";
import { verifyPassword, hashPassword } from "@/lib/auth-password";
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

const MAX_ATTEMPTS = 10;
const WINDOW_MS = 15 * 60 * 1000;
const loginAttempts = new Map<string, { n: number; until: number }>();

function clientIp(req: Request): string {
  return (
    req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
    req.headers.get("x-real-ip") ||
    "unknown"
  );
}

export async function POST(request: Request) {
  if (!isDatabaseConfigured()) {
    return NextResponse.json({ error: "Не задан DATABASE_URL." }, { status: 503 });
  }
  if (!getSessionSecret()) {
    return NextResponse.json({ error: "Не задан SESSION_SECRET." }, { status: 503 });
  }

  const ip = clientIp(request);
  const now = Date.now();
  const entry = loginAttempts.get(ip);
  if (entry && now < entry.until && entry.n >= MAX_ATTEMPTS) {
    return NextResponse.json(
      { error: "Слишком много попыток. Подождите 15 минут." },
      { status: 429 },
    );
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

  const fail = () => {
    const e = loginAttempts.get(ip);
    if (!e || now >= e.until) loginAttempts.set(ip, { n: 1, until: now + WINDOW_MS });
    else e.n++;
    return NextResponse.json({ error: "Неверный логин или пароль." }, { status: 401 });
  };

  const user = await prisma.user.findUnique({ where: { login: loginNorm } });
  if (!user?.passwordHash) return fail();

  const ok = await verifyPassword(password, user.passwordHash, loginNorm);
  if (!ok) return fail();

  loginAttempts.delete(ip);

  // Migrate legacy SHA-256 hash to scrypt on successful login
  if (!user.passwordHash.startsWith("scrypt:")) {
    const newHash = await hashPassword(password);
    await prisma.user.update({ where: { id: user.id }, data: { passwordHash: newHash } });
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
