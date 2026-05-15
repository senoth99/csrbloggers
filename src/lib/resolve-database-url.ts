import path from "node:path";

/**
 * SQLite: относительный `file:./panel.sqlite` в .env → `{PANEL_ROOT|cwd}/prisma/panel.sqlite`.
 * На VPS задайте абсолютный путь или PANEL_ROOT=/var/www/csrbloggers.
 */
export function resolveSqliteDatabaseUrl(
  raw: string | undefined = process.env.DATABASE_URL,
): string | undefined {
  const url = raw?.trim();
  if (!url) return undefined;
  if (!url.startsWith("file:")) return url;

  const filePath = url.slice("file:".length);
  if (path.isAbsolute(filePath)) return url;

  const root = process.env.PANEL_ROOT?.trim() || process.cwd();
  const relative = filePath.replace(/^\.\//, "");
  const absolute = relative.includes("/")
    ? path.join(root, relative)
    : path.join(root, "prisma", relative);

  return `file:${absolute}`;
}
