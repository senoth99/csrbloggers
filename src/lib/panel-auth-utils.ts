/** Суперадмин по умолчанию (см. prisma/seed.ts). */
export const SUPERADMIN_LOGIN = "senoth";

export function normalizeUsername(raw: string): string {
  return raw.trim().replace(/^@+/, "").toLowerCase();
}
