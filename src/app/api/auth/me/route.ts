import { NextResponse } from "next/server";
import { getSessionUser, isDatabaseConfigured } from "@/lib/auth-session-prisma";
import { isPanelAdminRole } from "@/lib/panel-auth-utils";
import { prisma } from "@/lib/prisma";
import type { PanelUserPublic } from "@/types/panel-auth-api";

function toPublic(u: {
  login: string;
  role: string;
  displayName: string | null;
  employeeId: string | null;
}): PanelUserPublic {
  const role =
    u.role === "superadmin" || u.role === "admin" || u.role === "user" ? u.role : "user";
  return {
    login: u.login,
    role,
    ...(u.displayName ? { displayName: u.displayName } : {}),
    ...(u.employeeId ? { employeeId: u.employeeId } : {}),
  };
}

export async function GET() {
  if (!isDatabaseConfigured()) {
    return NextResponse.json(
      { error: "База данных не настроена (DATABASE_URL)." },
      { status: 503 },
    );
  }

  const sessionUser = await getSessionUser();
  if (!sessionUser) {
    return NextResponse.json({ authenticated: false as const }, { status: 200 });
  }

  const me = toPublic(sessionUser);

  if (!isPanelAdminRole(sessionUser.role)) {
    return NextResponse.json({
      authenticated: true as const,
      me,
    });
  }

  const all = await prisma.user.findMany({ orderBy: { login: "asc" } });
  const users: PanelUserPublic[] = all.map((row) => toPublic(row));

  return NextResponse.json({
    authenticated: true as const,
    me,
    users,
  });
}
