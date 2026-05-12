"use client";

import type { ReactNode } from "react";
import { ArrowDown, ArrowUp } from "lucide-react";
import type { SortDir } from "@/hooks/useTableSort";

type Align = "left" | "right" | "center";

function alignClass(align: Align): string {
  if (align === "right") return "justify-end text-right";
  if (align === "center") return "justify-center text-center";
  return "justify-start text-left";
}

type SortHeaderButtonProps = {
  children: ReactNode;
  active: boolean;
  sortDir: SortDir;
  onClick: () => void;
  align?: Align;
  className?: string;
};

/** Кнопка заголовка для сетки (не <th>). */
export function SortHeaderButton({
  children,
  active,
  sortDir,
  onClick,
  align = "left",
  className = "",
}: SortHeaderButtonProps) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`group inline-flex w-full min-w-0 items-center gap-1 py-0.5 text-inherit transition hover:text-app-fg ${alignClass(align)} ${className}`.trim()}
      aria-sort={active ? (sortDir === "asc" ? "ascending" : "descending") : "none"}
    >
      <span className="min-w-0">{children}</span>
      {active ? (
        sortDir === "asc" ? (
          <ArrowUp className="h-3 w-3 shrink-0 text-app-accent" strokeWidth={2.5} aria-hidden />
        ) : (
          <ArrowDown className="h-3 w-3 shrink-0 text-app-accent" strokeWidth={2.5} aria-hidden />
        )
      ) : (
        <ArrowUp
          className="h-3 w-3 shrink-0 opacity-0 transition group-hover:opacity-35"
          strokeWidth={2}
          aria-hidden
        />
      )}
    </button>
  );
}

type SortableThProps = {
  children: ReactNode;
  columnKey: string;
  sortKey: string | null;
  sortDir: SortDir;
  onSort: (key: string) => void;
  className?: string;
  align?: Align;
};

export function SortableTh({
  children,
  columnKey,
  sortKey,
  sortDir,
  onSort,
  className = "",
  align = "left",
}: SortableThProps) {
  const active = sortKey === columnKey;
  return (
    <th scope="col" className={className.trim()}>
      <SortHeaderButton
        active={active}
        sortDir={sortDir}
        align={align}
        onClick={() => onSort(columnKey)}
      >
        {children}
      </SortHeaderButton>
    </th>
  );
}
