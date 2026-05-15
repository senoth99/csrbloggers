"use client";

import { useMemo } from "react";
import { DashboardChartSection } from "@/screens/dashboard-shared";

const nf = new Intl.NumberFormat("ru-RU", { maximumFractionDigits: 0 });

/** Высота зоны столбиков (px): явная высота, чтобы столбики стабильно рисовались */
const CHART_TRACK_PX = 192;

type Props = {
  dailyReach: number[];
};

/** Столбиковый график охватов по дням календарного месяца */
export function ReachByDayBarChart({ dailyReach }: Props) {
  const maxVal = Math.max(1, ...dailyReach);

  const ariaLabel = useMemo(() => {
    if (dailyReach.length === 0) return "Охваты по дням месяца: нет данных";
    const total = dailyReach.reduce((sum, r) => sum + r, 0);
    const daysWithData = dailyReach.filter((r) => r > 0).length;
    const peak = Math.max(...dailyReach);
    const peakDay = dailyReach.indexOf(peak) + 1;
    return [
      `Охваты по дням месяца, ${dailyReach.length} дней.`,
      `Сумма ${nf.format(total)}.`,
      `Дней с данными: ${daysWithData}.`,
      peak > 0 ? `Максимум ${nf.format(peak)} в день ${peakDay}.` : "Все дни без охватов.",
    ].join(" ");
  }, [dailyReach]);

  return (
    <DashboardChartSection title="Охваты по дням месяца">
      {dailyReach.length === 0 ? (
        <p className="py-12 text-center text-sm text-app-fg/45">Нет данных по дням.</p>
      ) : (
        <div
          className="w-full min-w-0"
          role="img"
          aria-label={ariaLabel}
        >
          <div className="flex w-full min-w-0 items-stretch gap-px sm:gap-0.5">
            {dailyReach.map((reach, i) => {
              const day = i + 1;
              const has = reach > 0;
              let barPx: number;
              if (!has) {
                barPx = 2;
              } else {
                barPx = Math.round((reach / maxVal) * CHART_TRACK_PX);
                barPx = Math.max(4, barPx);
              }
              return (
                <div
                  key={day}
                  className="group flex min-w-0 flex-1 flex-col gap-1.5 sm:gap-2"
                  title={
                    has ? `${day}: ${nf.format(reach)} охватов` : `${day}: нет данных`
                  }
                >
                  <div
                    className="flex w-full flex-col justify-end rounded-sm bg-app-fg/[0.06]"
                    style={{ height: CHART_TRACK_PX }}
                  >
                    <div
                      aria-hidden="true"
                      className={`w-full shrink-0 rounded-t-[3px] transition-[height] duration-300 ease-out ${
                        has
                          ? "bg-app-accent/90 ring-[0.5px] ring-app-accent/40"
                          : "bg-app-fg/[0.14]"
                      }`}
                      style={{ height: barPx }}
                    />
                  </div>
                  <div className="text-center tabular-nums leading-none">
                    <span
                      className={`text-[9px] sm:text-[10px] ${has ? "font-semibold text-app-fg/55" : "text-app-fg/25"}`}
                    >
                      {day}
                    </span>
                  </div>
                </div>
              );
            })}
          </div>

          <div className="mt-3 flex w-full justify-between border-t border-app-fg/[0.06] pt-2 text-[10px] text-app-fg/35 tabular-nums sm:mt-4 sm:pt-3">
            <span>1</span>
            <span className="text-app-fg/25">день месяца</span>
            <span>{dailyReach.length}</span>
          </div>
        </div>
      )}
    </DashboardChartSection>
  );
}
