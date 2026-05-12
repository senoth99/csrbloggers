"use client";

import type { ReactNode } from "react";
import { ArrowDown, ArrowUp } from "lucide-react";

/** Мягкая оболочка секций: без жёсткой сетки, с лёгким фоном */
export const dashboardPanelClass =
  "bg-[linear-gradient(165deg,rgba(255,255,255,0.04)_0%,transparent_45%)] shadow-[inset_0_1px_0_0_rgba(255,255,255,0.06)]";

/** Еле заметная линия между строками в `<tbody>` */
export const tableBodyRowBorderClass = "border-b border-app-fg/[0.06]";

/** Линия под шапкой таблицы (отделить заголовки от данных) */
export const tableHeadRowBorderClass = "border-b border-app-fg/[0.08]";

/** Вертикальные разделители между элементами списка (`divide-y` на `<ul>` / колонке) */
export const listDivideClass = "divide-y divide-app-fg/[0.06]";

/** Зелёная основная кнопка (шапка списка, модалки): высота как у полей фильтра `min-h-[42px]` */
export const primaryActionButtonClass =
  "inline-flex min-h-[42px] items-center justify-center gap-2 bg-app-accent px-4 py-2.5 text-xs font-semibold uppercase tracking-wide text-app-fg transition hover:brightness-125";

/** Ряд выбора месяца: стрелки по высоте совпадают с полем (`items-stretch`) */
export const dashboardMonthPickerRowClass = "flex flex-wrap items-stretch gap-2";

export const dashboardMonthInputClass =
  "min-h-[40px] min-w-[10rem] border-0 bg-app-fg/[0.06] px-3 py-2 text-sm text-app-fg outline-none ring-1 ring-app-fg/10 focus:ring-2 focus:ring-app-accent/40";

export const dashboardMonthNavButtonClass =
  "inline-flex min-h-0 min-w-[40px] shrink-0 items-center justify-center text-app-fg/60 ring-1 ring-app-fg/10 transition hover:bg-app-fg/[0.04]";

/** У `<select>`: запас справа под системную стрелку, не впритык к рамке */
export const selectNativeChevronPad = "pr-9";

/** Заголовок блока — типографика, без цветной «полосы» */
export const dashboardSectionTitleClass =
  "text-[10px] font-semibold uppercase tracking-[0.22em] text-app-fg/45";

/** Главный заголовок страницы дашборда (Обзор, Интеграции, …) */
export const dashboardPageTitleClass =
  "mt-2 text-2xl font-semibold uppercase tracking-[0.12em] text-app-fg md:text-[1.65rem]";

/** Период под заголовком «Общий отчёт» */
export const dashboardReportPeriodClass =
  "mt-2 text-lg font-semibold uppercase tracking-[0.1em] text-app-fg sm:text-xl";

const cardInner = `relative flex min-h-[124px] flex-col overflow-hidden px-5 py-5 sm:min-h-[132px] sm:px-6 sm:py-6 ${dashboardPanelClass}`;

export function StatCard({
  label,
  value,
  subLabel,
  hint,
  accent,
  trend,
  trendPolarity = "default",
}: {
  label: string;
  value: ReactNode;
  subLabel?: ReactNode;
  hint?: string;
  accent?: "default" | "accent";
  /** К прошлому месяцу; при «same» стрелки нет */
  trend?: "up" | "down" | "same";
  /**
   * default — рост зелёный, падение красное.
   * inverse (CPM и т.п.) — рост красный, падение зелёное.
   */
  trendPolarity?: "default" | "inverse";
}) {
  const upClass =
    trendPolarity === "inverse" ? "text-red-500" : "text-emerald-500";
  const downClass =
    trendPolarity === "inverse" ? "text-emerald-500" : "text-red-500";

  return (
    <div
      className={
        accent === "accent"
          ? `${cardInner} ring-1 ring-app-accent/25`
          : cardInner
      }
    >
      <p className="shrink-0 text-left text-[10px] font-medium uppercase tracking-[0.18em] text-app-fg/40">
        {label}
      </p>
      {subLabel ? (
        <p className="mt-2 shrink-0 text-left text-xs font-medium tracking-wide text-app-fg/45">
          {subLabel}
        </p>
      ) : null}
      <div className="mt-auto flex flex-col items-start self-stretch pt-3">
        <div className="flex items-center gap-1">
          <div className="text-left text-2xl font-semibold tabular-nums tracking-tight text-app-fg sm:text-[1.65rem]">
            {value}
          </div>
          {trend === "up" ? (
            <ArrowUp
              className={`h-3 w-3 shrink-0 ${upClass}`}
              strokeWidth={2.5}
              aria-hidden
            />
          ) : trend === "down" ? (
            <ArrowDown
              className={`h-3 w-3 shrink-0 ${downClass}`}
              strokeWidth={2.5}
              aria-hidden
            />
          ) : null}
        </div>
        {hint ? (
          <p className="mt-2 text-left text-xs leading-snug text-app-fg/45">{hint}</p>
        ) : null}
      </div>
    </div>
  );
}

export function DistributionBars({
  entries,
}: {
  entries: { key: string; label: string; value: number; colorClass?: string }[];
}) {
  const max = Math.max(1, ...entries.map((e) => e.value));
  if (entries.length === 0) {
    return (
      <p className="py-10 text-center text-sm text-app-fg/40">
        Нет данных за период.
      </p>
    );
  }
  return (
    <ul className={listDivideClass}>
      {entries.map((e) => (
        <li key={e.key} className="py-3">
          <div className="mb-2 flex justify-between gap-4 text-xs text-app-fg/90 sm:text-[13px]">
            <span className="min-w-0 truncate font-medium">{e.label}</span>
            <span className="shrink-0 tabular-nums text-app-fg/50">{e.value}</span>
          </div>
          <div className="h-1.5 overflow-hidden bg-app-fg/[0.08]">
            <div
              className={`h-full transition-[width] duration-500 ${e.colorClass ?? "bg-app-accent"}`}
              style={{ width: `${(e.value / max) * 100}%` }}
            />
          </div>
        </li>
      ))}
    </ul>
  );
}

export function DashboardChartSection({
  title,
  children,
}: {
  title: string;
  children: ReactNode;
}) {
  return (
    <section className={`p-6 sm:p-8 ${dashboardPanelClass}`}>
      <div className="mb-6 sm:mb-7">
        <h2 className={dashboardSectionTitleClass}>{title}</h2>
      </div>
      {children}
    </section>
  );
}
