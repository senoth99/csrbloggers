import type { ReactNode } from "react";

export function CrmPill({
  children,
  className = "",
}: {
  children: ReactNode;
  className?: string;
}) {
  return (
    <span
      className={`inline-flex max-w-full shrink-0 items-center truncate px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide sm:text-[11px] ${className}`}
    >
      {children}
    </span>
  );
}
