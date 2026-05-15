import { NextResponse } from "next/server";
import { getSessionUser, isDatabaseConfigured } from "@/lib/auth-session-prisma";
import { prisma } from "@/lib/prisma";

function parseKeys(raw: string): string[] {
  try {
    const parsed = JSON.parse(raw);
    if (Array.isArray(parsed)) return parsed.filter((k): k is string => typeof k === "string");
  } catch {}
  return [];
}

export async function GET() {
  if (!isDatabaseConfigured()) return NextResponse.json({ error: "DB not configured" }, { status: 503 });
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const keys = parseKeys(user.completedTaskKeys);
  return NextResponse.json({ keys });
}

export async function PUT(req: Request) {
  if (!isDatabaseConfigured()) return NextResponse.json({ error: "DB not configured" }, { status: 503 });
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const body = (await req.json()) as { keys?: unknown };
  const keys = Array.isArray(body.keys) ? body.keys.filter((k): k is string => typeof k === "string") : [];
  await prisma.user.update({ where: { id: user.id }, data: { completedTaskKeys: JSON.stringify(keys) } });
  return NextResponse.json({ ok: true });
}
