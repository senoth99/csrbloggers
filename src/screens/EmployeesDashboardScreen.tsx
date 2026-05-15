"use client";

import { useMemo } from "react";
import { ArrowDown, ArrowUp, ChevronLeft, ChevronRight, Trash2 } from "lucide-react";
import { useAuth } from "@/context/AuthContext";
import { usePanelData } from "@/context/PanelDataContext";
import { EmployeeAvatar } from "@/components/EmployeeAvatar";
import {
  abbreviateFio,
  buildLeaderboardForYearMonth,
  findEmployeeIdByPanelSession,
  type LeaderboardRowMonthly,
} from "@/lib/employee-utils";
import { shiftYearMonth } from "@/lib/dashboard-metrics";
import { useDashboardMonth } from "@/hooks/useDashboardMonth";
import { ConfirmDeleteButton } from "@/components/ui";
import {
  dashboardMonthInputClass,
  dashboardMonthNavButtonClass,
  dashboardMonthPickerRowClass,
  dashboardPageTitleClass,
  dashboardPanelClass,
  listDivideClass,
} from "@/screens/dashboard-shared";

const MAX_AVATAR_BYTES = 2_500_000;

export function EmployeesDashboardScreen() {
  const { ym, setMonth, monthInputValue } = useDashboardMonth();
  const { currentUsername, removeUserAccess } = useAuth();
  const {
    employees,
    integrations,
    deliveries,
    isAdmin,
    updateEmployeeSelfAvatar,
    removeEmployee,
  } = usePanelData();

  const leaderboard = useMemo(
    () => buildLeaderboardForYearMonth(employees, integrations, deliveries, ym),
    [employees, integrations, deliveries, ym],
  );

  const myEmployeeId = findEmployeeIdByPanelSession(employees, currentUsername);
  const myEmployee = myEmployeeId
    ? employees.find((e) => e.id === myEmployeeId)
    : undefined;

  const canManageEmployees = isAdmin;

  function handleAvatarFileChange(file: File | null) {
    if (!file || !myEmployeeId) return;
    if (file.size > MAX_AVATAR_BYTES) return;
    const reader = new FileReader();
    reader.onload = () => {
      const url = typeof reader.result === "string" ? reader.result : "";
      if (url) updateEmployeeSelfAvatar(myEmployeeId, url);
    };
    reader.readAsDataURL(file);
  }

  function handleDeleteEmployee(row: LeaderboardRowMonthly) {
    if (!canManageEmployees) return;
    const emp = row.employee;
    const loginKey = (emp.panelLogin ?? emp.telegramUsername).trim();
    removeEmployee(emp.id);
    if (loginKey) void removeUserAccess(loginKey);
  }
  return (
    <div className="space-y-8 pb-10">
      <header className="flex flex-col gap-5 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex flex-col gap-1">
          <p className="text-[10px] font-semibold uppercase tracking-[0.22em] text-app-fg/40">
            Дашборд
          </p>
          <h1 className={dashboardPageTitleClass}>Сотрудники</h1>
        </div>

        <div className="flex flex-wrap items-end gap-3">
          <div className="flex min-w-0 flex-col gap-1">
            <label
              htmlFor="dashboard-month-employees"
              className="text-[10px] font-semibold uppercase tracking-wider text-app-fg/45"
            >
              Месяц
            </label>
            <div className={dashboardMonthPickerRowClass}>
              <button
                type="button"
                aria-label="Предыдущий месяц"
                onClick={() => setMonth(shiftYearMonth(ym, -1))}
                className={dashboardMonthNavButtonClass}
              >
                <ChevronLeft className="h-4 w-4" strokeWidth={1.75} />
              </button>
              <input
                id="dashboard-month-employees"
                type="month"
                value={monthInputValue}
                onChange={(e) => {
                  const v = e.target.value;
                  const parts = v.split("-").map(Number);
                  if (parts.length === 2 && parts[0] && parts[1]) {
                    setMonth({ year: parts[0], month: parts[1] });
                  }
                }}
                className={dashboardMonthInputClass}
              />
              <button
                type="button"
                aria-label="Следующий месяц"
                onClick={() => setMonth(shiftYearMonth(ym, 1))}
                className={dashboardMonthNavButtonClass}
              >
                <ChevronRight className="h-4 w-4" strokeWidth={1.75} />
              </button>
            </div>
          </div>
        </div>
      </header>

      {myEmployeeId && myEmployee ? (
        <div className={dashboardPanelClass}>
          <div className="flex flex-wrap items-center gap-4 px-5 py-4 sm:px-6">
            <EmployeeAvatar employee={myEmployee} size={56} />
            <div className="min-w-0 flex-1">
              <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-app-fg/55">
                Аватар
              </p>
              <label className="mt-2 inline-block cursor-pointer border border-app-fg/15 px-4 py-2 text-xs font-medium uppercase tracking-wide text-app-fg transition hover:border-app-fg/35">
                Загрузить
                <input
                  type="file"
                  accept="image/*"
                  className="sr-only"
                  onChange={(e) => handleAvatarFileChange(e.target.files?.[0] ?? null)}
                />
              </label>
            </div>
          </div>
        </div>
      ) : null}

      {employees.length === 0 ? (
        <p className="border border-dashed border-app-fg/15 px-4 py-10 text-center text-sm text-app-fg/55">
          Сотрудников пока нет.
          {isAdmin ? " Создайте учётную запись в разделе «Админ» → «Доступы»." : " Обратитесь к администратору."}
        </p>
      ) : (
        <div className={dashboardPanelClass}>
          <div className="px-5 py-4 sm:px-6">
            <h2 className="text-[11px] font-semibold uppercase tracking-[0.18em] text-app-fg/55">
              Лидерборд
            </h2>
          </div>
          <ul className={listDivideClass}>
            {leaderboard.map((row) => (
              <li
                key={row.employee.id}
                className="flex flex-wrap items-center gap-4 px-5 py-3.5 sm:px-6"
              >
                <span className="w-8 shrink-0 tabular-nums text-sm font-semibold text-app-fg/55">
                  {row.rank}
                </span>
                <EmployeeAvatar
                  employee={row.employee}
                  size={48}
                  showTopCrown={row.rank === 1}
                  showTitle
                />
                <div className="min-w-0 flex-1">
                  <p className="font-medium text-app-fg">{abbreviateFio(row.employee.fullName)}</p>
                  <p className="text-xs text-app-fg/50">
                    {(row.employee.panelLogin ?? row.employee.telegramUsername).toLowerCase()}
                  </p>
                </div>
                <div className="flex shrink-0 flex-wrap items-center gap-3 sm:gap-4">
                  <div className="flex shrink-0 flex-wrap gap-4 text-right text-xs tabular-nums text-app-fg/80">
                  <div>
                    <span className="block text-[10px] uppercase tracking-wider text-app-fg/45">
                      Интеграции
                    </span>
                    <span className="font-semibold text-app-fg">{row.integrations}</span>
                  </div>
                  <div>
                    <span className="block text-[10px] uppercase tracking-wider text-app-fg/45">
                      Доставки
                    </span>
                    <span className="font-semibold text-app-fg">{row.deliveries}</span>
                  </div>
                  <div>
                    <span className="block text-[10px] uppercase tracking-wider text-app-fg/45">
                      Всего
                    </span>
                    <span className="relative inline-block font-semibold tabular-nums text-app-fg">
                      {row.score}
                      {row.trend === "up" ? (
                        <ArrowUp
                          className="pointer-events-none absolute left-full top-1/2 ml-0.5 h-3.5 w-3.5 -translate-y-1/2 text-emerald-500"
                          strokeWidth={2.5}
                          aria-label={`Больше, чем в прошлом месяце (${row.scorePrevMonth})`}
                        />
                      ) : row.trend === "down" ? (
                        <ArrowDown
                          className="pointer-events-none absolute left-full top-1/2 ml-0.5 h-3.5 w-3.5 -translate-y-1/2 text-red-500"
                          strokeWidth={2.5}
                          aria-label={`Меньше, чем в прошлом месяце (${row.scorePrevMonth})`}
                        />
                      ) : null}
                    </span>
                  </div>
                  </div>
                  {canManageEmployees ? (
                    <ConfirmDeleteButton
                      onConfirm={() => handleDeleteEmployee(row)}
                      confirmLabel="Подтвердить удаление"
                      className="inline-flex shrink-0 items-center justify-center gap-1 border border-app-fg/15 px-2.5 py-1.5 text-[10px] font-semibold uppercase tracking-wide text-app-fg/55 transition hover:border-red-500/50 hover:text-red-400 sm:px-3 sm:text-xs"
                      confirmClassName="inline-flex shrink-0 items-center justify-center gap-1 border border-red-500/50 px-2.5 py-1.5 text-[10px] font-semibold uppercase tracking-wide text-red-400 sm:px-3 sm:text-xs"
                    >
                      <Trash2 className="h-3.5 w-3.5" strokeWidth={1.5} aria-hidden />
                      Удалить
                    </ConfirmDeleteButton>
                  ) : null}
                </div>
              </li>
            ))}
          </ul>
        </div>
      )}

    </div>
  );
}
