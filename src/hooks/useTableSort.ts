"use client";

import { useCallback, useState } from "react";

export type SortDir = "asc" | "desc";

export type TableSortState<K extends string> = { key: K; dir: SortDir } | null;

/**
 * Сортировка по клику: первый клик — по возрастанию, следующий — по убыванию.
 */
export function useTableSort<K extends string>() {
  const [sort, setSort] = useState<TableSortState<K>>(null);

  const toggleSort = useCallback((key: K) => {
    setSort((prev) => {
      if (!prev || prev.key !== key) return { key, dir: "asc" };
      return { key, dir: prev.dir === "asc" ? "desc" : "asc" };
    });
  }, []);

  return {
    sort,
    toggleSort,
    sortKey: sort?.key ?? null,
    sortDir: sort?.dir ?? "asc",
  };
}
