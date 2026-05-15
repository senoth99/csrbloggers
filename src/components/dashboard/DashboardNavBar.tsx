"use client";

import type { ReactNode } from "react";

const tabBase =
  "flex flex-1 items-center justify-center border-b-2 px-2 pb-3 pt-1 text-center text-[11px] font-medium uppercase tracking-[0.14em] transition sm:px-3";

export function dashboardTabClass(active: boolean): string {
  return [
    tabBase,
    active
      ? "border-app-accent text-app-fg"
      : "border-transparent text-app-fg/45 hover:border-app-fg/20 hover:text-app-fg/70",
  ].join(" ");
}

export function DashboardNavBar({
  ariaLabel,
  children,
  className = "",
}: {
  ariaLabel: string;
  children: ReactNode;
  className?: string;
}) {
  return (
    <nav
      aria-label={ariaLabel}
      className={[
        "mb-4 w-[calc(100%+1.5rem)] min-w-0 -mx-3 border-b border-app-fg/[0.08] sm:mb-6 sm:w-[calc(100%+2rem)] sm:-mx-4 md:w-[calc(100%+3rem)] md:-mx-6",
        className,
      ].join(" ")}
    >
      <div className="flex w-full min-w-0">{children}</div>
    </nav>
  );
}
