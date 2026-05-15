"use client";

import { useMemo, type ReactNode } from "react";
import { ArrowDown, ArrowUp } from "lucide-react";
import type { Integration } from "@/types/panel-data";
import {
  isAgreementIntegrationStatus,
  isPublishedIntegrationStatus,
} from "@/types/panel-data";
import {
  integrationsCreatedInMonth,
  monthOverMonthTrend,
  monthOverMonthTrendCpm,
  shiftYearMonth,
  type YearMonth,
} from "@/lib/dashboard-metrics";
import { computeCpmRub } from "@/lib/integration-metrics";
import { formatRuCpm, formatRuMoney } from "@/lib/format-ru";
import { DashboardChartSection } from "@/screens/dashboard-shared";
import { SortHeaderButton } from "@/components/SortableTh";
import { useTableSort } from "@/hooks/useTableSort";
import { compareNumbers, compareStringsRu } from "@/lib/table-sort";

const nf = new Intl.NumberFormat("ru-RU");
const nfReach = new Intl.NumberFormat("ru-RU", { maximumFractionDigits: 0 });

/** Единая сетка: площадка + 5 метрик; вертикальные линии не используем */
const rowGridClass =
  "grid grid-cols-[minmax(7.5rem,10rem)_repeat(5,minmax(4rem,1fr))] gap-x-3 gap-y-1 sm:gap-x-5";

/** Горизонтальные разделители строк отчёта (чуть заметнее общего listDivide) */
const reportRowDivideClass = "divide-y divide-app-fg/10";

const headerLabelClass =
  "text-[10px] font-semibold uppercase tracking-[0.16em] text-app-fg/42";

const cellValueClass =
  "text-sm font-semibold tabular-nums text-app-fg sm:text-[15px]";

function CellWithTrend({
  children,
  trend,
  trendPolarity = "default",
}: {
  children: ReactNode;
  trend: "up" | "down" | "same";
  /** inverse — для CPM: рост красный, падение зелёное */
  trendPolarity?: "default" | "inverse";
}) {
  const upClass =
    trendPolarity === "inverse" ? "text-red-500" : "text-emerald-500";
  const downClass =
    trendPolarity === "inverse" ? "text-emerald-500" : "text-red-500";
  return (
    <div className={`${cellValueClass} flex min-w-0 items-center gap-0.5`}>
      <span className="min-w-0">{children}</span>
      {trend === "up" ? (
        <ArrowUp className={`h-3 w-3 shrink-0 ${upClass}`} strokeWidth={2.5} aria-hidden />
      ) : trend === "down" ? (
        <ArrowDown className={`h-3 w-3 shrink-0 ${downClass}`} strokeWidth={2.5} aria-hidden />
      ) : null}
    </div>
  );
}

const PLATFORM_ROWS: { id: string; label: string }[] = [
  { id: "tiktok", label: "TikTok" },
  { id: "twitch", label: "Twitch" },
  { id: "inst", label: "Инста / UGC" },
  { id: "tg", label: "Telegram" },
  { id: "youtube", label: "YouTube" },
];

function countIntegrationMonthByPlatform(
  rows: Integration[],
  platformId: string,
): number {
  return rows.filter(
    (i) => i.socialNetworkId === platformId && isPublishedIntegrationStatus(i.status),
  ).length;
}

function agreementsMonthByPlatform(
  rows: Integration[],
  platformId: string,
): number {
  return rows.filter(
    (i) => i.socialNetworkId === platformId && isAgreementIntegrationStatus(i.status),
  ).length;
}

function aggregateBudgetReachForPlatform(
  rows: Integration[],
  platformId: string,
): { budget: number; reach: number; hasBudget: boolean; hasReach: boolean } {
  let budget = 0;
  let reach = 0;
  let hasBudget = false;
  let hasReach = false;
  for (const i of rows) {
    if (i.socialNetworkId !== platformId) continue;
    if (i.budget != null && Number.isFinite(i.budget)) {
      hasBudget = true;
      budget += i.budget;
    }
    if (i.reach != null && Number.isFinite(i.reach)) {
      hasReach = true;
      reach += i.reach;
    }
  }
  return { budget, reach, hasBudget, hasReach };
}

type Props = {
  ym: YearMonth;
  integrations: Integration[];
};

type ReportSortKey = "label" | "budget" | "reach" | "cpm" | "published" | "agreements";

