import type { Delivery, Integration } from "@/types/panel-data";
import { isAgreementIntegrationStatus, isPublishedIntegrationStatus } from "@/types/panel-data";
import { computeCpmRub, integrationEffectiveBudgetRub } from "@/lib/integration-metrics";
import { normalizeReleaseDateYmd } from "@/lib/release-date";

export type YearMonth = { year: number; month: number };

export function currentYearMonth(): YearMonth {
  const d = new Date();
  return { year: d.getFullYear(), month: d.getMonth() + 1 };
}

export function parseYearMonthString(s: string | null | undefined): YearMonth | null {
  const m = /^(\d{4})-(\d{2})$/.exec(String(s ?? "").trim());
  if (!m) return null;
  const year = Number(m[1]);
  const month = Number(m[2]);
  if (month < 1 || month > 12 || year < 2000 || year > 2100) return null;
  return { year, month };
}

export function formatYearMonthString(ym: YearMonth): string {
  return `${ym.year}-${String(ym.month).padStart(2, "0")}`;
}

/**
 * Календарная семантика дат в метриках:
 *
 * - `ymdInYearMonth` — поля `YYYY-MM-DD` (releaseDate): месяц по префиксу строки, без TZ.
 * - `isoInYearMonth` — полные ISO-метки (createdAt, updatedAt): месяц по UTC-календарю.
 * - `dateIsoInYearMonth` — сначала YYYY-MM-DD-префикс (как ymd), иначе isoInYearMonth.
 *
 * Не смешивайте оси: KPI «выход» → releaseDate + ymd; «создано» → createdAt + iso.
 *
 * KPI дашборда: `integrationInDashboardMonth` — releaseDate (и даты позиций), иначе createdAt.
 */
export function isoInYearMonth(iso: string | undefined, ym: YearMonth): boolean {
  if (!iso?.trim()) return false;
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return false;
  return d.getUTCFullYear() === ym.year && d.getUTCMonth() + 1 === ym.month;
}

/** Match YYYY-MM-DD date string against a YearMonth (no timezone shift). */
export function ymdInYearMonth(ymd: string | undefined, ym: YearMonth): boolean {
  if (!ymd?.trim()) return false;
  const prefix = `${ym.year}-${String(ym.month).padStart(2, "0")}`;
  return ymd.trim().startsWith(prefix);
}

/** ISO timestamp or YYYY-MM-DD prefix → календарный месяц (см. блок выше). */
export function dateIsoInYearMonth(iso: string | undefined, ym: YearMonth): boolean {
  if (!iso?.trim()) return false;
  const t = iso.trim();
  const ymd = /^\d{4}-\d{2}-\d{2}/.exec(t);
  if (ymd) return ymdInYearMonth(ymd[0], ym);
  return isoInYearMonth(iso, ym);
}

/** Все нормализованные YYYY-MM-DD выхода: интеграция + позиции. */
export function integrationReleaseYmds(integration: Integration): string[] {
  const out: string[] = [];
  const main = normalizeReleaseDateYmd(integration.releaseDate);
  if (main) out.push(main);
  for (const pos of integration.positions ?? []) {
    const y = normalizeReleaseDateYmd(pos.releaseDate);
    if (y) out.push(y);
  }
  return out;
}

/**
 * Месяц для KPI дашборда: дата выхода (интеграция/позиции) в месяце
 * или месяц создания записи (чтобы новые строки без releaseDate не терялись).
 */
export function integrationInDashboardMonth(integration: Integration, ym: YearMonth): boolean {
  const ymds = integrationReleaseYmds(integration);
  if (ymds.some((d) => ymdInYearMonth(d, ym))) return true;
  return dateIsoInYearMonth(integration.createdAt, ym);
}

