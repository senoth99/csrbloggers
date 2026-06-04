import type { ContractorLink, Integration, SocialOption } from "@/types/panel-data";

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

/** Ссылка контрагента на площадку (по подписи = label соцсети). */
export function contractorSocialLinkUrl(
  contractorId: string,
  socialNetworkId: string,
  contractorLinks: ContractorLink[],
  socialOptions: SocialOption[],
): string | undefined {
  const label = socialOptions
    .find((o) => o.id === socialNetworkId)
    ?.label?.trim()
    .toLowerCase();
  if (!label) return undefined;
  const row = contractorLinks.find(
    (l) =>
      l.contractorId === contractorId && l.title.trim().toLowerCase() === label,
  );
  return row?.url?.trim() || undefined;
}

/** Ссылка на материал интеграции или профиль блогера на выбранной площадке. */
export function integrationDisplayLink(
  integration: Integration,
  contractorLinks: ContractorLink[],
  socialOptions: SocialOption[],
): string | undefined {
  const direct = integration.publicLink?.trim();
  if (direct) return direct;
  return contractorSocialLinkUrl(
    integration.contractorId,
    integration.socialNetworkId,
    contractorLinks,
    socialOptions,
  );
}
