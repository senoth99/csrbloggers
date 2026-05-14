import { createHmac, timingSafeEqual } from "crypto";

export const SESSION_COOKIE_NAME = "casher_panel_session";

export function getSessionSecret(): string | null {
  const s = process.env.SESSION_SECRET?.trim();
  return s || null;
}

export type SessionClaims = { login: string; exp: number };

export function signSession(claims: SessionClaims): string {
  const secret = getSessionSecret();
  if (!secret) {
    throw new Error("SESSION_SECRET is not set");
  }
  const body = Buffer.from(JSON.stringify(claims), "utf8").toString("base64url");
  const sig = createHmac("sha256", secret).update(body).digest("base64url");
  return `${body}.${sig}`;
}

export function verifySession(token: string): SessionClaims | null {
  const secret = getSessionSecret();
  if (!secret) return null;
  const dot = token.indexOf(".");
  if (dot < 0) return null;
  const body = token.slice(0, dot);
  const sig = token.slice(dot + 1);
  const expected = createHmac("sha256", secret).update(body).digest("base64url");
  try {
    if (!timingSafeEqual(Buffer.from(sig, "utf8"), Buffer.from(expected, "utf8"))) {
      return null;
    }
  } catch {
    return null;
  }
  try {
    const p = JSON.parse(Buffer.from(body, "base64url").toString("utf8")) as SessionClaims;
    if (!p.login || typeof p.exp !== "number") return null;
    if (Date.now() > p.exp) return null;
    return p;
  } catch {
    return null;
  }
}

export const SESSION_MAX_AGE_SEC = 60 * 60 * 24 * 14;
