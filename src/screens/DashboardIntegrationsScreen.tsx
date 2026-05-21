"use client";

import { useMemo } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { DashboardIntegrationsMonthTable } from "@/components/dashboard/DashboardIntegrationsMonthTable";
import { usePanelData } from "@/context/PanelDataContext";
import {
  countBy,
  integrationsAgreementsInMonth,
  integrationsPublishedInMonth,
  monthOverMonthTrend,
  shiftYearMonth,
} from "@/lib/dashboard-metrics";
import { useDashboardMonth } from "@/hooks/useDashboardMonth";
import {
  DashboardChartSection,
  DistributionBars,
  StatCard,
  dashboardMonthInputClass,
  dashboardMonthNavButtonClass,
  dashboardMonthPickerRowClass,
  dashboardPageStackClass,
  dashboardPageTitleClass,
} from "@/screens/dashboard-shared";

export function DashboardIntegrationsScreen() {
  const { ym, setMonth, monthInputValue } = useDashboardMonth();
  const { integrations, socialOptions, contractors } = usePanelData();

  const contractorName = useMemo(() => {
    const m = new Map<string, string>();
    contractors.forEach((c) => m.set(c.id, c.name));
    return m;
  }, [contractors]);

  const ymPrev = useMemo(() => shiftYearMonth(ym, -1), [ym]);

  const agreementsMonth = useMemo(
    () => integrationsAgreementsInMonth(integrations, ym),
    [integrations, ym],
  );
  const agreementsMonthPrev = useMemo(
    () => integrationsAgreementsInMonth(integrations, ymPrev),
    [integrations, ymPrev],
  );

  const publishedMonth = useMemo(
    () => integrationsPublishedInMonth(integrations, ym),
    [integrations, ym],
  );
  const publishedMonthPrev = useMemo(
    () => integrationsPublishedInMonth(integrations, ymPrev),
    [integrations, ymPrev],
  );

  const agreementsPlatformBars = useMemo(() => {
    const raw = countBy(agreementsMonth.map((i) => i.socialNetworkId));
    return Object.entries(raw)
      .map(([id, value]) => ({
        key: id,
        label: socialOptions.find((o) => o.id === id)?.label ?? id,
        value,
      }))
      .sort((a, b) => b.value - a.value);
  }, [agreementsMonth, socialOptions]);

  const publishedPlatformBars = useMemo(() => {
    const raw = countBy(publishedMonth.map((i) => i.socialNetworkId));
    return Object.entries(raw)
      .map(([id, value]) => ({
        key: id,
        label: socialOptions.find((o) => o.id === id)?.label ?? id,
        value,
      }))
      .sort((a, b) => b.value - a.value);
  }, [publishedMonth, socialOptions]);

  const tableProps = {
    socialOptions,
    contractorName,
  };

  return (
    <div className="space-y-10 pb-10">
      <header className="flex flex-col gap-5 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex flex-col gap-1">
          <p className="text-[10px] font-semibold uppercase tracking-[0.22em] text-app-fg/40">
            Дашборд
          </p>
          <h1 className={dashboardPageTitleClass}>Интеграции</h1>
        </div>

        <div className="flex min-w-0 flex-col gap-1">
          <label
            htmlFor="dashboard-month-integrations"
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
              id="dashboard-month-integrations"
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
      </header>

      <DashboardChartSection title="Сводка">
        <p className="-mt-1 mb-4 text-xs text-app-fg/45">
          Считаем по дате выхода в выбранном месяце: договорённости — черновик и перенос,
          публикации — статус «опубликовано».
        </p>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          <StatCard
            label="Договорённости"
            value={agreementsMonth.length}
            accent="accent"
            trend={monthOverMonthTrend(
              agreementsMonth.length,
              agreementsMonthPrev.length,
            )}
          />
          <StatCard
            label="Опубликовано"
            value={publishedMonth.length}
            trend={monthOverMonthTrend(
              publishedMonth.length,
              publishedMonthPrev.length,
            )}
          />
          <StatCard label="Всего в системе" value={integrations.length} />
        </div>
      </DashboardChartSection>

      <div className={`space-y-8 ${dashboardPageStackClass}`}>
        <DashboardIntegrationsMonthTable
          title="Договорённости"
          emptyMessage="Нет договорённостей с датой выхода в выбранном месяце."
          integrations={agreementsMonth}
          {...tableProps}
        />

        <DashboardIntegrationsMonthTable
          title="Опубликовано"
          emptyMessage="Нет опубликованных интеграций с датой выхода в выбранном месяце."
          integrations={publishedMonth}
          {...tableProps}
        />

        <div className="grid grid-cols-1 gap-8 lg:grid-cols-2">
          <DashboardChartSection title="Договорённости · площадки">
            {agreementsPlatformBars.length === 0 ? (
              <p className="py-4 text-center text-sm text-app-fg/45">Нет данных.</p>
            ) : (
              <DistributionBars entries={agreementsPlatformBars} />
            )}
          </DashboardChartSection>
          <DashboardChartSection title="Опубликовано · площадки">
            {publishedPlatformBars.length === 0 ? (
              <p className="py-4 text-center text-sm text-app-fg/45">Нет данных.</p>
            ) : (
              <DistributionBars entries={publishedPlatformBars} />
            )}
          </DashboardChartSection>
        </div>
      </div>
    </div>
  );
}
