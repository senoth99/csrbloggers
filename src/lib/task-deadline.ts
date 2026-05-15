/**
 * Дедлайн задачи: конец первого рабочего дня после календарного дня события.
 * Суббота и воскресенье пропускаются (пятница → понедельник ночь).
 */

function isWeekendLocal(d: Date): boolean {
  const day = d.getDay();
  return day === 0 || day === 6;
}

export function addCalendarDaysLocal(base: Date, days: number): Date {
  return new Date(base.getFullYear(), base.getMonth(), base.getDate() + days);
}

/** Начало локального календарного дня события (YYYY-MM-DD или ISO с временем). */
export function startOfLocalDayFromIso(iso: string): Date {
  const ymd = iso.trim().slice(0, 10);
  if (/^\d{4}-\d{2}-\d{2}$/.test(ymd)) {
    const local = parseYmdLocal(ymd);
    if (local) return local;
  }
  const t = new Date(iso);
  return new Date(t.getFullYear(), t.getMonth(), t.getDate());
}

/** Конец локального дня 23:59:59.999 */
export function endOfLocalDay(d: Date): Date {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate(), 23, 59, 59, 999);
}

/**
 * Первый рабочий день строго после календарного дня `eventIso`, конец этого дня.
 */
export function deadlineEodAfterEventDay(eventIso: string): Date {
  const eventDay = startOfLocalDayFromIso(eventIso);
  let candidate = addCalendarDaysLocal(eventDay, 1);
  while (isWeekendLocal(candidate)) {
    candidate = addCalendarDaysLocal(candidate, 1);
  }
  return endOfLocalDay(candidate);
}

export function parseYmdLocal(ymd: string): Date | null {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(ymd)) return null;
  const [y, m, d] = ymd.split("-").map(Number);
  return new Date(y!, m! - 1, d!);
}

export function startOfLocalDay(d: Date): Date {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate());
}
