"use client";

import { useEffect, useMemo } from "react";
import { ChevronLeft, ChevronRight, Download } from "lucide-react";
import { usePanelData } from "@/context/PanelDataContext";
import { usePromocodesCtx } from "@/context/PromocodesContext";
import {
  DELIVERY_STATUS_LABELS,
  INTEGRATION_STATUS_LABELS,
} from "@/types/panel-data";
import {
  aggregateCpmForMonth,
  DASHBOARD_EMPTY_VALUE,
  deliveriesCreatedInMonth,
  formatYearMonthString,
  integrationReachByCalendarDayInMonth,
  integrationsHaveAnyBudget,
  integrationsHaveAnyPromoActivations,
  integrationsHaveAnyReach,
  integrationsPublishedInMonth,
  monthOverMonthTrend,
  monthOverMonthTrendCpm,
  shiftYearMonth,
  sumIntegrationBudget,
  sumIntegrationReach,
  sumPromoActivations,
} from "@/lib/dashboard-metrics";
import { formatRuCpm, formatRuMoney } from "@/lib/format-ru";
import { ReachByDayBarChart } from "@/components/ReachByDayBarChart";
import { downloadUtf8Csv, rowsToCsv } from "@/lib/csv-export";
import { DashboardGeneralReportTable } from "@/components/DashboardGeneralReportTable";
import { DashboardTopBloggers } from "@/components/dashboard/DashboardTopBloggers";
import { DashboardPromocodesPanel } from "@/components/dashboard/DashboardPromocodesPanel";
import { useDashboardMonth } from "@/hooks/useDashboardMonth";
import {
  DashboardChartSection,
  StatCard,
  crmPageHeaderRowClass,
  dashboardHeaderActionsRowClass,
  crmPageTitleClass,
  dashboardMonthInputClass,
  dashboardMonthNavButtonClass,
  dashboardMonthPickerRowClass,
  dashboardPageStackClass,
  primaryActionButtonClass,
} from "@/screens/dashboard-shared";

const nfKpi = new Intl.NumberFormat("ru-RU", { maximumFractionDigits: 0 });