/** День месяца (1…n) для графика охватов; null если интеграция не в этом месяце. */
function integrationDayOfMonthInDashboardMonth(
  integration: Integration,
  ym: YearMonth,
): number | null {
  if (!integrationInDashboardMonth(integration, ym)) return null;
  for (const d of integrationReleaseYmds(integration)) {
    if (!ymdInYearMonth(d, ym)) continue;
    const dayMatch = /^(\d{4})-(\d{2})-(\d{2})$/.exec(d);
    if (dayMatch) return Number(dayMatch[3]);
  }
  if (integration.createdAt && dateIsoInYearMonth(integration.createdAt, ym)) {
    const t = new Date(integration.createdAt);
    if (!Number.isNaN(t.getTime())) {
      const prefix = /^\d{4}-\d{2}-\d{2}/.exec(integration.createdAt.trim());
      if (prefix) {
        const dayMatch = /^(\d{4})-(\d{2})-(\d{2})$/.exec(prefix[0]);
        if (dayMatch) return Number(dayMatch[3]);
      }
      return t.getUTCDate();
    }
  }
  return null;
}

/** Последний календарный месяц, в котором есть хотя бы одна интеграция по KPI-логике. */
export function latestYearMonthWithIntegrations(
  integrations: Integration[],
): YearMonth | null {
  let best: { ym: YearMonth; t: number } | null = null;
  for (const i of integrations) {
    const candidates: string[] = [...integrationReleaseYmds(i)];
    if (i.createdAt?.trim()) candidates.push(i.createdAt.trim());
    for (const raw of candidates) {
      const ymd = /^\d{4}-\d{2}-\d{2}/.exec(raw.trim());
      const anchor = ymd ? ymd[0] : raw;
      const d = new Date(anchor);
      if (Number.isNaN(d.getTime())) continue;
      const ym: YearMonth = {
        year: ymd ? Number(ymd[0].slice(0, 4)) : d.getUTCFullYear(),
        month: ymd ? Number(ymd[0].slice(5, 7)) : d.getUTCMonth() + 1,
      };
      const t = new Date(ym.year, ym.month - 1, 1).getTime();
      if (!best || t > best.t) best = { ym, t };
    }
  }
  return best?.ym ?? null;
}

export function monthTitleRu(ym: YearMonth): string {
  return new Intl.DateTimeFormat("ru-RU", {
    month: "long",
    year: "numeric",
  }).format(new Date(ym.year, ym.month - 1, 1));
}

/** Число дней в календарном месяце */
export function daysInYearMonth(ym: YearMonth): number {
  return new Date(ym.year, ym.month, 0).getDate();
}

export function integrationsCreatedInMonth(
  integrations: Integration[],
  ym: YearMonth,
): Integration[] {
  return integrations.filter((i) => isoInYearMonth(i.createdAt, ym));
}

/** Договорённости: созданные в месяце со статусом «черновик» или «перенос» */
export function agreementsCreatedInMonth(
  integrations: Integration[],
  ym: YearMonth,
): number {
  return integrationsCreatedInMonth(integrations, ym).filter((i) =>
    isAgreementIntegrationStatus(i.status),
  ).length;
}

/** Интеграции в календарном месяце по дате выхода (см. integrationInDashboardMonth). */
export function integrationsWithReleaseInMonth(
  integrations: Integration[],
  ym: YearMonth,
): Integration[] {
  return integrations.filter((i) => integrationInDashboardMonth(i, ym));
}

/** Договорённости с releaseDate в месяце (черновик / перенос). */
export function integrationsAgreementsInMonth(
  integrations: Integration[],
  ym: YearMonth,
): Integration[] {
  return integrationsWithReleaseInMonth(integrations, ym).filter((i) =>
    isAgreementIntegrationStatus(i.status),
  );
}

/** Опубликованные интеграции с датой выхода (releaseDate) в календарном месяце. */
export function integrationsPublishedInMonth(
  integrations: Integration[],
  ym: YearMonth,
): Integration[] {
  return integrations.filter(
    (i) => isPublishedIntegrationStatus(i.status) && integrationInDashboardMonth(i, ym),
  );
}

/**
 * Охваты по календарным дням месяца: суммируются reach у интеграций с releaseDate в этом месяце.
 */
export function integrationReachByCalendarDayInMonth(
  integrations: Integration[],
  ym: YearMonth,
): number[] {
  const n = daysInYearMonth(ym);
  const out = Array.from({ length: n }, () => 0);
  for (const i of integrations) {
    const dayOfMonth = integrationDayOfMonthInDashboardMonth(i, ym);
    if (dayOfMonth == null) continue;
    const idx = dayOfMonth - 1;
    if (idx < 0 || idx >= n) continue;
    if (i.reach != null && Number.isFinite(i.reach)) {
      out[idx] += Math.max(0, i.reach);
    }
  }
  return out;
}

