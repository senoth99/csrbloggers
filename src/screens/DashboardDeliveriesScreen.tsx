"use client";

import { useMemo } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { usePanelData } from "@/context/PanelDataContext";
import { computeContractorRating10, formatContractorRating10Display } from "@/lib/contractor-rating";
import { DELIVERY_STATUS_LABELS, type DeliveryStatus } from "@/types/panel-data";
import {
  countBy,
  deliveriesCreatedInMonth,
  deliveriesDeliveredInMonth,
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
  dashboardPageTitleClass,
} from "@/screens/dashboard-shared";

export function DashboardDeliveriesScreen() {
  const { ym, setMonth, monthInputValue } = useDashboardMonth();
  const { deliveries, contractors, integrations, contractorItems } = usePanelData();

  const ymPrev = useMemo(() => shiftYearMonth(ym, -1), [ym]);

  const createdInMonth = useMemo(
    () => deliveriesCreatedInMonth(deliveries, ym),
    [deliveries, ym],
  );

  const createdInMonthPrev = useMemo(
    () => deliveriesCreatedInMonth(deliveries, ymPrev),
    [deliveries, ymPrev],
  );

  const deliveredInMonth = useMemo(
    () => deliveriesDeliveredInMonth(deliveries, ym),
    [deliveries, ym],
  );

  const deliveredInMonthPrev = useMemo(
    () => deliveriesDeliveredInMonth(deliveries, ymPrev),
    [deliveries, ymPrev],
  );

  const statusBarsCreated = useMemo(() => {
    const raw = countBy(createdInMonth.map((d) => d.status));
    return (Object.keys(DELIVERY_STATUS_LABELS) as DeliveryStatus[]).map((k) => ({
      key: k,
      label: DELIVERY_STATUS_LABELS[k],
      value: raw[k] ?? 0,
    }));
  }, [createdInMonth]);

  const integrationsInMonth = useMemo(
    () => integrationsCreatedInMonth(integrations, ym),
    [integrations, ym],
  );
  const integrationsInMonthPrev = useMemo(
    () => integrationsCreatedInMonth(integrations, ymPrev),
    [integrations, ymPrev],
  );

  const avgContractorRating10 = useMemo(() => {
    if (contractors.length === 0) return null;
    let sum = 0;
    for (const c of contractors) {
      const ints = integrations.filter((i) => i.contractorId === c.id);
      const nItems = contractorItems.filter((it) => it.contractorId === c.id).length;
      sum += computeContractorRating10(ints, nItems);
    }
    return Math.round((sum / contractors.length) * 10) / 10;
  }, [contractors, integrations, contractorItems]);

  const itemsInNewTracksMonth = useMemo(() => {
    let n = 0;
    for (const d of createdInMonth) {
      n += d.items?.length ?? d.itemIds?.length ?? 0;
    }
    return n;
  }, [createdInMonth]);

  const deliveriesInProgressTotal = useMemo(
    () =>
      deliveries.filter((d) =>
        d.status === "created" || d.status === "in_transit" || d.status === "in_pickup",
      ).length,
    [deliveries],
  );

  const topContractorsByNewTracks = useMemo(() => {
    const raw = countBy(createdInMonth.map((d) => d.contractorId));
    return Object.entries(raw)
      .map(([id, value]) => ({
        key: id,
        label: contractors.find((c) => c.id === id)?.name ?? id,
        value,
      }))
      .filter((e) => e.value > 0)
      .sort((a, b) => b.value - a.value)
      .slice(0, 12);
  }, [createdInMonth, contractors]);

  return (
    <div className="space-y-10 pb-10">
      <header className="flex flex-col gap-5 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="text-[10px] font-semibold uppercase tracking-[0.22em] text-app-fg/40">
            Дашборд
          </p>
          <h1 className={dashboardPageTitleClass}>Доставки</h1>
        </div>

        <div className="flex min-w-0 flex-col gap-1">
          <label
            htmlFor="dashboard-month-deliveries"
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
              id="dashboard-month-deliveries"
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
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
          <StatCard
            label="Новые треки в месяце"
            value={createdInMonth.length}
            accent="accent"
            trend={monthOverMonthTrend(
              createdInMonth.length,
              createdInMonthPrev.length,
            )}
          />
          <StatCard
            label="Получено за месяц"
            value={deliveredInMonth.length}
            trend={monthOverMonthTrend(
              deliveredInMonth.length,
              deliveredInMonthPrev.length,
            )}
          />
          <StatCard label="Всего доставок" value={deliveries.length} />
        </div>
      </DashboardChartSection>

      <DashboardChartSection title="Ключевые показатели">
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          <StatCard label="Контрагентов в системе" value={contractors.length} />
          <StatCard label="Интеграций всего" value={integrations.length} />
          <StatCard
            label="Интеграций создано в месяце"
            value={integrationsInMonth.length}
            accent="accent"
            trend={monthOverMonthTrend(
              integrationsInMonth.length,
              integrationsInMonthPrev.length,
            )}
          />
          <StatCard
            label="Средний рейтинг контрагентов"
            value={
              avgContractorRating10 != null
                ? formatContractorRating10Display(avgContractorRating10)
                : "—"
            }
          />
          <StatCard
            label="Позиций в новых треках (месяц)"
            value={itemsInNewTracksMonth}
          />
          <StatCard
            label="Доставок в работе"
            value={deliveriesInProgressTotal}
          />
        </div>
      </DashboardChartSection>

      <DashboardChartSection title="Статусы новых треков">
        <p className="mb-5 text-xs leading-relaxed text-app-fg/45">
          По доставкам, <span className="text-app-fg/55">созданным</span> в выбранном месяце
        </p>
        <DistributionBars entries={statusBarsCreated} />
      </DashboardChartSection>

      <DashboardChartSection title="Топ контрагентов по новым трекам">
        <p className="mb-5 text-xs leading-relaxed text-app-fg/45">
          За выбранный месяц (по числу созданных доставок)
        </p>
        <DistributionBars
          entries={topContractorsByNewTracks.map((b, i) => ({
            ...b,
            colorClass: i === 0 ? "bg-app-accent" : "bg-app-fg/35",
          }))}
        />
      </DashboardChartSection>
    </div>
  );
}
