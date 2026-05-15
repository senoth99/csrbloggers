import type { ReactNode } from "react";
import { AdminRouteGuard } from "@/components/AdminRouteGuard";
import { DashboardLayoutShell } from "@/components/dashboard/DashboardLayoutShell";

export default function DashboardLayout({ children }: { children: ReactNode }) {
  return (
    <AdminRouteGuard>
      <DashboardLayoutShell>{children}</DashboardLayoutShell>
    </AdminRouteGuard>
  );
}
