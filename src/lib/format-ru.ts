export function formatRuDate(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "—";
  return new Intl.DateTimeFormat("ru-RU", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    timeZone: "UTC",
  }).format(d);
}

/** Дата календаря YYYY-MM-DD без сдвига дня из‑за UTC */
export function formatCalendarDate(ymd: string | undefined): string {
  if (!ymd?.trim()) return "—";
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(ymd.trim());
  if (!m) return formatRuDate(ymd);
  const d = new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]));
  if (Number.isNaN(d.getTime())) return "—";
  return new Intl.DateTimeFormat("ru-RU", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  }).format(d);
}

/** Дата и время выхода для отображения в списке */
export function formatIntegrationReleaseLine(
  releaseDate: string | undefined,
  releaseTime: string | undefined,
): string {
  const d = releaseDate?.trim();
  const t = releaseTime?.trim();
  if (!d && !t) return "—";
  const dateLabel = d ? formatCalendarDate(d) : "";
  if (d && t) return `${dateLabel} · ${t}`;
  if (t && !d) return t;
  return dateLabel || "—";
}

/**
 * Только день и месяц для узкой колонки таблицы (год и время смотрят в карточке).
 */
export function formatIntegrationReleaseDateTable(releaseDate: string | undefined): string {
  const raw = releaseDate?.trim();
  if (!raw) return "—";
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(raw);
  if (m) return `${m[3]}.${m[2]}`;
  const parsed = new Date(raw);
  if (!Number.isNaN(parsed.getTime())) {
    return new Intl.DateTimeFormat("ru-RU", {
      day: "2-digit",
      month: "2-digit",
    }).format(parsed);
  }
  return "—";
}

export function formatRuTime(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "—";
  return new Intl.DateTimeFormat("ru-RU", {
    hour: "2-digit",
    minute: "2-digit",
    timeZone: "UTC",
  }).format(d);
}

/** Рубли без копеек в отображении */
export function formatRuMoney(amount: number): string {
  return new Intl.NumberFormat("ru-RU", {
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(amount);
}

/**
 * CPM в ₽ за 1000 охватов — всегда две цифры после запятой (например 0,21).
 */
export function formatRuCpm(rub: number): string {
  return new Intl.NumberFormat("ru-RU", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(rub);
}

export function shortId(id: string, len = 8): string {
  return id.replace(/-/g, "").slice(0, len);
}