export function DashboardScreen() {
  const {
    contractors,
    integrations,
    deliveries,
    socialOptions,
    recordPromocodeSnapshot,
    promocodeSnapshots,
  } = usePanelData();
  const { items: promoItems, fetchedAt: promoFetchedAt } = usePromocodesCtx();
  const { ym, setMonth, monthInputValue } = useDashboardMonth();

  const ymPrev = useMemo(() => shiftYearMonth(ym, -1), [ym]);

  useEffect(() => {
    if (!promoFetchedAt || promoItems.length === 0) return;
    recordPromocodeSnapshot(promoItems, promoFetchedAt);
  }, [promoFetchedAt, promoItems, recordPromocodeSnapshot]);

  const monthKey = `${ym.year}-${String(ym.month).padStart(2, "0")}`;
  const promoDeltaByCodeKey = useMemo(() => {
    const start = new Date(`${monthKey}-01T00:00:00.000Z`).getTime();
    const end = shiftYearMonth(ym, 1);
    const endKey = `${end.year}-${String(end.month).padStart(2, "0")}`;
    const endMs = new Date(`${endKey}-01T00:00:00.000Z`).getTime();

    const first = new Map<string, { t: number; activations: number }>();
    const last = new Map<string, { t: number; activations: number }>();

    for (const row of promocodeSnapshots) {
      if (row.t < start || row.t >= endMs) continue;
      const k = row.codeKey;
      const f = first.get(k);
      if (!f || row.t < f.t) first.set(k, { t: row.t, activations: row.activations });
      const l = last.get(k);
      if (!l || row.t > l.t) last.set(k, { t: row.t, activations: row.activations });
    }

    const out = new Map<string, number>();
    for (const [k, l] of Array.from(last.entries())) {
      const f = first.get(k);
      const base = f && f.t !== l.t ? f.activations : 0;
      const d = l.activations - base;
      if (Number.isFinite(d)) out.set(k, Math.max(0, d));
    }
    return out;
  }, [promocodeSnapshots, monthKey, ym]);

  const contractorName = useMemo(() => {
    const m = new Map<string, string>();
    contractors.forEach((c) => m.set(c.id, c.name));
    return m;
  }, [contractors]);

  const pubMonth = useMemo(
    () => integrationsPublishedInMonth(integrations, ym),
    [integrations, ym],
  );
  const pubMonthPrev = useMemo(
    () => integrationsPublishedInMonth(integrations, ymPrev),
    [integrations, ymPrev],
  );

  const kpi = useMemo(() => {
    const reach = sumIntegrationReach(pubMonth);
    const reachPrev = sumIntegrationReach(pubMonthPrev);
    const budget = sumIntegrationBudget(pubMonth);
    const budgetPrev = sumIntegrationBudget(pubMonthPrev);
    const cpm = aggregateCpmForMonth(pubMonth);
    const cpmPrev = aggregateCpmForMonth(pubMonthPrev);
    return {
      count: pubMonth.length,
      countPrev: pubMonthPrev.length,
      reach,
      reachPrev,
      budget,
      budgetPrev,
      cpm,
      cpmPrev,
    };
  }, [pubMonth, pubMonthPrev]);

  const reachByDay = useMemo(
    () => integrationReachByCalendarDayInMonth(pubMonth, ym),
    [pubMonth, ym],
  );

  const manualPromoActivations = useMemo(
    () => sumPromoActivations(pubMonth),
    [pubMonth],
  );

  function handleExportThisMonth() {
    const month = ym;
    const intRows = integrationsPublishedInMonth(integrations, month).map((i) => [
      "интеграция",
      i.id,
      (i.title ?? "").replace(/\s+/g, " ").trim(),
      INTEGRATION_STATUS_LABELS[i.status],
      i.releaseDate ?? "",
      i.createdAt ?? "",
      contractorName.get(i.contractorId) ?? i.contractorId,
      socialOptions.find((o) => o.id === i.socialNetworkId)?.label ?? i.socialNetworkId,
      i.cooperationType ?? "",
      i.reach != null ? String(i.reach) : "",
      i.budget != null ? String(i.budget) : "",
    ]);
    const delRows = deliveriesCreatedInMonth(deliveries, month).map((d) => [
      "доставка",
      d.id,
      d.trackNumber,
      DELIVERY_STATUS_LABELS[d.status],
      "",
      d.createdAt ?? "",
      contractorName.get(d.contractorId) ?? d.contractorId,
      "",
      "",
      "",
      "",
    ]);
    const header = [
      "Тип записи",
      "ID",
      "Название или трек",
      "Статус",
      "Дата выхода",
      "Создано (ISO)",
      "Контрагент",
      "Площадка",
      "Тип сотрудничества",
      "Охваты",
      "Бюджет (₽)",
    ];
    const csv = rowsToCsv(header, [...intRows, ...delRows]);
    downloadUtf8Csv(`выгрузка-${formatYearMonthString(month)}.csv`, csv);
  }

  return (
    <div className={`w-full min-w-0 max-w-full pb-10 ${dashboardPageStackClass}`}>
      <div className={crmPageHeaderRowClass}>
        <h1 className={crmPageTitleClass}>Обзор</h1>

        <div className={dashboardHeaderActionsRowClass}>
          <div className="flex min-w-0 flex-col gap-1">
            <label
              htmlFor="dashboard-month"
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
                id="dashboard-month"
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

          <button
            type="button"
            onClick={handleExportThisMonth}
            className={`${primaryActionButtonClass} w-full shrink-0 bg-app-accent/20 ring-1 ring-app-accent/30 hover:bg-app-accent/30 sm:w-auto`}
          >
            <Download className="h-4 w-4 shrink-0" strokeWidth={1.75} />
            Выгрузка CSV
          </button>
        </div>
      </div>

      <DashboardChartSection title="Ключевые показатели">
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5">
          <StatCard
            label="Интеграции (выход в месяце)"
            value={kpi.count > 0 ? kpi.count : DASHBOARD_EMPTY_VALUE}
            accent="accent"
            trend={
              kpi.count > 0
                ? monthOverMonthTrend(kpi.count, kpi.countPrev)
                : undefined
            }
          />
          <StatCard
            label="Охваты"
            value={
              integrationsHaveAnyReach(pubMonth)
                ? nfKpi.format(kpi.reach)
                : DASHBOARD_EMPTY_VALUE
            }
            trend={
              integrationsHaveAnyReach(pubMonth)
                ? monthOverMonthTrend(kpi.reach, kpi.reachPrev)
                : undefined
            }
          />
          <StatCard
            label="Бюджет"
            value={
              integrationsHaveAnyBudget(pubMonth)
                ? `${formatRuMoney(kpi.budget)} ₽`
                : DASHBOARD_EMPTY_VALUE
            }
            trend={
              integrationsHaveAnyBudget(pubMonth)
                ? monthOverMonthTrend(kpi.budget, kpi.budgetPrev)
                : undefined
            }
          />
          <StatCard
            label="CPM"
            value={
              kpi.cpm != null ? `${formatRuCpm(kpi.cpm)} ₽` : DASHBOARD_EMPTY_VALUE
            }
            trend={
              kpi.cpm != null
                ? monthOverMonthTrendCpm(kpi.cpm, kpi.cpmPrev)
                : undefined
            }
            trendPolarity="inverse"
          />
          <StatCard
            label="Активаций (ручной ввод)"
            value={
              integrationsHaveAnyPromoActivations(pubMonth)
                ? nfKpi.format(manualPromoActivations)
                : DASHBOARD_EMPTY_VALUE
            }
          />
        </div>
      </DashboardChartSection>

      <ReachByDayBarChart dailyReach={reachByDay} />

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <DashboardTopBloggers
          ym={ym}
          integrations={integrations}
          contractorName={contractorName}
        />
        <DashboardPromocodesPanel
          contractors={contractors}
          promoDeltaByCodeKey={promoDeltaByCodeKey}
        />
      </div>

      <DashboardGeneralReportTable ym={ym} integrations={integrations} />
    </div>
  );
}
