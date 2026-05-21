"use client";

import { useEffect, useMemo, useState } from "react";
import { usePanelData } from "@/context/PanelDataContext";
import {
  aggregateCpmForMonth,
  currentYearMonth,
  deliveriesDeliveredInMonth,
  integrationsAgreementsInMonth,
  integrationsHaveAnyBudget,
  integrationsHaveAnyReach,
  integrationsPublishedInMonth,
  integrationsWithReleaseInMonth,
  monthTitleRu,
  shiftYearMonth,
  sumIntegrationBudget,
  sumIntegrationReach,
} from "@/lib/dashboard-metrics";
import { formatRuCpm, formatRuMoney } from "@/lib/format-ru";
import { crmPageTitleClass } from "@/screens/dashboard-shared";

export function ReportsScreen() {
  const { integrations, deliveries } = usePanelData();

  const [anchorYm, setAnchorYm] = useState(() => currentYearMonth());

  useEffect(() => {
    const tick = () => {
      const next = currentYearMonth();
      setAnchorYm((prev) =>
        prev.year !== next.year || prev.month !== next.month ? next : prev,
      );
    };
    tick();
    const id = window.setInterval(tick, 60_000);
    const onVis = () => {
      if (document.visibilityState === "visible") tick();
    };
    document.addEventListener("visibilitychange", onVis);
    return () => {
      window.clearInterval(id);
      document.removeEventListener("visibilitychange", onVis);
    };
  }, []);

  const months = useMemo(
    () => Array.from({ length: 6 }, (_, i) => shiftYearMonth(anchorYm, -5 + i)),
    [anchorYm],
  );

  const rows = useMemo(
    () =>
      months.map((ym) => {
        const inReleaseMonth = integrationsWithReleaseInMonth(integrations, ym);
        const published = integrationsPublishedInMonth(integrations, ym);
        const agreements = integrationsAgreementsInMonth(integrations, ym);
        const reach = sumIntegrationReach(inReleaseMonth);
        const budget = sumIntegrationBudget(inReleaseMonth);
        const cpm = aggregateCpmForMonth(inReleaseMonth);
        const delivered = deliveriesDeliveredInMonth(deliveries, ym).length;
        return {
          ym,
          published: published.length,
          agreements: agreements.length,
          reach,
          budget,
          cpm,
          delivered,
          hasReach: integrationsHaveAnyReach(inReleaseMonth),
          hasBudget: integrationsHaveAnyBudget(inReleaseMonth),
        };
      }),
    [months, integrations, deliveries],
  );

  return (
    <div className="space-y-4">
      <div className="space-y-1">
        <h1 className={crmPageTitleClass}>Отчёты</h1>
        <p className="text-xs text-app-fg/45">
          Интеграции по дате выхода в месяце: опубликовано и договорённости отдельно;
          охваты, бюджет и CPM — по всем выходам в месяце. Доставки — получено в месяце.
        </p>
      </div>

      <div className="overflow-x-auto rounded-lg border border-app-fg/10">
        <table className="w-full border-separate border-spacing-0 text-[11px] sm:text-xs">
          <thead>
            <tr className="bg-app-fg/5 text-app-fg/55 uppercase text-[10px]">
              <th className="px-3 py-2 text-left font-medium whitespace-nowrap">Месяц</th>
              <th className="px-3 py-2 text-right font-medium whitespace-nowrap">
                Опубликовано
              </th>
              <th className="px-3 py-2 text-right font-medium whitespace-nowrap">
                Договорённости
              </th>
              <th className="px-3 py-2 text-right font-medium whitespace-nowrap">Охватов</th>
              <th className="px-3 py-2 text-right font-medium whitespace-nowrap">Бюджет (₽)</th>
              <th className="px-3 py-2 text-right font-medium whitespace-nowrap">CPM (₽)</th>
              <th className="px-3 py-2 text-right font-medium whitespace-nowrap">Доставок</th>
            </tr>
          </thead>
          <tbody>
            {rows.map(
              (
                { ym, published, agreements, reach, budget, cpm, delivered, hasReach, hasBudget },
                idx,
              ) => (
                <tr
                  key={`${ym.year}-${ym.month}`}
                  className={
                    "border-t border-app-fg/8 text-app-fg" +
                    (idx % 2 === 1 ? " bg-app-fg/[0.02]" : "")
                  }
                >
                  <td className="px-3 py-2 whitespace-nowrap capitalize">
                    {monthTitleRu(ym)}
                  </td>
                  <td className="px-3 py-2 text-right tabular-nums">
                    {published > 0 ? published : <span className="text-app-fg/30">—</span>}
                  </td>
                  <td className="px-3 py-2 text-right tabular-nums">
                    {agreements > 0 ? agreements : <span className="text-app-fg/30">—</span>}
                  </td>
                  <td className="px-3 py-2 text-right tabular-nums">
                    {hasReach ? formatRuMoney(reach) : <span className="text-app-fg/30">—</span>}
                  </td>
                  <td className="px-3 py-2 text-right tabular-nums">
                    {hasBudget ? formatRuMoney(budget) : <span className="text-app-fg/30">—</span>}
                  </td>
                  <td className="px-3 py-2 text-right tabular-nums">
                    {cpm != null ? formatRuCpm(cpm) : <span className="text-app-fg/30">—</span>}
                  </td>
                  <td className="px-3 py-2 text-right tabular-nums">
                    {delivered > 0 ? delivered : <span className="text-app-fg/30">—</span>}
                  </td>
                </tr>
              ),
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
