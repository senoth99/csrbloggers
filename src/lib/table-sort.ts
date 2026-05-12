/** Сравнение строк для сортировки (ru, числовые подстроки как числа). */
export function compareStringsRu(a: string, b: string): number {
  return a.localeCompare(b, "ru", { numeric: true, sensitivity: "base" });
}

export function compareNumbers(a: number, b: number): number {
  if (a < b) return -1;
  if (a > b) return 1;
  return 0;
}

export function parseTimeMs(iso: string | undefined): number {
  if (!iso?.trim()) return 0;
  const t = Date.parse(iso);
  return Number.isNaN(t) ? 0 : t;
}
