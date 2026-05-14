import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

const UPSTREAM = "https://api.cashercollection.com/products";

/** Прокси каталога вещей: браузер не может дергать api.cashercollection.com с произвольного origin (CORS). */
export async function GET() {
  try {
    const res = await fetch(UPSTREAM, { cache: "no-store" });
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
