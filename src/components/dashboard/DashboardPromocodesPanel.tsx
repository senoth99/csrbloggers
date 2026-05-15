"use client";

import { useMemo } from "react";
import type { Contractor } from "@/types/panel-data";
import { DashboardChartSection, listDivideClass } from "@/screens/dashboard-shared";

const nf = new Intl.NumberFormat("ru-RU", { maximumFractionDigits: 0 });

type Props = {
  contractors: Contractor[];
  promoDeltaByCodeKey: Map<string, number>;
};

export function DashboardPromocodesPanel({ contractors, promoDeltaByCodeKey }: Props) {
  const rows = useMemo(() => {
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
      .sort(
        (a, b) =>
          ((b!.activations ?? -1) as number) - ((a!.activations ?? -1) as number),
      )
      .slice(0, 12) as Array<{
      contractorId: string;
      contractorName: string;
      code: string;
      activations: number | undefined;
    }>;
  }, [contractors, promoDeltaByCodeKey]);

  const total = useMemo(
    () => rows.reduce((acc, r) => acc + (r.activations ?? 0), 0),
    [rows],
  );

  if (rows.length === 0) {
    return (
      <DashboardChartSection title="Промокоды (Δ за месяц)">
        <p className="py-6 text-center text-sm text-app-fg/45">
          Нет промокодов у контрагентов или данных Casher API.
        </p>
      </DashboardChartSection>
    );
  }

  return (
    <DashboardChartSection title="Промокоды (Δ за месяц)">
      <p className="mb-4 text-xs font-medium tabular-nums text-app-fg/70">
        Casher API · всего: {nf.format(total)}
      </p>
      <ul className={`rounded-sm border border-app-fg/10 ${listDivideClass}`}>
        {rows.map((r) => (
          <li
            key={`${r.contractorId}:${r.code}`}
            className="flex items-center justify-between gap-4 px-4 py-3"
          >
            <div className="min-w-0">
              <p className="truncate text-sm font-medium text-app-fg">{r.contractorName}</p>
              <p className="mt-0.5 text-xs text-app-fg/55">{r.code}</p>
            </div>
            <div className="shrink-0 text-right tabular-nums text-app-fg">
              {r.activations != null ? nf.format(r.activations) : "—"}
            </div>
          </li>
        ))}
      </ul>
    </DashboardChartSection>
  );
}
