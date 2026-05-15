"use client";

import { usePanelData } from "@/context/PanelDataContext";
import {
  currentYearMonth,
  shiftYearMonth,
  monthTitleRu,
  integrationsPublishedInMonth,
  sumIntegrationReach,
  sumIntegrationBudget,
  aggregateCpmForMonth,
  deliveriesDeliveredInMonth,
} from "@/lib/dashboard-metrics";
import { formatRuMoney, formatRuCpm } from "@/lib/format-ru";

export function ReportsScreen() {
  const { integrations, deliveries } = usePanelData();

  const now = currentYearMonth();
  const months = Array.from({ length: 6 }, (_, i) => shiftYearMonth(now, -5 + i));

  const rows = months.map((ym) => {
    const pubs = integrationsPublishedInMonth(integrations, ym);
    const reach = sumIntegrationReach(pubs);
    const budget = sumIntegrationBudget(pubs);
    const cpm = aggregateCpmForMonth(pubs);
    const delivered = deliveriesDeliveredInMonth(deliveries, ym).length;
    return { ym, count: pubs.length, reach, budget, cpm, delivered };
  });

  return (
    <div className="space-y-4">
      <h1 className="text-xl font-bold uppercase tracking-[0.12em] text-app-fg">
        Отчёты
      </h1>

      <div className="overflow-x-auto rounded-lg border border-app-fg/10">
        <table className="w-full border-separate border-spacing-0 text-[11px] sm:text-xs">
          <thead>
            <tr className="bg-app-fg/5 text-app-fg/55 uppercase text-[10px]">
              <th className="px-3 py-2 text-left font-medium whitespace-nowrap">Месяц</th>
              <th className="px-3 py-2 text-right font-medium whitespace-nowrap">Интеграций</th>
              <th className="px-3 py-2 text-right font-medium whitespace-nowrap">Охватов</th>
              <th className="px-3 py-2 text-right font-medium whitespace-nowrap">Бюджет (₽)</th>
              <th className="px-3 py-2 text-right font-medium whitespace-nowrap">CPM (₽)</th>
              <th className="px-3 py-2 text-right font-medium whitespace-nowrap">Доставок</th>
            </tr>
          </thead>
          <tbody>
            {rows.map(({ ym, count, reach, budget, cpm, delivered }, idx) => (
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
                  {count > 0 ? count : <span className="text-app-fg/30">—</span>}
                </td>
                <td className="px-3 py-2 text-right tabular-nums">
                  {reach > 0 ? formatRuMoney(reach) : <span className="text-app-fg/30">—</span>}
                </td>
                <td className="px-3 py-2 text-right tabular-nums">
                  {budget > 0 ? formatRuMoney(budget) : <span className="text-app-fg/30">—</span>}
                </td>
                <td className="px-3 py-2 text-right tabular-nums">
                  {cpm != null ? formatRuCpm(cpm) : <span className="text-app-fg/30">—</span>}
                </td>
                <td className="px-3 py-2 text-right tabular-nums">
                  {delivered > 0 ? delivered : <span className="text-app-fg/30">—</span>}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <p className="text-xs text-app-fg/40 mt-4">
        Интеграции учитываются по дате выхода (releaseDate). Доставки — по дате статуса «Получено».
      </p>
    </div>
  );
}
