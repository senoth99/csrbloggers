"use client";

import { X } from "lucide-react";

export type FilterChip = {
  id: string;
  label: string;
  onRemove: () => void;
};

export type FilterChipsProps = {
  chips: FilterChip[];
};

export function FilterChips({ chips }: FilterChipsProps) {
  if (chips.length === 0) return null;

  return (
    <div className="flex flex-wrap gap-2">
      {chips.map((chip) => (
        <span
          key={chip.id}
          className="inline-flex max-w-full items-center gap-1 border border-app-fg/15 bg-app-fg/[0.06] px-2 py-1 text-[10px] font-semibold uppercase tracking-wide text-app-fg sm:text-[11px]"
        >
          <span className="truncate">{chip.label}</span>
          <button
            type="button"
            onClick={chip.onRemove}
            className="shrink-0 p-0.5 text-app-fg/55 transition hover:text-app-fg"
            aria-label={`Убрать фильтр: ${chip.label}`}
          >
            <X className="h-3 w-3" strokeWidth={2} />
          </button>
        </span>
      ))}
    </div>
  );
}
