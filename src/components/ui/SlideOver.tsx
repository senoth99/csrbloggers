"use client";

import { useEffect, useId, useRef, useState, type ReactNode } from "react";
import { X } from "lucide-react";
import { useDialogA11y } from "@/lib/focus-trap";

export type SlideOverProps = {
  open: boolean;
  onClose: () => void;
  title?: string;
  children: ReactNode;
  footer?: ReactNode;
  widthClass?: string;
  /** omit top bar when child provides its own header (e.g. detail drawer) */
  hideHeader?: boolean;
};

export function SlideOver({
  open,
  onClose,
  title,
  children,
  footer,
  widthClass = "max-w-lg",
  hideHeader = false,
}: SlideOverProps) {
  const titleId = useId();
  const panelRef = useRef<HTMLDivElement>(null);
  const [shouldRender, setShouldRender] = useState(open);
  const [isVisible, setIsVisible] = useState(false);

  const dialogActive = open && shouldRender && isVisible;
  const { onKeyDownTrap } = useDialogA11y(dialogActive, onClose, panelRef);

  useEffect(() => {
    if (open) {
      setShouldRender(true);
      const frame = requestAnimationFrame(() => setIsVisible(true));
      return () => cancelAnimationFrame(frame);
    }
    setIsVisible(false);
    const timer = window.setTimeout(() => setShouldRender(false), 200);
    return () => window.clearTimeout(timer);
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = prevOverflow;
    };
  }, [open]);

  if (!shouldRender) return null;

  return (
    <div className="fixed inset-0 z-50" role="presentation" onClick={onClose}>
      <div
        className={`absolute inset-0 bg-black/50 transition-opacity duration-200 ${
          isVisible ? "opacity-100" : "opacity-0"
        }`}
        aria-hidden
        inert
      />
      <div
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby={title ? titleId : undefined}
        className={`fixed flex flex-col border-app-fg/10 bg-app-bg text-app-fg shadow-accent-glow transition-transform duration-200 ease-out
          inset-x-0 bottom-0 max-h-[80vh] rounded-t-xl border-t
          md:inset-y-0 md:right-0 md:left-auto md:h-full md:max-h-none md:w-full md:rounded-none md:border-l md:border-t-0 ${widthClass}
          ${isVisible ? "translate-y-0 md:translate-x-0" : "translate-y-full md:translate-x-full md:translate-y-0"}`}
        onClick={(e) => e.stopPropagation()}
        onKeyDown={onKeyDownTrap}
      >
        {!hideHeader ? (
          <header className="flex shrink-0 items-start justify-between gap-3 border-b border-app-fg/10 px-4 py-3 sm:px-5 sm:py-4">
            {title ? (
              <h2
                id={titleId}
                className="text-sm font-semibold uppercase tracking-[0.12em] text-app-fg"
              >
                {title}
              </h2>
            ) : (
              <span className="flex-1" />
            )}
            <button
              type="button"
              onClick={onClose}
              className="shrink-0 border border-app-fg/15 p-1.5 text-app-fg/70 transition hover:border-app-fg/40"
              aria-label="Закрыть"
            >
              <X className="h-4 w-4" strokeWidth={1.5} />
            </button>
          </header>
        ) : null}
        <div
          className={`min-h-0 flex-1 overflow-y-auto ${hideHeader ? "" : "px-4 py-4 sm:px-5"}`}
        >
          {children}
        </div>
        {footer ? (
          <footer className="sticky bottom-0 shrink-0 border-t border-app-fg/10 bg-app-bg px-4 py-3 sm:px-5 sm:py-4">
            {footer}
          </footer>
        ) : null}
      </div>
    </div>
  );
}
