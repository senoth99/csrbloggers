"use client";

import { useEffect, useRef, useState, type KeyboardEvent } from "react";
import { ChevronDown } from "lucide-react";
import { CrmPill } from "@/components/CrmPill";

export type StatusBadgeDropdownProps = {
  value: string;
  options: { value: string; label: string }[];
  badgeClass: string;
  onChange: (v: string) => void;
  disabled?: boolean;
};

export function StatusBadgeDropdown({
  value,
  options,
  badgeClass,
  onChange,
  disabled = false,
}: StatusBadgeDropdownProps) {
  const [open, setOpen] = useState(false);
  const [highlightIndex, setHighlightIndex] = useState(-1);
  const rootRef = useRef<HTMLDivElement>(null);
  const listRef = useRef<HTMLDivElement>(null);

  const currentLabel = options.find((o) => o.value === value)?.label ?? value;

  useEffect(() => {
    if (!open) return;
    const onPointerDown = (e: MouseEvent) => {
      if (!rootRef.current?.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", onPointerDown);
    return () => document.removeEventListener("mousedown", onPointerDown);
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const onKeyDown = (e: globalThis.KeyboardEvent) => {
      if (e.key === "Escape") {
        e.preventDefault();
        setOpen(false);
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [open]);

  useEffect(() => {
    if (open) {
      const idx = options.findIndex((o) => o.value === value);
      setHighlightIndex(idx >= 0 ? idx : 0);
    } else {
      setHighlightIndex(-1);
    }
  }, [open, options, value]);

  const onTriggerKeyDown = (e: KeyboardEvent<HTMLButtonElement>) => {
    if (disabled) return;
    if (e.key === "ArrowDown" || e.key === "Enter" || e.key === " ") {
      e.preventDefault();
      setOpen(true);
    }
  };

  const onListKeyDown = (e: KeyboardEvent<HTMLDivElement>) => {
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setHighlightIndex((i) => (i + 1) % options.length);
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setHighlightIndex((i) => (i <= 0 ? options.length - 1 : i - 1));
    } else if (e.key === "Enter" || e.key === " ") {
      e.preventDefault();
      const opt = options[highlightIndex];
      if (opt) {
        onChange(opt.value);
        setOpen(false);
      }
    } else if (e.key === "Escape") {
      e.preventDefault();
      setOpen(false);
    }
  };

  useEffect(() => {
    if (!open || highlightIndex < 0) return;
    const btn = listRef.current?.querySelectorAll<HTMLButtonElement>('[role="option"]')[
      highlightIndex
    ];
    btn?.scrollIntoView({ block: "nearest" });
  }, [highlightIndex, open]);

  return (
    <div ref={rootRef} className="relative inline-block max-w-full">
      <button
        type="button"
        disabled={disabled}
        onClick={(e) => {
          e.stopPropagation();
          if (!disabled) setOpen((v) => !v);
        }}
        onKeyDown={onTriggerKeyDown}
        className="inline-flex max-w-full items-center gap-0.5 disabled:cursor-not-allowed disabled:opacity-50"
        aria-haspopup="listbox"
        aria-expanded={open}
      >
        <CrmPill className={badgeClass}>{currentLabel}</CrmPill>
        <ChevronDown
          className="h-3.5 w-3.5 shrink-0 text-app-fg/70"
          strokeWidth={1.5}
          aria-hidden
        />
      </button>

      {open && !disabled ? (
        <div
          ref={listRef}
          role="listbox"
          tabIndex={-1}
          onKeyDown={onListKeyDown}
          className="absolute left-0 top-full z-30 mt-1 min-w-[8rem] border border-app-fg/15 bg-app-bg py-1 shadow-accent-glow outline-none focus:ring-2 focus:ring-app-accent/35"
          onClick={(e) => e.stopPropagation()}
        >
          {options.map((opt, idx) => (
            <button
              key={opt.value}
              type="button"
              role="option"
              aria-selected={opt.value === value}
              onClick={(e) => {
                e.stopPropagation();
                onChange(opt.value);
                setOpen(false);
              }}
              className={`block w-full px-3 py-2 text-left text-[10px] font-semibold uppercase tracking-wide transition hover:bg-app-fg/[0.04] sm:text-[11px] ${
                opt.value === value || idx === highlightIndex
                  ? "bg-app-fg/[0.04] text-app-fg"
                  : "text-app-fg/80"
              }`}
            >
              {opt.label}
            </button>
          ))}
        </div>
      ) : null}
    </div>
  );
}
