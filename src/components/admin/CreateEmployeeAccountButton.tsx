"use client";

import { useState, type FormEvent } from "react";
import { Plus, X } from "lucide-react";
import { SUPERADMIN_LOGIN, normalizeUsername, useAuth } from "@/context/AuthContext";
import { usePanelData } from "@/context/PanelDataContext";
import { normalizeTelegramUsername } from "@/lib/employee-utils";
import { primaryActionButtonClass } from "@/screens/dashboard-shared";

export function CreateEmployeeAccountButton({ className = "" }: { className?: string }) {
  const { createPanelAccount } = useAuth();
  const { employees, addEmployee, removeEmployee } = usePanelData();

  const [open, setOpen] = useState(false);
  const [login, setLogin] = useState("");
  const [password, setPassword] = useState("");
  const [accRole, setAccRole] = useState<"admin" | "user">("user");
  const [formError, setFormError] = useState<string | null>(null);

  function close() {
    setOpen(false);
    setFormError(null);
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setFormError(null);
    const loginNorm = normalizeUsername(login);
    if (!loginNorm || loginNorm === SUPERADMIN_LOGIN || !password.trim()) {
      setFormError("Укажите логин и пароль.");
      return;
    }
    if (
      employees.some(
        (em) =>
          normalizeTelegramUsername(em.telegramUsername) === loginNorm ||
          (em.panelLogin?.trim() && normalizeTelegramUsername(em.panelLogin) === loginNorm),
      )
    ) {
      setFormError("Сотрудник с таким логином уже есть.");
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
      setFormError("Не удалось создать карточку сотрудника.");
      return;
    }

    const ok = await createPanelAccount({
      login: loginNorm,
      password,
      role: accRole,
      employeeId: empId,
    });
    if (!ok) {
      removeEmployee(empId);
      setFormError("Не удалось создать аккаунт: логин уже занят или ошибка данных.");
      return;
    }

    close();
    setLogin("");
    setPassword("");
    setAccRole("user");
  }

  return (
    <>
      <button
        type="button"
        onClick={() => {
          setFormError(null);
          setOpen(true);
        }}
        className={[primaryActionButtonClass, className].filter(Boolean).join(" ")}
      >
        <Plus className="h-4 w-4" strokeWidth={1.5} />
        Аккаунт
      </button>

      {open ? (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 px-4 py-8"
          role="presentation"
          onClick={close}
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
                onClick={close}
                className="border border-app-fg/15 p-1.5 text-app-fg/70 transition hover:border-app-fg/40"
                aria-label="Закрыть"
              >
                <X className="h-4 w-4" strokeWidth={1.5} />
              </button>
            </div>
            <form onSubmit={handleSubmit} className="space-y-3">
              <label className="block text-xs uppercase tracking-wider text-app-fg/55">
                Логин (вход в панель)
                <input
                  value={login}
                  onChange={(e) => setLogin(e.target.value)}
                  required
                  autoComplete="off"
                  className="mt-1 w-full border border-app-fg/15 bg-app-bg px-3 py-2.5 text-sm text-app-fg outline-none ring-app-accent/35 focus:ring-2"
                />
              </label>
              <label className="block text-xs uppercase tracking-wider text-app-fg/55">
                Пароль
                <input
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
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
              {formError ? <p className="text-xs text-app-fg/80">{formError}</p> : null}
              <button type="submit" className={`${primaryActionButtonClass} w-full`}>
                Создать сотрудника
              </button>
            </form>
          </div>
        </div>
      ) : null}
    </>
  );
}