export function deliveriesCreatedInMonth(
  deliveries: Delivery[],
  ym: YearMonth,
): Delivery[] {
  return deliveries.filter((d) => isoInYearMonth(d.createdAt, ym));
}

/**
 * Доставки «Получено» в календарном месяце по deliveredAt (или updatedAt для legacy без deliveredAt).
 * createdAt не используется — месяц создания записи ≠ месяц получения.
 */
export function deliveriesDeliveredInMonth(
  deliveries: Delivery[],
  ym: YearMonth,
): Delivery[] {
  return deliveries.filter((d) => {
    if (d.status !== "delivered") return false;
    const anchor = d.deliveredAt?.trim() || d.updatedAt?.trim();
    if (!anchor) return false;
    return dateIsoInYearMonth(anchor, ym);
  });
}

export function countBy<T extends string>(items: T[]): Record<string, number> {
  const m: Record<string, number> = {};
  for (const k of items) {
    m[k] = (m[k] ?? 0) + 1;
  }
  return m;
}

export function shiftYearMonth(ym: YearMonth, delta: number): YearMonth {
  const d = new Date(ym.year, ym.month - 1 + delta, 1);
  return { year: d.getFullYear(), month: d.getMonth() + 1 };
}

/** Сравнение текущего и предыдущего месяца по одному числу */
export function monthOverMonthTrend(
  current: number,
  previous: number,
): "up" | "down" | "same" {
  if (current > previous) return "up";
  if (current < previous) return "down";
  return "same";
}

/** Сравнение CPM (может отсутствовать при нуле охватов) */
export function monthOverMonthTrendCpm(
  currentRub: number | undefined,
  previousRub: number | undefined,
): "up" | "down" | "same" {
  if (currentRub == null && previousRub == null) return "same";
  if (currentRub != null && previousRub == null) return "up";
  if (currentRub == null && previousRub != null) return "down";
  const a = Math.round((currentRub as number) * 100);
  const b = Math.round((previousRub as number) * 100);
  if (a > b) return "up";
  if (a < b) return "down";
  return "same";
}

export function sumIntegrationReach(integrations: Integration[]): number {
  let s = 0;
  for (const i of integrations) {
    if (i.reach != null && Number.isFinite(i.reach)) s += i.reach;
  }
  return s;
}

export function sumIntegrationBudget(integrations: Integration[]): number {
  let s = 0;
  for (const i of integrations) {
    const b = integrationEffectiveBudgetRub(i);
    if (b != null && Number.isFinite(b)) s += b;
  }
  return s;
}

export function sumPromoActivations(integrations: Integration[]): number {
  let s = 0;
  for (const i of integrations) {
    if (i.promoActivations != null && Number.isFinite(i.promoActivations)) {
      s += i.promoActivations;
    }
  }
  return s;
}

/** Пропуск в KPI, когда значения нет */
export const DASHBOARD_EMPTY_VALUE = "—";

/** Есть ли хотя бы одна интеграция с заполненным бюджетом */
export function integrationsHaveAnyBudget(integrations: Integration[]): boolean {
  return integrations.some((i) => integrationEffectiveBudgetRub(i) != null);
}

export function integrationsHaveAnyReach(integrations: Integration[]): boolean {
  return integrations.some((i) => i.reach != null && Number.isFinite(i.reach));
}

export function integrationsHaveAnyPromoActivations(integrations: Integration[]): boolean {
  return integrations.some(
    (i) => i.promoActivations != null && Number.isFinite(i.promoActivations),
  );
}

/** Общий CPM по суммам бюджета и охватов за месяц (без бюджетов в данных — не считаем) */
export function aggregateCpmForMonth(integrations: Integration[]): number | undefined {
  if (!integrationsHaveAnyBudget(integrations)) return undefined;
  const budget = sumIntegrationBudget(integrations);
  const reach = sumIntegrationReach(integrations);
  return computeCpmRub(budget, reach);
}
