"use client";

import { useMemo } from "react";
import Link from "next/link";
import type { Integration } from "@/types/panel-data";
import {
  integrationsPublishedInMonth,
  type YearMonth,
} from "@/lib/dashboard-metrics";
import { DashboardChartSection, listDivideClass } from "@/screens/dashboard-shared";

const nfReach = new Intl.NumberFormat("ru-RU", { maximumFractionDigits: 0 });

type Props = {
  ym: YearMonth;
  integrations: Integration[];
  contractorName: Map<string, string>;
};

export function DashboardTopBloggers({ ym, integrations, contractorName }: Props) {
  const rows = useMemo(() => {
    const pub = integrationsPublishedInMonth(integrations, ym);
    const byContractor = new Map<string, number>();
    for (const i of pub) {
      if (i.reach == null || !Number.isFinite(i.reach)) continue;
      byContractor.set(
        i.contractorId,
        (byContractor.get(i.contractorId) ?? 0) + Math.max(0, i.reach),
      );
    }
    return Array.from(byContractor.entries())
      .map(([id, reach]) => ({
        id,
        name: contractorName.get(id) ?? id,
        reach,
      }))
      .sort((a, b) => b.reach - a.reach)
      .slice(0, 5);
  }, [integrations, ym, contractorName]);

  return (
    <DashboardChartSection title="Топ блогеров по охвату">
      {rows.length === 0 ? (
        <p className="py-6 text-center text-sm text-app-fg/45">
          Нет опубликованных интеграций с охватом за месяц.
        </p>
      ) : (
        <ol className={`rounded-sm border border-app-fg/10 ${listDivideClass}`}>
          {rows.map((r, idx) => (
            <li
              key={r.id}
              className="flex items-center justify-between gap-4 px-4 py-3"
            >
              <div className="flex min-w-0 items-center gap-3">
                <span className="w-6 shrink-0 tabular-nums text-sm font-semibold text-app-fg/45">
                  {idx + 1}
                </span>
                <Link
                  href={`/contractors/${encodeURIComponent(r.id)}`}
                  className="truncate text-sm font-medium text-app-fg hover:text-app-accent"
                >
                  {r.name}
                </Link>
              </div>
              <span className="shrink-0 tabular-nums text-sm font-semibold text-app-fg">
                {nfReach.format(r.reach)}
              </span>
            </li>
          ))}
        </ol>
      )}
    </DashboardChartSection>
  );
}
