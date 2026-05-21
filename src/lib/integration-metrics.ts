/** CPM в рублях за 1000 охватов (см. реализацию). */
export function computeCpmRub(
  budgetRub: number | undefined,
  reach: number | undefined,
): number | undefined {
  if (
    budgetRub == null ||
    reach == null ||
    reach <= 0 ||
    !Number.isFinite(budgetRub) ||
    !Number.isFinite(reach)
  ) {
    return undefined;
  }
  return (budgetRub / reach) * 1000;
}

import type { Integration, IntegrationPosition } from "@/types/panel-data";
import { formatRuMoney } from "@/lib/format-ru";

/** Разбор поля ввода бюджета/охватов: пустая строка → undefined */
export function parseBudgetReachField(raw: string): number | undefined {
  const v = raw.trim().replace(/\s/g, "").replace(",", ".");
  if (!v) return undefined;
  const n = Number.parseFloat(v);
  if (Number.isNaN(n) || n < 0) return undefined;
  return n;
}

/** Сумма бюджетов позиций; если у позиций нет бюджета — бюджет интеграции. */
export function integrationEffectiveBudgetRub(row: Integration): number | undefined {
  const positions = row.positions ?? [];
  const posSum = positions.reduce((s, p) => s + (p.budget ?? 0), 0);
  if (posSum > 0) return posSum;
  if (row.budget != null && row.budget > 0) return row.budget;
  return undefined;
}

export function formatIntegrationBudgetCell(row: Integration): string {
  const v = integrationEffectiveBudgetRub(row);
  return v != null ? formatRuMoney(v) : "—";
}

export function formatIntegrationPositionsCell(row: Integration): string {
  const positions = row.positions ?? [];
  if (positions.length === 0) return "—";
  const titles = positions.map((p) => p.title.trim()).filter(Boolean);
  if (titles.length === 0) return `${positions.length} поз.`;
  if (titles.length <= 2) return titles.join(", ");
  return `${titles[0]}, ${titles[1]} +${titles.length - 2}`;
}

/** Бюджет строки позиции для отображения (наследует бюджет интеграции, если одна позиция без своего). */
export function positionDisplayBudgetRub(
  pos: IntegrationPosition,
  row: Integration,
): number | undefined {
  if (pos.budget != null && pos.budget > 0) return pos.budget;
  const positions = row.positions ?? [];
  if (positions.length === 1 && row.budget != null && row.budget > 0) return row.budget;
  return undefined;
}
