"use client";

import { Crown } from "lucide-react";
import { useState } from "react";
import type { Employee } from "@/types/panel-data";
import { abbreviateFio, employeeDisplayAvatarUrl } from "@/lib/employee-utils";

function initials(e: Employee): string {
  const parts = e.fullName.trim().split(/\s+/).filter(Boolean);
  if (parts.length >= 2) {
    return (parts[0]![0] + parts[1]![0]).toUpperCase();
  }
  const one = (parts[0] ?? e.telegramUsername) || "?";
  return one.slice(0, 2).toUpperCase();
}

type Props = {
  employee: Employee;
  size?: number;
  className?: string;
  showTopCrown?: boolean;
  showTitle?: boolean;
};

export function EmployeeAvatar({
  employee,
  size = 40,
  className = "",
  showTopCrown,
  showTitle = false,
}: Props) {
  const url = employeeDisplayAvatarUrl(employee);
  const [broken, setBroken] = useState(false);
  const title = showTitle
    ? `${abbreviateFio(employee.fullName)} @${employee.telegramUsername}`
    : undefined;

  const crownPx = Math.min(22, Math.max(15, Math.round(size * 0.36)));

  return (
    <div
      className={`relative inline-flex shrink-0 flex-col items-center ${className}`}
      title={title}
      style={{ width: size, minWidth: size, height: size }}
    >
      {showTopCrown ? (
        <Crown
          className="pointer-events-none absolute left-1/2 top-0 z-[2] -translate-x-1/2 -translate-y-[42%] text-amber-300 drop-shadow-[0_0_10px_rgba(251,191,72,0.55)]"
          width={crownPx}
          height={crownPx}
          strokeWidth={1.85}
          aria-hidden
        />
      ) : null}
      <div
        className="relative z-0 overflow-hidden bg-zinc-800 ring-1 ring-zinc-700"
        style={{ width: size, height: size }}
      >
        {!broken ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={url}
            alt=""
            className="h-full w-full object-cover"
            loading="lazy"
            onError={() => setBroken(true)}
          />
        ) : (
          <div className="flex h-full w-full items-center justify-center bg-zinc-700 text-[10px] font-semibold text-zinc-200">
            {initials(employee)}
          </div>
        )}
      </div>
    </div>
  );
}
