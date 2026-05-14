"use client";

import { Plus, Trash2 } from "lucide-react";
import { useEffect, useMemo, useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { SortableTh } from "@/components/SortableTh";
import { useTableSort } from "@/hooks/useTableSort";
import { compareNumbers, compareStringsRu } from "@/lib/table-sort";
import {
  SUPERADMIN_LOGIN,
  useAuth,
  normalizeUsername,
  type UserRole,
} from "@/context/AuthContext";
import { tableBodyRowBorderClass, tableHeadRowBorderClass } from "@/screens/dashboard-shared";
import { usePanelData } from "@/context/PanelDataContext";

type AdminUserSortKey = "username" | "role";

function roleRank(role: UserRole): number {
  if (role === "superadmin") return 2;
  if (role === "admin") return 1;
  return 0;
}

export function AdminScreen() {
  const { sort, toggleSort, sortKey, sortDir } = useTableSort<AdminUserSortKey>();
  const {
    role,
    hydrated,
    users,
    removeUserAccess,
  } = useAuth();
  const router = useRouter();
  const {
    nicheOptions,
    addNicheOption,
    updateNicheOption,
    removeNicheOption,
  } = usePanelData();
  const [newNiche, setNewNiche] = useState("");

  const sortedUsers = useMemo(() => {
    const rows = [...users];
    if (!sort) return rows;
    const m = sort.dir === "asc" ? 1 : -1;
    rows.sort((a, b) => {
      let cmp = 0;
      if (sort.key === "username") {
        cmp = compareStringsRu(a.login, b.login);
      } else {
        cmp = compareNumbers(roleRank(a.role), roleRank(b.role));
      }
      if (cmp !== 0) return m * cmp;
      return compareStringsRu(a.login, b.login);
    });
    return rows;
  }, [users, sort]);

  useEffect(() => {
    if (!hydrated) return;
    if (role !== "admin" && role !== "superadmin") {
      router.replace("/dashboard");
    }
  }, [hydrated, role, router]);

  if (!hydrated) {
    return (
      <div className="text-center text-sm text-app-fg/55" style={{ color: "rgba(255,255,255,0.55)" }}>
        Загрузка…
      </div>
    );
  }

  if (role !== "admin" && role !== "superadmin") {
    return (
      <div className="text-center text-sm text-app-fg/55">Перенаправление…</div>
    );
  }

  const onAdminUserSort = (key: string) => toggleSort(key as AdminUserSortKey);

  function handleAddNiche(e: FormEvent) {
    e.preventDefault();
    if (!newNiche.trim()) return;
    addNicheOption(newNiche);
    setNewNiche("");
  }

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-xl font-bold uppercase tracking-[0.12em] text-app-fg md:text-2xl">
          Админка
        </h1>
        <p className="mt-2 text-sm text-app-fg/55">
          Справочники и список учётных записей панели (логин и роль)
        </p>
      </div>

      <section className="border border-app-fg/15 bg-app-bg p-4 md:p-5">
        <h2 className="text-sm font-semibold uppercase tracking-[0.15em] text-app-fg">
          Ниши контрагентов
        </h2>
        <p className="mt-1 text-xs text-app-fg/55">
          Справочник для выбора ниши в карточке контрагента. Можно оставить пустым.
        </p>
        <form onSubmit={handleAddNiche} className="mt-4 flex flex-col gap-2 sm:flex-row">
          <input
            value={newNiche}
            onChange={(e) => setNewNiche(e.target.value)}
            placeholder="Например: Lifestyle"
            className="min-w-0 flex-1 border border-app-fg/15 bg-app-bg px-4 py-2.5 text-sm uppercase text-app-fg outline-none ring-app-accent/35 focus:ring-2"
          />
          <button
            type="submit"
            className="inline-flex shrink-0 items-center justify-center gap-2 bg-app-accent px-4 py-2.5 text-sm font-semibold uppercase tracking-wide text-app-fg transition hover:brightness-125"
          >
            <Plus className="h-4 w-4" strokeWidth={1.5} />
            Добавить нишу
          </button>
        </form>
        <ul className="mt-6 space-y-5">
          {nicheOptions.map((o) => (
            <li
              key={o.id}
              className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between"
            >
              <div className="flex min-w-0 flex-1 flex-col gap-1 sm:flex-row sm:items-center sm:gap-3">
                <span className="shrink-0 text-[11px] uppercase tracking-wider text-app-fg/55">
                  {o.id}
                </span>
                <input
                  defaultValue={o.label}
                  key={`${o.id}-${o.label}`}
                  onBlur={(e) => {
                    const v = e.target.value.trim();
                    if (v && v !== o.label) updateNicheOption(o.id, v);
                  }}
                  className="min-w-0 flex-1 border border-app-fg/15 bg-app-bg px-3 py-2 text-sm uppercase text-app-fg outline-none ring-app-accent/35 focus:ring-2"
                />
              </div>
              <button
                type="button"
                onClick={() => removeNicheOption(o.id)}
                className="inline-flex shrink-0 items-center justify-center gap-1 border border-app-fg/15 px-3 py-2 text-xs text-app-fg/55 transition hover:border-app-fg/50"
              >
                <Trash2 className="h-3.5 w-3.5" strokeWidth={1.5} />
                Удалить
              </button>
            </li>
          ))}
        </ul>
      </section>

      <section className="border border-app-fg/15 bg-app-bg p-4 md:p-5">
        <h2 className="text-sm font-semibold uppercase tracking-[0.15em] text-app-fg">
          Доступы
        </h2>
        <p className="mt-1 text-xs text-app-fg/55">
          Создание сотрудников (логин и пароль) — только суперадмин в дашборде «Сотрудники», кнопка «+ Аккаунт».
          Логин суперадмина: <span className="text-app-fg">{SUPERADMIN_LOGIN}</span>.
        </p>

        <div className="mt-6 overflow-x-auto">
          <table className="w-full min-w-[480px] border-separate border-spacing-0 text-left text-sm text-app-fg">
            <thead>
              <tr
                className={`text-[10px] font-semibold uppercase tracking-wide text-app-fg/50 ${tableHeadRowBorderClass}`}
              >
                <SortableTh
                  columnKey="username"
                  sortKey={sortKey}
                  sortDir={sortDir}
                  onSort={onAdminUserSort}
                  className="px-3 py-2.5"
                >
                  Пользователь
                </SortableTh>
                <SortableTh
                  columnKey="role"
                  sortKey={sortKey}
                  sortDir={sortDir}
                  onSort={onAdminUserSort}
                  className="px-3 py-2.5"
                >
                  Роль
                </SortableTh>
                <th scope="col" className="w-[120px] px-3 py-2.5 text-right align-middle">
                  <span className="sr-only">Действия</span>
                </th>
              </tr>
            </thead>
            <tbody>
              {sortedUsers.map((u) => {
                const isSuper = normalizeUsername(u.login) === SUPERADMIN_LOGIN;
                return (
                  <tr
                    key={u.login}
                    className={`transition hover:bg-app-fg/[0.04] ${tableBodyRowBorderClass}`}
                  >
                    <td className="px-3 py-3 align-middle">
                      <span className="font-medium text-app-fg">{u.login}</span>
                    </td>
                    <td className="px-3 py-3 align-middle">
                      <span className="inline-flex border border-app-fg/15 px-2 py-0.5 text-[11px] uppercase tracking-wide text-app-fg/55">
                        {u.role === "superadmin"
                          ? "Суперадмин"
                          : u.role === "admin"
                            ? "Админ"
                            : "Юзер"}
                      </span>
                    </td>
                    <td className="px-3 py-3 text-right align-middle">
                      {!isSuper ? (
                        <button
                          type="button"
                          onClick={() => void removeUserAccess(u.login)}
                          className="inline-flex items-center gap-1 border border-app-fg/15 px-3 py-1.5 text-xs text-app-fg/55 transition hover:border-app-fg/50"
                        >
                          <Trash2 className="h-3.5 w-3.5" strokeWidth={1.5} />
                          Убрать
                        </button>
                      ) : null}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}
