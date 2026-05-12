"use client";

import { useEffect, useMemo } from "react";
import { Download } from "lucide-react";
import { usePanelData } from "@/context/PanelDataContext";
import { usePromocodes } from "@/hooks/usePromocodes";
import {
  DELIVERY_STATUS_LABELS,
  INTEGRATION_STATUS_LABELS,
  type DeliveryStatus,
  type IntegrationStatus,
} from "@/types/panel-data";
import {
  agreementsCreatedInMonth,
  countBy,
  currentYearMonth,
  deliveriesCreatedInMonth,
  formatYearMonthString,
  integrationReachByCalendarDayInMonth,
  integrationsCreatedInMonth,
  monthOverMonthTrend,
  shiftYearMonth,
  sumIntegrationReach,
  sumPromoActivations,
} from "@/lib/dashboard-metrics";
import { ReachByDayBarChart } from "@/components/ReachByDayBarChart";
import { downloadUtf8Csv, rowsToCsv } from "@/lib/csv-export";
import { DashboardGeneralReportTable } from "@/components/DashboardGeneralReportTable";
import {
  DashboardChartSection,
  DistributionBars,
  StatCard,
  dashboardPageTitleClass,
  listDivideClass,
} from "@/screens/dashboard-shared";

const nfKpi = new Intl.NumberFormat("ru-RU", { maximumFractionDigits: 0 });