export function DashboardGeneralReportTable({ ym, integrations }: Props) {
  const { sort, toggleSort, sortKey, sortDir } = useTableSort<ReportSortKey>();

  const ymPrev = useMemo(() => shiftYearMonth(ym, -1), [ym]);

  const inMonth = useMemo(
    () => integrationsCreatedInMonth(integrations, ym),
    [integrations, ym],
  );

  const inMonthPrev = useMemo(
    () => integrationsCreatedInMonth(integrations, ymPrev),
    [integrations, ymPrev],
  );

  const bodyRows = useMemo(() => {
    return PLATFORM_ROWS.map(({ id, label }) => {
      const { budget, reach, hasBudget, hasReach } =
        aggregateBudgetReachForPlatform(inMonth, id);
      const { reach: reachPrev } = aggregateBudgetReachForPlatform(inMonthPrev, id);
      const published = countIntegrationMonthByPlatform(inMonth, id);
      const publishedPrev = countIntegrationMonthByPlatform(inMonthPrev, id);
      const agreements = agreementsMonthByPlatform(inMonth, id);
      const agreementsPrev = agreementsMonthByPlatform(inMonthPrev, id);
      const prevAgg = aggregateBudgetReachForPlatform(inMonthPrev, id);
      const cpm = hasBudget ? computeCpmRub(budget, reach) : undefined;
      const cpmPrev = prevAgg.hasBudget
        ? computeCpmRub(prevAgg.budget, prevAgg.reach)
        : undefined;
      return {
        id,
        label,
        published,
        agreements,
        budget,
        reach,
        hasBudget,
        hasReach,
        cpm,
        trendReach: monthOverMonthTrend(reach, reachPrev),
        trendCpm: monthOverMonthTrendCpm(cpm, cpmPrev),
        trendPublished: monthOverMonthTrend(published, publishedPrev),
        trendAgreements: monthOverMonthTrend(agreements, agreementsPrev),
      };
    });
  }, [inMonth, inMonthPrev]);

  const sortedBodyRows = useMemo(() => {
    const rows = [...bodyRows];
    if (!sort) return rows;
    const m = sort.dir === "asc" ? 1 : -1;
    rows.sort((a, b) => {
      let cmp = 0;
      switch (sort.key) {
        case "label":
          cmp = compareStringsRu(a.label, b.label);
          break;
        case "budget":
          cmp = compareNumbers(a.budget, b.budget);
          break;
        case "reach":
          cmp = compareNumbers(a.reach, b.reach);
          break;
        case "cpm": {
          const va = a.cpm ?? -1;
          const vb = b.cpm ?? -1;
          cmp = compareNumbers(va, vb);
          break;
        }
        case "published":
          cmp = compareNumbers(a.published, b.published);
          break;
        case "agreements":
          cmp = compareNumbers(a.agreements, b.agreements);
          break;
        default:
          break;
      }
      if (cmp !== 0) return m * cmp;
      return compareStringsRu(a.id, b.id);
    });
    return rows;
  }, [bodyRows, sort]);

  const totals = useMemo(() => {
    let published = 0;
    let agreements = 0;
    let budget = 0;
    let reach = 0;
    let hasBudget = false;
    let hasReach = false;
    let publishedPrev = 0;
    let agreementsPrev = 0;
    let reachPrev = 0;
    let budgetPrev = 0;
    let hasBudgetPrev = false;
    for (const r of bodyRows) {
      published += r.published;
      agreements += r.agreements;
      if (r.hasBudget) hasBudget = true;
      if (r.hasReach) hasReach = true;
      budget += r.budget;
      reach += r.reach;
    }
    for (const { id } of PLATFORM_ROWS) {
      publishedPrev += countIntegrationMonthByPlatform(inMonthPrev, id);
      agreementsPrev += agreementsMonthByPlatform(inMonthPrev, id);
      const aPrev = aggregateBudgetReachForPlatform(inMonthPrev, id);
      reachPrev += aPrev.reach;
      budgetPrev += aPrev.budget;
      if (aPrev.hasBudget) hasBudgetPrev = true;
    }
    const cpmTotal = hasBudget ? computeCpmRub(budget, reach) : undefined;
    const cpmTotalPrev = hasBudgetPrev
      ? computeCpmRub(budgetPrev, reachPrev)
      : undefined;
    return {
      published,
      agreements,
      budget,
      reach,
      hasBudget,
      hasReach,
      cpmTotal,
      trendReach: monthOverMonthTrend(reach, reachPrev),
      trendCpm: monthOverMonthTrendCpm(cpmTotal, cpmTotalPrev),
      trendPublished: monthOverMonthTrend(published, publishedPrev),
      trendAgreements: monthOverMonthTrend(agreements, agreementsPrev),
    };
  }, [bodyRows, inMonthPrev]);

  return (
    <DashboardChartSection title="Общий отчёт">
      <div className="-mx-1 overflow-x-auto px-1">
        <div className="min-w-[34rem] sm:min-w-0">
          <div className={`${rowGridClass} border-b border-app-fg/10 pb-3`}>
            <div className={headerLabelClass}>
              <SortHeaderButton
                active={sortKey === "label"}
                sortDir={sortDir}
                onClick={() => toggleSort("label")}
              >
                Площадка
              </SortHeaderButton>
            </div>
            <div className={`${headerLabelClass} text-left`}>
              <SortHeaderButton
                active={sortKey === "budget"}
                sortDir={sortDir}
                align="left"
                onClick={() => toggleSort("budget")}
              >
                Бюджет
              </SortHeaderButton>
            </div>
            <div className={`${headerLabelClass} text-left`}>
              <SortHeaderButton
                active={sortKey === "reach"}
                sortDir={sortDir}
                align="left"
                onClick={() => toggleSort("reach")}
              >
                Охваты
              </SortHeaderButton>
            </div>
            <div className={`${headerLabelClass} text-left`}>
              <SortHeaderButton
                active={sortKey === "cpm"}
                sortDir={sortDir}
                align="left"
                onClick={() => toggleSort("cpm")}
              >
                CPM
              </SortHeaderButton>
            </div>
            <div className={`${headerLabelClass} text-left leading-tight`}>
              <SortHeaderButton
                active={sortKey === "published"}
                sortDir={sortDir}
                align="left"
                onClick={() => toggleSort("published")}
              >
                Опубликовано
              </SortHeaderButton>
            </div>
            <div className={`${headerLabelClass} text-left leading-tight`}>
              <SortHeaderButton
                active={sortKey === "agreements"}
                sortDir={sortDir}
                align="left"
                onClick={() => toggleSort("agreements")}
              >
                Договорённости
              </SortHeaderButton>
            </div>
          </div>

          <div className={`flex flex-col ${reportRowDivideClass}`}>
            {sortedBodyRows.map((row) => (
              <div
                key={row.id}
                className={`${rowGridClass} items-center py-3.5 sm:py-4`}
              >
                <div className="text-[15px] font-semibold leading-snug text-app-fg">
                  {row.label}
                </div>
                <div className={cellValueClass}>
                  {row.hasBudget ? `${formatRuMoney(row.budget)} ₽` : "—"}
                </div>
                <CellWithTrend trend={row.trendReach}>
                  {row.hasReach ? nfReach.format(row.reach) : "—"}
                </CellWithTrend>
                <CellWithTrend trend={row.trendCpm} trendPolarity="inverse">
                  {row.cpm != null ? `${formatRuCpm(row.cpm)} ₽` : "—"}
                </CellWithTrend>
                <CellWithTrend trend={row.trendPublished}>
                  {nf.format(row.published)}
                </CellWithTrend>
                <CellWithTrend trend={row.trendAgreements}>
                  {nf.format(row.agreements)}
                </CellWithTrend>
              </div>
            ))}

            <div
              className={`${rowGridClass} items-center bg-app-accent/12 px-3 py-4 sm:px-4 sm:py-5`}
            >
              <div className="text-[15px] font-bold uppercase tracking-[0.1em] text-app-fg">
                Итого
              </div>
              <div className={cellValueClass}>
                {totals.hasBudget ? `${formatRuMoney(totals.budget)} ₽` : "—"}
              </div>
              <CellWithTrend trend={totals.trendReach}>
                {totals.hasReach ? nfReach.format(totals.reach) : "—"}
              </CellWithTrend>
              <CellWithTrend trend={totals.trendCpm} trendPolarity="inverse">
                {totals.cpmTotal != null ? `${formatRuCpm(totals.cpmTotal)} ₽` : "—"}
              </CellWithTrend>
              <CellWithTrend trend={totals.trendPublished}>
                {nf.format(totals.published)}
              </CellWithTrend>
              <CellWithTrend trend={totals.trendAgreements}>
                {nf.format(totals.agreements)}
              </CellWithTrend>
            </div>
          </div>
        </div>
      </div>
    </DashboardChartSection>
  );
}
