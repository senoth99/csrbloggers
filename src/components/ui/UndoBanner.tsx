"use client";

import { X } from "lucide-react";

export type UndoBannerProps = {
  message: string;
  onUndo: () => void;
  onDismiss: () => void;
  visible: boolean;
};

export function UndoBanner({
  message,
  onUndo,
  onDismiss,
  visible,
}: UndoBannerProps) {
  if (!visible) return null;

  return (
    <div
      role="status"
      className="fixed bottom-4 left-1/2 z-[70] flex w-[calc(100%-2rem)] max-w-md -translate-x-1/2 items-center gap-3 border border-app-fg/15 bg-app-bg px-4 py-3 text-sm text-app-fg shadow-accent-glow sm:bottom-6"
    >
      <p className="min-w-0 flex-1 text-xs sm:text-sm">{message}</p>
      <button
        type="button"
        onClick={onUndo}
        className="shrink-0 text-xs font-semibold uppercase tracking-wide text-app-accent transition hover:brightness-125"
      >
        Отменить
      </button>
      <button
        type="button"
        onClick={onDismiss}
        className="shrink-0 border border-app-fg/15 p-1 text-app-fg/70 transition hover:border-app-fg/40"
        aria-label="Закрыть"
      >
        <X className="h-3.5 w-3.5" strokeWidth={1.5} />
      </button>
    </div>
  );
}