export function DashboardScreen() {
  const { contractors, integrations, deliveries, socialOptions, recordPromocodeSnapshot, promocodeSnapshots } =
    usePanelData();
  const { items: promoItems, byCodeKey: promoByCodeKey, fetchedAt: promoFetchedAt } =
    usePromocodes();

  const ym = useMemo(() => currentYearMonth(), []);
  const ymPrev = useMemo(() => shiftYearMonth(ym, -1), [ym]);

  // фиксируем снапшот total-активаций (для расчёта "за месяц")
  useEffect(() => {
    if (!promoFetchedAt || promoItems.length === 0) return;
    recordPromocodeSnapshot(promoItems, promoFetchedAt);
  }, [promoFetchedAt, promoItems, recordPromocodeSnapshot]);

  const monthKey = `${ym.year}-${String(ym.month).padStart(2, "0")}`;
  const promoDeltaByCodeKey = useMemo(() => {
    // Берём только снапшоты текущего месяца и считаем last-first по каждому коду
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
      if (!f) continue;
      const d = l.activations - f.activations;
      if (Number.isFinite(d)) out.set(k, Math.max(0, d));
    }
    return out;
  }, [promocodeSnapshots, monthKey, ym]);

  const contractorName = useMemo(() => {
    const m = new Map<string, string>();
    contractors.forEach((c) => m.set(c.id, c.name));
    return m;
  }, [contractors]);

  const integrationsMonth = useMemo(
    () => integrationsCreatedInMonth(integrations, ym),
    [integrations, ym],
  );

  const integrationsMonthPrev = useMemo(
    () => integrationsCreatedInMonth(integrations, ymPrev),
    [integrations, ymPrev],
  );

  const deliveriesMonth = useMemo(
    () => deliveriesCreatedInMonth(deliveries, ym),
    [deliveries, ym],
  );

  const kpi = useMemo(() => {
    const reach = sumIntegrationReach(integrationsMonth);
    const reachPrev = sumIntegrationReach(integrationsMonthPrev);
    const promo = sumPromoActivations(integrationsMonth);
    const promoPrev = sumPromoActivations(integrationsMonthPrev);
    const agreements = agreementsCreatedInMonth(integrations, ym);
    const agreementsPrev = agreementsCreatedInMonth(integrations, ymPrev);
    return {
      reach,
      reachPrev,
      count: integrationsMonth.length,
      countPrev: integrationsMonthPrev.length,
      agreements,
      agreementsPrev,
      promo,
      promoPrev,
    };
  }, [integrations, integrationsMonth, integrationsMonthPrev, ym, ymPrev]);

  const reachByDay = useMemo(
    () => integrationReachByCalendarDayInMonth(integrations, ym),
    [integrations, ym],
  );

  const intBarEntries = useMemo(() => {
    const raw = countBy(integrationsMonth.map((i) => i.status));
    return (Object.keys(INTEGRATION_STATUS_LABELS) as IntegrationStatus[]).map(
      (k) => ({
        key: k,
        label: INTEGRATION_STATUS_LABELS[k],
        value: raw[k] ?? 0,
      }),
    );
  }, [integrationsMonth]);

  const delBarEntries = useMemo(() => {
    const raw = countBy(deliveriesMonth.map((d) => d.status));
    return (Object.keys(DELIVERY_STATUS_LABELS) as DeliveryStatus[]).map((k) => ({
      key: k,
      label: DELIVERY_STATUS_LABELS[k],
      value: raw[k] ?? 0,
    }));
  }, [deliveriesMonth]);

  const platformBars = useMemo(() => {
    const raw = countBy(integrationsMonth.map((i) => i.socialNetworkId));
    return Object.entries(raw)
      .map(([id, value]) => ({
        key: id,
        label: socialOptions.find((o) => o.id === id)?.label ?? id,
        value,
      }))
      .sort((a, b) => b.value - a.value);
  }, [integrationsMonth, socialOptions]);

  const promoPanelRows = useMemo(() => {
    return contractors
      .map((c) => {
        const code = (c.promoCode ?? "").trim();
        if (!code) return null;
        const codeKey = code.toLowerCase();
        return {
          contractorId: c.id,
          contractorName: c.name,
          code,
          activations: promoDeltaByCodeKey.get(codeKey),
        };
      })
      .filter(Boolean)
      .sort((a, b) => ((b!.activations ?? -1) as number) - ((a!.activations ?? -1) as number)) as Array<{
      contractorId: string;
      contractorName: string;
      code: string;
      activations: number | undefined;
    }>;
  }, [contractors, promoDeltaByCodeKey]);

  const promoPanelTotal = useMemo(() => {
    return promoPanelRows.reduce((acc, r) => acc + (r.activations ?? 0), 0);
  }, [promoPanelRows]);

  function handleExportThisMonth() {
    const month = currentYearMonth();
    const intRows = integrationsCreatedInMonth(integrations, month).map((i) => [
      "интеграция",
      i.id,
      (i.title ?? "").replace(/\s+/g, " ").trim(),
      INTEGRATION_STATUS_LABELS[i.status],
      i.createdAt ?? "",
      contractorName.get(i.contractorId) ?? i.contractorId,
    ]);
    const delRows = deliveriesCreatedInMonth(deliveries, month).map((d) => [
      "доставка",
      d.id,
      d.trackNumber,
      DELIVERY_STATUS_LABELS[d.status],
      d.createdAt ?? "",
      contractorName.get(d.contractorId) ?? d.contractorId,
    ]);
    const header = [
      "Тип записи",
      "ID",
      "Название или трек",
      "Статус",
      "Создано (ISO)",
      "Контрагент",
    ];
    const csv = rowsToCsv(header, [...intRows, ...delRows]);
    downloadUtf8Csv(
      `выгрузка-${formatYearMonthString(month)}.csv`,
      csv,
    );
  }

  return (
    <div className="space-y-10 pb-10">
      <DashboardChartSection title="Ключевые показатели">
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <StatCard
            label="Охваты (общие)"
            value={nfKpi.format(kpi.reach)}
            accent="accent"
            trend={monthOverMonthTrend(kpi.reach, kpi.reachPrev)}
          />
          <StatCard
            label="Количество интеграций"
            value={kpi.count}
            trend={monthOverMonthTrend(kpi.count, kpi.countPrev)}
          />
          <StatCard
            label="Количество договорённостей"
            value={nfKpi.format(kpi.agreements)}
            trend={monthOverMonthTrend(kpi.agreements, kpi.agreementsPrev)}
          />
          <StatCard
            label="Активаций промокодов"
            value={nfKpi.format(kpi.promo)}
            trend={monthOverMonthTrend(kpi.promo, kpi.promoPrev)}
          />
        </div>
      </DashboardChartSection>

      {promoPanelRows.length > 0 ? (
        <DashboardChartSection title="Промокоды">
          <div className="mb-4 flex flex-wrap items-end justify-between gap-3">
            <p className="text-xs font-medium tabular-nums text-app-fg/70">
              Всего активаций: {nfKpi.format(promoPanelTotal)}
            </p>
          </div>
          <ul className={`rounded-sm border border-app-fg/10 ${listDivideClass}`}>
            {promoPanelRows.map((r) => (
              <li
                key={`${r.contractorId}:${r.code}`}
                className="flex items-center justify-between gap-4 px-4 py-3"
              >
                <div className="min-w-0">
                  <p className="truncate text-sm font-medium text-app-fg">
                    {r.contractorName}
                  </p>
                  <p className="mt-0.5 text-xs text-app-fg/55">{r.code}</p>
                </div>
                <div className="shrink-0 text-right tabular-nums text-app-fg">
                  {r.activations != null ? nfKpi.format(r.activations) : "—"}
                </div>
              </li>
            ))}
          </ul>
        </DashboardChartSection>
      ) : null}

      <ReachByDayBarChart dailyReach={reachByDay} />

      <div className="flex flex-col gap-5 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="text-[10px] font-semibold uppercase tracking-[0.22em] text-app-fg/40">
            Дашборд
          </p>
          <h1 className={dashboardPageTitleClass}>Обзор</h1>
        </div>
        <button
          type="button"
          onClick={handleExportThisMonth}
          className="inline-flex w-full shrink-0 items-center justify-center gap-2 bg-app-accent/20 px-5 py-3.5 text-xs font-semibold uppercase tracking-[0.12em] text-app-fg ring-1 ring-app-accent/30 transition hover:bg-app-accent/30 sm:w-auto"
        >
          <Download className="h-4 w-4 shrink-0" strokeWidth={1.75} />
          Выгрузка CSV
        </button>
      </div>

      <DashboardGeneralReportTable ym={ym} integrations={integrations} />

      <div className="grid grid-cols-1 gap-8 lg:grid-cols-2">
        <DashboardChartSection title="Интеграции · статусы">
          <DistributionBars entries={intBarEntries} />
        </DashboardChartSection>
        <DashboardChartSection title="Доставки · статусы">
          <DistributionBars entries={delBarEntries} />
        </DashboardChartSection>
      </div>

      <DashboardChartSection title="Площадки">
        <DistributionBars entries={platformBars} />
      </DashboardChartSection>
    </div>
  );
}
