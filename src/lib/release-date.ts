/** Нормализует дату выхода к YYYY-MM-DD (строгий YMD, ISO-префикс, DD.MM.YYYY). */
export function normalizeReleaseDateYmd(raw: string | undefined): string | undefined {
  const v = raw?.trim() ?? "";
  if (!v) return undefined;
  if (/^\d{4}-\d{2}-\d{2}$/.test(v)) return v;
  const iso = /^(\d{4}-\d{2}-\d{2})/.exec(v);
  if (iso) return iso[1];
  const dmy = /^(\d{1,2})\.(\d{1,2})\.(\d{4})$/.exec(v);
  if (dmy) {
    const day = String(Number(dmy[1])).padStart(2, "0");
    const month = String(Number(dmy[2])).padStart(2, "0");
    const year = dmy[3];
    if (Number(month) >= 1 && Number(month) <= 12 && Number(day) >= 1 && Number(day) <= 31) {
      return `${year}-${month}-${day}`;
    }
  }
  return undefined;
}
