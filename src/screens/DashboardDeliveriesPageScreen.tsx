"use client";

import { ChevronLeft, ChevronRight } from "lucide-react";
import { DashboardDeliveriesSummary } from "@/components/dashboard/DashboardDeliveriesSummary";
import { usePanelData } from "@/context/PanelDataContext";
import { useDashboardMonth } from "@/hooks/useDashboardMonth";
import { shiftYearMonth } from "@/lib/dashboard-metrics";
import {
  dashboardMonthInputClass,
  dashboardMonthNavButtonClass,
  dashboardMonthPickerRowClass,
  dashboardPageTitleClass,
} from "@/screens/dashboard-shared";

export function DashboardDeliveriesPageScreen() {
  const { ym, setMonth, monthInputValue } = useDashboardMonth();
  const { deliveries, contractors } = usePanelData();

  return (
    <div className="space-y-8 pb-10">
      <header className="flex flex-col gap-5 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex flex-col gap-1">
          <p className="text-[10px] font-semibold uppercase tracking-[0.22em] text-app-fg/40">
            Дашборд
          </p>
          <h1 className={dashboardPageTitleClass}>Доставки</h1>
        </div>

        <div className="flex min-w-0 flex-col gap-1">
          <label
            htmlFor="dashboard-month-deliveries-page"
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
              id="dashboard-month-deliveries-page"
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

      <DashboardDeliveriesSummary ym={ym} deliveries={deliveries} contractors={contractors} />
    </div>
  );
}
