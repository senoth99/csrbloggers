import { prisma } from "@/lib/prisma";

const MAX_ATTEMPTS = 10;
const WINDOW_MS = 15 * 60 * 1000;

function trustProxyHeaders(): boolean {
  return process.env.TRUST_PROXY === "1" || process.env.TRUST_PROXY === "true";
}

export function clientIpFromRequest(req: Request): string {
  if (trustProxyHeaders()) {
    const forwarded = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim();
    if (forwarded) return forwarded;
    const realIp = req.headers.get("x-real-ip")?.trim();
    if (realIp) return realIp;
  }
  return "unknown";
}

/** Ключ лимита: логин + IP (не доверяем X-Forwarded-For без TRUST_PROXY). */
export function loginRateLimitKey(login: string, ip: string): string {
  return `${login}:${ip}`;
}

/** true — можно продолжать логин; false — rate limit. */
export async function loginRateLimitAllows(key: string): Promise<boolean> {
  const row = await prisma.loginAttempt.findUnique({ where: { key } });
  if (!row) return true;
  const now = Date.now();
  if (now >= row.windowEnd.getTime()) return true;
  return row.count < MAX_ATTEMPTS;
}

export async function recordLoginFailure(key: string): Promise<void> {
  const now = new Date();
  const row = await prisma.loginAttempt.findUnique({ where: { key } });
  if (!row || now.getTime() >= row.windowEnd.getTime()) {
    await prisma.loginAttempt.upsert({
      where: { key },
      create: { key, count: 1, windowEnd: new Date(now.getTime() + WINDOW_MS) },
      update: { count: 1, windowEnd: new Date(now.getTime() + WINDOW_MS) },
    });
    return;
  }
  await prisma.loginAttempt.update({
    where: { key },
    data: { count: row.count + 1 },
  });
}

export async function clearLoginAttempts(key: string): Promise<void> {
  await prisma.loginAttempt.deleteMany({ where: { key } });
}
