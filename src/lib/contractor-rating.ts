import { computeCpmRub } from "@/lib/integration-metrics";
import type { Integration } from "@/types/panel-data";

function budgetRub(i: Pick<Integration, "budget" | "amount">): number | undefined {
  const b = i.budget ?? i.amount;
  if (b == null || !Number.isFinite(b)) return undefined;
  return b;
}

function clamp(x: number, lo: number, hi: number): number {
  return Math.min(hi, Math.max(lo, x));
}

function round1(x: number): number {
  return Math.round(x * 10) / 10;
}

/** Отображение: до одного знака, «10» без десятых */
export function formatContractorRating10Display(value: number): string {
  const x = round1(clamp(value, 0, 10));
  if (x >= 9.95) return "10";
  return x.toFixed(1);
}

const LOW_CPM_GOOD_RUB = 1800;

/**
 * Авто-рейтинг 0…10 по интеграциям и складу вещей.
 * Ниже суммарный CPM и больше интеграций с низким CPM — выше.
 * Выше CPM — ниже база.
 * Много вещей при малых интеграциях (или без интеграций) — штраф.
 */
export function computeContractorRating10(
  integrations: Integration[],
  itemCount: number,
): number {
  const nInt = integrations.length;

  let sumBudget = 0;
  let sumReach = 0;
  const rowCpms: number[] = [];
  let goodLowCpmCount = 0;

  for (const i of integrations) {
    const b = budgetRub(i);
    const r = i.reach;
    const cpm = computeCpmRub(b, r);
    if (cpm != null) {
      rowCpms.push(cpm);
      if (cpm <= LOW_CPM_GOOD_RUB) goodLowCpmCount += 1;
    }
    if (b != null) sumBudget += b;
    if (r != null && Number.isFinite(r) && r > 0) sumReach += r;
  }

  const blendCpm =
    sumReach > 0 && Number.isFinite(sumBudget) ? (sumBudget / sumReach) * 1000 : undefined;

  const cpmForScore =
    blendCpm ??
    (rowCpms.length > 0 ? rowCpms.reduce((a, x) => a + x, 0) / rowCpms.length : undefined);

  let base = 5;
  if (cpmForScore != null && cpmForScore > 0) {
    base = clamp(12 - Math.log1p(cpmForScore) * 0.95, 0, 10);
  } else if (nInt === 0 && itemCount === 0) {
    base = 5;
  } else if (nInt === 0 && itemCount > 0) {
    base = 4.2;
  }

  const lowCpmBonus = Math.min(2, goodLowCpmCount * 0.35);
  const depthBonus =
    rowCpms.length >= 3 ? Math.min(0.5, (rowCpms.length - 2) * 0.12) : 0;

  let stockPenalty = 0;
  if (nInt === 0) {
    stockPenalty = Math.min(3.5, Math.max(0, itemCount - 2) * 0.25);
  } else {
    const surplusItems = Math.max(0, itemCount - 4 * nInt);
    stockPenalty = Math.min(3.5, surplusItems * 0.12);
  }

  const raw = base + lowCpmBonus + depthBonus - stockPenalty;
  return round1(clamp(raw, 0, 10));
}

export const CONTRACTOR_RATING_TOOLTIP_RU =
  "Авто 0–10: ниже средний CPM и больше интеграций с низким CPM — выше; много вещей при малых интеграциях — ниже.";
