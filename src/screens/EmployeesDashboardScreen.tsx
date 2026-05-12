"use client";

import { useMemo, useState, type FormEvent } from "react";
import { ArrowDown, ArrowUp, ChevronLeft, ChevronRight, Plus, Trash2, X } from "lucide-react";
import { useAuth, SUPERADMIN_LOGIN, normalizeUsername } from "@/context/AuthContext";
import { usePanelData } from "@/context/PanelDataContext";
import { EmployeeAvatar } from "@/components/EmployeeAvatar";
import {
  abbreviateFio,
  buildLeaderboardForYearMonth,
  findEmployeeIdByPanelSession,
  normalizeTelegramUsername,
  type LeaderboardRowMonthly,
} from "@/lib/employee-utils";
import { shiftYearMonth } from "@/lib/dashboard-metrics";
import { useDashboardMonth } from "@/hooks/useDashboardMonth";
import {
  dashboardMonthInputClass,
  dashboardMonthNavButtonClass,
  dashboardMonthPickerRowClass,
  dashboardPageTitleClass,
  dashboardPanelClass,
  listDivideClass,
  primaryActionButtonClass,
} from "@/screens/dashboard-shared";

const MAX_AVATAR_BYTES = 2_500_000;

export function EmployeesDashboardScreen() {
  const { ym, setMonth, monthInputValue } = useDashboardMonth();
  const { currentUsername, role, createPanelAccount, removeUserAccess } = useAuth();
  const {
    employees,
    integrations,
    deliveries,
    isAdmin,
    addEmployee,
    updateEmployeeSelfAvatar,
    removeEmployee,
  } = usePanelData();

  const [isAccountOpen, setIsAccountOpen] = useState(false);
  const [accLogin, setAccLogin] = useState("");
  const [accPassword, setAccPassword] = useState("");
  const [accRole, setAccRole] = useState<"admin" | "user">("user");
  const [accFormError, setAccFormError] = useState<string | null>(null);

  const leaderboard = useMemo(
    () => buildLeaderboardForYearMonth(employees, integrations, deliveries, ym),
    [employees, integrations, deliveries, ym],
  );

  const myEmployeeId = findEmployeeIdByPanelSession(employees, currentUsername);
  const myEmployee = myEmployeeId
    ? employees.find((e) => e.id === myEmployeeId)
    : undefined;

  const canCreateAccounts =
    normalizeUsername(currentUsername ?? "") === SUPERADMIN_LOGIN && role === "superadmin";

  async function handleCreateAccount(e: FormEvent) {
    e.preventDefault();
    setAccFormError(null);
    if (!canCreateAccounts) return;
    const loginNorm = normalizeUsername(accLogin);
    if (!loginNorm || loginNorm === SUPERADMIN_LOGIN || !accPassword.trim()) {
      setAccFormError("Укажите логин и пароль.");
      return;
    }
    if (
      employees.some(
        (em) =>
          normalizeTelegramUsername(em.telegramUsername) === loginNorm ||
          (em.panelLogin?.trim() && normalizeTelegramUsername(em.panelLogin) === loginNorm),
      )
    ) {
      setAccFormError("Сотрудник с таким логином уже есть.");
      return;
    }

    const displayName =
      loginNorm.length > 0 ? loginNorm.charAt(0).toUpperCase() + loginNorm.slice(1) : loginNorm;
    const empId = addEmployee({
      fullName: displayName,
      telegramUsername: loginNorm,
      panelLogin: loginNorm,
    });
    if (!empId) {
      setAccFormError("Не удалось создать карточку сотрудника.");
      return;
    }

    const ok = await createPanelAccount({
      login: loginNorm,
      password: accPassword,
      role: accRole,
      employeeId: empId,
    });
    if (!ok) {
      removeEmployee(empId);
      setAccFormError("Не удалось создать аккаунт: логин уже занят или ошибка данных.");
      return;
    }

    setIsAccountOpen(false);
    setAccLogin("");
    setAccPassword("");
    setAccRole("user");
  }

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

  function handleOpenAccountModal() {
    setAccFormError(null);
    setIsAccountOpen(true);
  }

  function handleDeleteEmployee(row: LeaderboardRowMonthly) {
    if (!canCreateAccounts) return;
    const emp = row.employee;
    const label = abbreviateFio(emp.fullName);
    const loginKey = (emp.panelLogin ?? emp.telegramUsername).trim();
    if (
      !window.confirm(
        `Удалить сотрудника «${label}»?${loginKey ? ` Учётная запись «${loginKey}» будет отключена.` : ""}`,
      )
    ) {
      return;
    }
    removeEmployee(emp.id);
    if (loginKey) removeUserAccess(loginKey);
  }
  return (
    <div className="space-y-8 pb-10">
      <header className="flex flex-col gap-5 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="mb-1 text-[10px] font-semibold uppercase tracking-[0.2em] text-app-fg/45">
            Дашборд
          </p>
          <h1 className={dashboardPageTitleClass}>Сотрудники</h1>
        </div>

        <div className="flex flex-wrap items-end gap-3">
          {canCreateAccounts ? (
            <button
              type="button"
              onClick={handleOpenAccountModal}
              className={`${primaryActionButtonClass}`}
            >
              <Plus className="h-4 w-4" strokeWidth={1.5} />
              Аккаунт
            </button>
          ) : null}

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
        canCreateAccounts ? (
          <p className="border border-dashed border-app-fg/15 px-4 py-10 text-center text-sm text-app-fg/55">
            Сотрудников пока нет. Нажмите «+ Аккаунт», введите логин и пароль — так создаётся и
            учётная запись, и карточка в лидерборде.
          </p>
        ) : isAdmin ? (
          <p className="border border-dashed border-app-fg/15 px-4 py-10 text-center text-sm text-app-fg/55">
            Сотрудников пока нет. Добавить учётные записи может только суперадмин.
          </p>
        ) : (
          <p className="border border-dashed border-app-fg/15 px-4 py-10 text-center text-sm text-app-fg/55">
            Сотрудников пока нет. Обратитесь к суперадмину.
          </p>
        )
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
                  {canCreateAccounts ? (
                    <button
                      type="button"
                      onClick={() => handleDeleteEmployee(row)}
                      className="inline-flex shrink-0 items-center justify-center gap-1 border border-app-fg/15 px-2.5 py-1.5 text-[10px] font-semibold uppercase tracking-wide text-app-fg/55 transition hover:border-red-500/50 hover:text-red-400 sm:px-3 sm:text-xs"
                      aria-label={`Удалить сотрудника ${abbreviateFio(row.employee.fullName)}`}
                    >
                      <Trash2 className="h-3.5 w-3.5" strokeWidth={1.5} />
                      Удалить
                    </button>
                  ) : null}
                </div>
              </li>
            ))}
          </ul>
        </div>
      )}

      {isAccountOpen && canCreateAccounts ? (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 px-4 py-8"
          role="presentation"
          onClick={() => {
            setIsAccountOpen(false);
            setAccFormError(null);
          }}
        >
          <div
            role="dialog"
            aria-modal="true"
            className="w-full max-w-md border border-app-fg/15 bg-app-bg p-5 shadow-accent-glow sm:p-6"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="mb-4 flex items-start justify-between gap-3">
              <h2 className="text-sm font-semibold uppercase tracking-[0.12em] text-app-fg">
                Новый сотрудник
              </h2>
              <button
                type="button"
                onClick={() => {
                  setIsAccountOpen(false);
                  setAccFormError(null);
                }}
                className="border border-app-fg/15 p-1.5 text-app-fg/70 transition hover:border-app-fg/40"
                aria-label="Закрыть"
              >
                <X className="h-4 w-4" strokeWidth={1.5} />
              </button>
            </div>
            <form onSubmit={handleCreateAccount} className="space-y-3">
              <label className="block text-xs uppercase tracking-wider text-app-fg/55">
                Логин (вход в панель)
                <input
                  value={accLogin}
                  onChange={(e) => setAccLogin(e.target.value)}
                  required
                  autoComplete="off"
                  className="mt-1 w-full border border-app-fg/15 bg-app-bg px-3 py-2.5 text-sm text-app-fg outline-none ring-app-accent/35 focus:ring-2"
                />
              </label>
              <label className="block text-xs uppercase tracking-wider text-app-fg/55">
                Пароль
                <input
                  type="password"
                  value={accPassword}
                  onChange={(e) => setAccPassword(e.target.value)}
                  required
                  autoComplete="new-password"
                  className="mt-1 w-full border border-app-fg/15 bg-app-bg px-3 py-2.5 text-sm text-app-fg outline-none ring-app-accent/35 focus:ring-2"
                />
              </label>
              <label className="block text-xs uppercase tracking-wider text-app-fg/55">
                Роль в панели
                <select
                  value={accRole}
                  onChange={(e) => setAccRole(e.target.value as "admin" | "user")}
                  className="mt-1 w-full border border-app-fg/15 bg-app-bg px-3 py-2.5 text-sm text-app-fg outline-none ring-app-accent/35 focus:ring-2"
                >
                  <option value="user">Пользователь</option>
                  <option value="admin">Админ</option>
                </select>
              </label>
              {accFormError ? <p className="text-xs text-app-fg/80">{accFormError}</p> : null}
              <button type="submit" className={`${primaryActionButtonClass} w-full`}>
                Создать сотрудника
              </button>
            </form>
          </div>
        </div>
      ) : null}
    </div>
  );
}
