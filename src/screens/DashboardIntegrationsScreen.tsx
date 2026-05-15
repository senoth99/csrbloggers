"use client";

import { useMemo } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { DashboardIntegrationsMonthTable } from "@/components/dashboard/DashboardIntegrationsMonthTable";
import { usePanelData } from "@/context/PanelDataContext";
import { INTEGRATION_STATUS_LABELS, type IntegrationStatus } from "@/types/panel-data";
import {
  countBy,
  integrationsCreatedInMonth,
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

  const inMonth = useMemo(
    () => integrationsCreatedInMonth(integrations, ym),
    [integrations, ym],
  );

  const inMonthPrev = useMemo(
    () => integrationsCreatedInMonth(integrations, ymPrev),
    [integrations, ymPrev],
  );

  const inPipeline = useMemo(() => {
    return integrations.filter((i) => {
      const rel = i.releaseDate?.trim();
      if (!rel) return false;
      const [y, m] = rel.split("-").map(Number);
      return y === ym.year && m === ym.month;
    });
  }, [integrations, ym]);

  const inPipelinePrev = useMemo(() => {
    return integrations.filter((i) => {
      const rel = i.releaseDate?.trim();
      if (!rel) return false;
      const [y, m] = rel.split("-").map(Number);
      return y === ymPrev.year && m === ymPrev.month;
    });
  }, [integrations, ymPrev]);

  const statusBars = useMemo(() => {
    const raw = countBy(inMonth.map((i) => i.status));
    return (Object.keys(INTEGRATION_STATUS_LABELS) as IntegrationStatus[]).map((k) => ({
      key: k,
      label: INTEGRATION_STATUS_LABELS[k],
      value: raw[k] ?? 0,
    }));
  }, [inMonth]);

  const platformBars = useMemo(() => {
    const raw = countBy(inMonth.map((i) => i.socialNetworkId));
    return Object.entries(raw)
      .map(([id, value]) => ({
        key: id,
        label: socialOptions.find((o) => o.id === id)?.label ?? id,
        value,
      }))
      .sort((a, b) => b.value - a.value);
  }, [inMonth, socialOptions]);

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
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          <StatCard
            label="Создано в месяце"
            value={inMonth.length}
            accent="accent"
            trend={monthOverMonthTrend(inMonth.length, inMonthPrev.length)}
          />
          <StatCard
            label="Планируемый выход в месяце"
            value={inPipeline.length}
            trend={monthOverMonthTrend(inPipeline.length, inPipelinePrev.length)}
          />
          <StatCard label="Всего в системе" value={integrations.length} />
        </div>
      </DashboardChartSection>

      <div className={`space-y-8 ${dashboardPageStackClass}`}>
        <DashboardIntegrationsMonthTable
          ym={ym}
          integrations={integrations}
          socialOptions={socialOptions}
          contractorName={contractorName}
        />

        <div className="grid grid-cols-1 gap-8 lg:grid-cols-2">
          <DashboardChartSection title="Создано в месяце · статусы">
            <DistributionBars entries={statusBars} />
          </DashboardChartSection>
          <DashboardChartSection title="Создано в месяце · площадки">
            <DistributionBars entries={platformBars} />
          </DashboardChartSection>
        </div>
      </div>
    </div>
  );
}
