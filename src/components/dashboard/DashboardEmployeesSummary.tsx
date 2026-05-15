"use client";

import { useMemo } from "react";
import Link from "next/link";
import type { Delivery, Employee, Integration } from "@/types/panel-data";
import {
  abbreviateFio,
  buildLeaderboardForYearMonth,
} from "@/lib/employee-utils";
import { type YearMonth } from "@/lib/dashboard-metrics";
import { EmployeeAvatar } from "@/components/EmployeeAvatar";
import {
  DashboardChartSection,
  listDivideClass,
} from "@/screens/dashboard-shared";

type Props = {
  ym: YearMonth;
  employees: Employee[];
  integrations: Integration[];
  deliveries: Delivery[];
};

export function DashboardEmployeesSummary({
  ym,
  employees,
  integrations,
  deliveries,
}: Props) {
  const leaderboard = useMemo(
    () => buildLeaderboardForYearMonth(employees, integrations, deliveries, ym),
    [employees, integrations, deliveries, ym],
  );

  return (
    <section id="employees" className="scroll-mt-6">
      <DashboardChartSection
        title="Сотрудники"
        action={
          <Link
            href="/admin"
            className="text-xs font-medium uppercase tracking-wide text-app-fg/55 hover:text-app-accent"
          >
            Управление →
          </Link>
        }
      >
        {employees.length === 0 ? (
          <p className="border border-dashed border-app-fg/15 px-4 py-10 text-center text-sm text-app-fg/55">
            Сотрудников пока нет.
          </p>
        ) : (
          <ul className={listDivideClass}>
            {leaderboard.slice(0, 8).map((row) => (
              <li
                key={row.employee.id}
                className="flex flex-wrap items-center gap-4 py-3.5"
              >
                <span className="w-8 shrink-0 tabular-nums text-sm font-semibold text-app-fg/55">
                  {row.rank}
                </span>
                <EmployeeAvatar employee={row.employee} size={40} showTopCrown={row.rank === 1} />
                <div className="min-w-0 flex-1">
                  <p className="font-medium text-app-fg">
                    {abbreviateFio(row.employee.fullName)}
                  </p>
                  <p className="text-xs text-app-fg/50">
                    инт. {row.integrations} · дост. {row.deliveries}
                  </p>
                </div>
                <span className="shrink-0 tabular-nums text-sm font-semibold text-app-fg">
                  {row.score}
                </span>
              </li>
            ))}
          </ul>
        )}
      </DashboardChartSection>
    </section>
  );
}
