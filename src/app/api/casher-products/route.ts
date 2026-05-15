import { NextResponse } from "next/server";
import { getSessionUser, isDatabaseConfigured } from "@/lib/auth-session-prisma";

const UPSTREAM = "https://api.cashercollection.com/products";

/** Прокси каталога вещей: браузер не может дергать api.cashercollection.com с произвольного origin (CORS). */
export async function GET() {
  if (!isDatabaseConfigured()) {
    return NextResponse.json({ error: "Не задан DATABASE_URL." }, { status: 503 });
  }
  const user = await getSessionUser();
  if (!user) {
    return NextResponse.json({ error: "Требуется вход." }, { status: 401 });
  }

  try {
    const res = await fetch(UPSTREAM, { next: { revalidate: 300 } });
    const body = await res.text();
    return new NextResponse(body, {
      status: res.status,
      headers: {
        "Content-Type": res.headers.get("content-type") ?? "application/json; charset=utf-8",
      },
    });
  } catch (e) {
    console.error("[casher-products] upstream fetch failed", e);
    return NextResponse.json({ error: "Upstream unavailable" }, { status: 502 });
  }
}
