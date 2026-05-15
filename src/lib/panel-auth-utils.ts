/** Суперадмин по умолчанию (см. prisma/seed.ts). */
export const SUPERADMIN_LOGIN = "senoth";

export function normalizeUsername(raw: string): string {
  return raw.trim().replace(/^@+/, "").toLowerCase();
}

/** Админ или суперадмин — управление данными панели и учётками сотрудников. */
export function isPanelAdminRole(role: string | undefined | null): boolean {
  return role === "admin" || role === "superadmin";
}

/** Стартовая страница после входа. */
export function defaultAuthenticatedPath(role: string | undefined | null): string {
  return isPanelAdminRole(role) ? "/dashboard" : "/integrations";
}
