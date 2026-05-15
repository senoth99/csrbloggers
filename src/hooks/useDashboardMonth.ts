"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import {
  currentYearMonth,
  formatYearMonthString,
  parseYearMonthString,
  type YearMonth,
} from "@/lib/dashboard-metrics";

const STORAGE_KEY = "casher-dashboard-month-v1";

function readStoredMonth(): YearMonth | null {
  if (typeof window === "undefined") return null;
  try {
    return parseYearMonthString(localStorage.getItem(STORAGE_KEY));
  } catch {
    return null;
  }
}

function writeStoredMonth(ym: YearMonth) {
  try {
    localStorage.setItem(STORAGE_KEY, formatYearMonthString(ym));
  } catch {
    /* ignore */
  }
}

export function useDashboardMonth() {
  const search = useSearchParams();
  const router = useRouter();
  const pathname = usePathname() ?? "/dashboard";
  const mParam = search?.get("m") ?? null;

  const ymFromUrl = useMemo(
    () => parseYearMonthString(mParam),
    [mParam],
  );

  const [liveCurrentYm, setLiveCurrentYm] = useState(currentYearMonth);

  useEffect(() => {
    if (mParam) return;
    const tick = () => {
      const next = currentYearMonth();
      setLiveCurrentYm((prev) =>
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
  }, [mParam]);

  const ym = useMemo(() => {
    if (ymFromUrl) return ymFromUrl;
    const stored = readStoredMonth();
    if (stored) return stored;
    return liveCurrentYm;
  }, [ymFromUrl, liveCurrentYm]);

  useEffect(() => {
    writeStoredMonth(ym);
  }, [ym]);

  const setMonth = useCallback(
    (next: YearMonth) => {
      writeStoredMonth(next);
      const params = new URLSearchParams(search?.toString() ?? "");
      params.set("m", formatYearMonthString(next));
      const qs = params.toString();
      router.replace(qs ? `${pathname}?${qs}` : pathname, { scroll: false });
    },
    [router, pathname, search],
  );

  return { ym, setMonth, monthInputValue: formatYearMonthString(ym) };
}
