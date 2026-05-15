"use client";

import { useMemo } from "react";
import type { Contractor, Delivery } from "@/types/panel-data";
import { DELIVERY_STATUS_LABELS, type DeliveryStatus } from "@/types/panel-data";
import {
  countBy,
  deliveriesCreatedInMonth,
  deliveriesDeliveredInMonth,
  monthOverMonthTrend,
  shiftYearMonth,
  type YearMonth,
} from "@/lib/dashboard-metrics";
import {
  DashboardChartSection,
  DistributionBars,
  StatCard,
  dashboardPageStackClass,
} from "@/screens/dashboard-shared";

type Props = {
  ym: YearMonth;
  deliveries: Delivery[];
  contractors: Contractor[];
};

export function DashboardDeliveriesSummary({ ym, deliveries, contractors }: Props) {
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

  const statusBars = useMemo(() => {
    const raw = countBy(createdInMonth.map((d) => d.status));
    return (Object.keys(DELIVERY_STATUS_LABELS) as DeliveryStatus[]).map((k) => ({
      key: k,
      label: DELIVERY_STATUS_LABELS[k],
      value: raw[k] ?? 0,
    }));
  }, [createdInMonth]);

  const topContractors = useMemo(() => {
    const raw = countBy(createdInMonth.map((d) => d.contractorId));
    return Object.entries(raw)
      .map(([id, value]) => ({
        key: id,
        label: contractors.find((c) => c.id === id)?.name ?? id,
        value,
      }))
      .filter((e) => e.value > 0)
      .sort((a, b) => b.value - a.value)
      .slice(0, 6);
  }, [createdInMonth, contractors]);

  const inProgress = useMemo(
    () =>
      deliveries.filter((d) =>
        ["created", "in_transit", "in_pickup"].includes(d.status),
      ).length,
    [deliveries],
  );

  return (
    <section className={dashboardPageStackClass}>
      <DashboardChartSection title="Сводка за месяц">
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <StatCard
            label="Новые треки"
            value={createdInMonth.length}
            accent="accent"
            trend={monthOverMonthTrend(
              createdInMonth.length,
              createdInMonthPrev.length,
            )}
          />
          <StatCard
            label="Получено"
            value={deliveredInMonth.length}
            trend={monthOverMonthTrend(
              deliveredInMonth.length,
              deliveredInMonthPrev.length,
            )}
          />
          <StatCard label="Всего в системе" value={deliveries.length} />
          <StatCard label="В работе" value={inProgress} />
        </div>
      </DashboardChartSection>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <DashboardChartSection title="Статусы новых треков">
          <DistributionBars entries={statusBars} />
        </DashboardChartSection>
        <DashboardChartSection title="Топ по новым трекам">
          <DistributionBars
            entries={topContractors.map((b, i) => ({
              ...b,
              colorClass: i === 0 ? "bg-app-accent" : "bg-app-fg/35",
            }))}
          />
        </DashboardChartSection>
      </div>
    </section>
  );
}
