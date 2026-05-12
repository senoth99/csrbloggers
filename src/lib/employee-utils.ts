import type { Delivery, Employee, Integration } from "@/types/panel-data";
import { isoInYearMonth, shiftYearMonth, type YearMonth } from "@/lib/dashboard-metrics";

export function normalizeTelegramUsername(raw: string): string {
  return raw.trim().replace(/^@+/, "").toLowerCase();
}

export function findEmployeeIdByTelegram(
  employees: Employee[],
  telegramUsername: string | null | undefined,
): string | undefined {
  if (!telegramUsername?.trim()) return undefined;
  const n = normalizeTelegramUsername(telegramUsername);
  const e = employees.find((x) => normalizeTelegramUsername(x.telegramUsername) === n);
  return e?.id;
}

/** Текущая сессия панели: сначала panelLogin, иначе совпадение по Telegram */
export function findEmployeeIdByPanelSession(
  employees: Employee[],
  panelLogin: string | null | undefined,
): string | undefined {
  if (!panelLogin?.trim()) return undefined;
  const n = normalizeTelegramUsername(panelLogin);
  const byPanel = employees.find(
    (x) => x.panelLogin && normalizeTelegramUsername(x.panelLogin) === n,
  );
  if (byPanel) return byPanel.id;
  return findEmployeeIdByTelegram(employees, panelLogin);
}

/** «Иванов Иван Петрович» → «Иванов И. П.» */
export function abbreviateFio(fullName: string): string {
  const parts = fullName.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "—";
  if (parts.length === 1) return parts[0];
  const [last, first, ...rest] = parts;
  const initials = [first, ...rest]
    .map((w) => (w[0] ? `${w[0].toUpperCase()}.` : ""))
    .filter(Boolean)
    .join(" ");
  return `${last} ${initials}`;
}

export function employeeDisplayAvatarUrl(e: Employee): string {
  const custom = e.avatarUrl?.trim();
  if (custom) return custom;
  const seed = encodeURIComponent(e.fullName || e.id);
  return `https://api.dicebear.com/7.x/notionists/svg?seed=${seed}`;
}

export type LeaderboardRow = {
  employee: Employee;
  integrations: number;
  deliveries: number;
  score: number;
  rank: number;
};

export function buildLeaderboard(
  employees: Employee[],
  integrations: Integration[],
  deliveries: Delivery[],
): LeaderboardRow[] {
  const ids = new Set(employees.map((e) => e.id));
  const stats = new Map<string, { int: number; del: number }>();
  for (const e of employees) {
    stats.set(e.id, { int: 0, del: 0 });
  }
  for (const i of integrations) {
    const id = i.assignedEmployeeId;
    if (!id || !ids.has(id)) continue;
    const s = stats.get(id)!;
    s.int += 1;
  }
  for (const d of deliveries) {
    const id = d.assignedEmployeeId;
    if (!id || !ids.has(id)) continue;
    const s = stats.get(id)!;
    s.del += 1;
  }
  const rows: LeaderboardRow[] = employees.map((employee) => {
    const s = stats.get(employee.id) ?? { int: 0, del: 0 };
    const score = s.int + s.del;
    return {
      employee,
      integrations: s.int,
      deliveries: s.del,
      score,
      rank: 0,
    };
  });
  rows.sort((a, b) => b.score - a.score || a.employee.fullName.localeCompare(b.employee.fullName, "ru"));
  rows.forEach((r, i) => {
    r.rank = i + 1;
  });
  return rows;
}

/** Лидерборд за календарный месяц + динамика «Всего» к прошлому месяцу */
export type LeaderboardRowMonthly = LeaderboardRow & {
  trend: "up" | "down" | "same";
  scorePrevMonth: number;
};

function employeeMonthStats(
  employees: Employee[],
  integrations: Integration[],
  deliveries: Delivery[],
  ym: YearMonth,
): Map<string, { int: number; del: number }> {
  const ids = new Set(employees.map((e) => e.id));
  const stats = new Map<string, { int: number; del: number }>();
  for (const e of employees) {
    stats.set(e.id, { int: 0, del: 0 });
  }
  for (const i of integrations) {
    const id = i.assignedEmployeeId;
    if (!id || !ids.has(id)) continue;
    if (!isoInYearMonth(i.createdAt, ym)) continue;
    const s = stats.get(id)!;
    s.int += 1;
  }
  for (const d of deliveries) {
    const id = d.assignedEmployeeId;
    if (!id || !ids.has(id)) continue;
    if (!isoInYearMonth(d.createdAt, ym)) continue;
    const s = stats.get(id)!;
    s.del += 1;
  }
  return stats;
}

export function buildLeaderboardForYearMonth(
  employees: Employee[],
  integrations: Integration[],
  deliveries: Delivery[],
  ym: YearMonth,
): LeaderboardRowMonthly[] {
  const ymPrev = shiftYearMonth(ym, -1);
  const cur = employeeMonthStats(employees, integrations, deliveries, ym);
  const prev = employeeMonthStats(employees, integrations, deliveries, ymPrev);

  const rows: LeaderboardRowMonthly[] = employees.map((employee) => {
    const c = cur.get(employee.id) ?? { int: 0, del: 0 };
    const p = prev.get(employee.id) ?? { int: 0, del: 0 };
    const score = c.int + c.del;
    const scorePrevMonth = p.int + p.del;
    let trend: "up" | "down" | "same" = "same";
    if (score > scorePrevMonth) trend = "up";
    else if (score < scorePrevMonth) trend = "down";
    return {
      employee,
      integrations: c.int,
      deliveries: c.del,
      score,
      rank: 0,
      scorePrevMonth,
      trend,
    };
  });
  rows.sort(
    (a, b) =>
      b.score - a.score || a.employee.fullName.localeCompare(b.employee.fullName, "ru"),
  );
  rows.forEach((r, i) => {
    r.rank = i + 1;
  });
  return rows;
}
