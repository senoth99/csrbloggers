import { NextResponse } from "next/server";
import { SESSION_COOKIE_NAME, requestIsHttps } from "@/lib/panel-session-server";

export async function POST(request: Request) {
  const res = NextResponse.json({ ok: true });
  res.cookies.set(SESSION_COOKIE_NAME, "", {
    httpOnly: true,
    sameSite: "lax",
    path: "/",
    maxAge: 0,
    secure: requestIsHttps(request),
  });
  return res;
}
