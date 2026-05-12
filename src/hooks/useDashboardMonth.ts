"use client";

import { useCallback, useMemo } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import {
  currentYearMonth,
  formatYearMonthString,
  parseYearMonthString,
  type YearMonth,
} from "@/lib/dashboard-metrics";

export function useDashboardMonth() {
  const search = useSearchParams();
  const router = useRouter();
  const pathname = usePathname() ?? "/dashboard";

  const ym = useMemo(
    () => parseYearMonthString(search?.get("m") ?? null) ?? currentYearMonth(),
    [search],
  );

  const setMonth = useCallback(
    (next: YearMonth) => {
      const q = formatYearMonthString(next);
      router.replace(`${pathname}?m=${q}`, { scroll: false });
    },
    [router, pathname],
  );

  return { ym, setMonth, monthInputValue: formatYearMonthString(ym) };
}
