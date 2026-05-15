"use client";

import type { ReactNode } from "react";
import { Suspense } from "react";
import { DashboardHashRedirect } from "@/components/dashboard/DashboardHashRedirect";
import { DashboardSubNav } from "@/components/DashboardSubNav";

export function DashboardLayoutShell({ children }: { children: ReactNode }) {
  return (
    <div className="w-full min-w-0 max-w-full">
      <Suspense fallback={null}>
        <DashboardHashRedirect />
      </Suspense>
      <DashboardSubNav />
      {children}
    </div>
  );
}
