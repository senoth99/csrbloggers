import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

/** Минимальный ping для проверки, что HTTP до Next доходит (удобно в dev и за прокси). */
export function GET() {
  return NextResponse.json({
    ok: true,
    t: Date.now(),
    nodeEnv: process.env.NODE_ENV,
  });
}
