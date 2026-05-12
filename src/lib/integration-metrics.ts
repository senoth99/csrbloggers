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

/** Разбор поля ввода бюджета/охватов: пустая строка → undefined */
export function parseBudgetReachField(raw: string): number | undefined {
  const v = raw.trim().replace(/\s/g, "").replace(",", ".");
  if (!v) return undefined;
  const n = Number.parseFloat(v);
  if (Number.isNaN(n) || n < 0) return undefined;
  return n;
}
