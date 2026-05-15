"use client";

import { useMemo } from "react";
import Link from "next/link";
import type { Integration, SocialOption } from "@/types/panel-data";
import { INTEGRATION_STATUS_LABELS } from "@/types/panel-data";
import { integrationsPublishedInMonth, type YearMonth } from "@/lib/dashboard-metrics";
import { formatCalendarDate } from "@/lib/format-ru";
import { formatRuMoney } from "@/lib/format-ru";
import { HorizontalScrollTable } from "@/components/ui";
import {
  DashboardChartSection,
  tableBodyRowBorderClass,
  tableHeadRowBorderClass,
} from "@/screens/dashboard-shared";

const nfReach = new Intl.NumberFormat("ru-RU", { maximumFractionDigits: 0 });

type Props = {
  ym: YearMonth;
  integrations: Integration[];
  socialOptions: SocialOption[];
  contractorName: Map<string, string>;
};

export function DashboardIntegrationsMonthTable({
  ym,
  integrations,
  socialOptions,
  contractorName,
}: Props) {
  const rows = useMemo(
    () =>
      integrationsPublishedInMonth(integrations, ym).sort((a, b) =>
        (b.releaseDate ?? "").localeCompare(a.releaseDate ?? ""),
      ),
    [integrations, ym],
  );

  const platformLabel = (id: string) =>
    socialOptions.find((o) => o.id === id)?.label ?? id;

  return (
    <DashboardChartSection title="Интеграции за месяц">
      {rows.length === 0 ? (
        <p className="py-6 text-center text-sm text-app-fg/45">
          Нет опубликованных интеграций с датой выхода в выбранном месяце.
        </p>
      ) : (
        <HorizontalScrollTable className="-mx-1 px-1" scrollClassName="overflow-x-auto">
          <table className="min-w-[640px] w-full text-left text-sm">
            <thead>
              <tr className={tableHeadRowBorderClass}>
                <th className="pb-2 pr-3 text-[10px] font-semibold uppercase tracking-wider text-app-fg/45">
                  Статус
                </th>
                <th className="pb-2 pr-3 text-[10px] font-semibold uppercase tracking-wider text-app-fg/45">
                  Контрагент
                </th>
                <th className="pb-2 pr-3 text-[10px] font-semibold uppercase tracking-wider text-app-fg/45">
                  Площадка
                </th>
                <th className="pb-2 pr-3 text-[10px] font-semibold uppercase tracking-wider text-app-fg/45">
                  Выход
                </th>
                <th className="pb-2 pr-3 text-right text-[10px] font-semibold uppercase tracking-wider text-app-fg/45">
                  Охват
                </th>
                <th className="pb-2 text-right text-[10px] font-semibold uppercase tracking-wider text-app-fg/45">
                  Бюджет
                </th>
              </tr>
            </thead>
            <tbody>
              {rows.map((i) => (
                <tr key={i.id} className={tableBodyRowBorderClass}>
                  <td className="py-2.5 pr-3 text-xs uppercase tracking-wide text-app-fg/70">
                    {INTEGRATION_STATUS_LABELS[i.status]}
                  </td>
                  <td className="py-2.5 pr-3">
                    <Link
                      href={`/integrations/${i.id}`}
                      className="font-medium text-app-fg hover:text-app-accent"
                    >
                      {contractorName.get(i.contractorId) ?? i.contractorId}
                    </Link>
                  </td>
                  <td className="py-2.5 pr-3 text-app-fg/80">
                    {platformLabel(i.socialNetworkId)}
                  </td>
                  <td className="py-2.5 pr-3 tabular-nums text-app-fg/80">
                    {formatCalendarDate(i.releaseDate)}
                  </td>
                  <td className="py-2.5 pr-3 text-right tabular-nums">
                    {i.reach != null ? nfReach.format(i.reach) : "—"}
                  </td>
                  <td className="py-2.5 text-right tabular-nums">
                    {i.budget != null ? `${formatRuMoney(i.budget)} ₽` : "—"}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </HorizontalScrollTable>
      )}
    </DashboardChartSection>
  );
}
