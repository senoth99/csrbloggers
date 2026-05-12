const MAX_LEN = 2048;

/** Сохраняемая строка: обрезка пробелов и длины */
export function normalizeIntegrationPublicLink(raw: string | undefined): string | undefined {
  const s = (raw ?? "").trim();
  if (!s) return undefined;
  return s.length > MAX_LEN ? s.slice(0, MAX_LEN) : s;
}

/**
 * Безопасный href для внешней ссылки (только http/https).
 * Без схемы подставляется https://
 */
export function integrationPublicLinkHref(stored: string | undefined | null): string | null {
  const t = String(stored ?? "").trim();
  if (!t) return null;
  try {
    const withScheme = /^https?:\/\//i.test(t) ? t : `https://${t}`;
    const u = new URL(withScheme);
    if (u.protocol !== "http:" && u.protocol !== "https:") return null;
    return u.toString();
  } catch {
    return null;
  }
}
