import type { ReactNode } from "react";
import { DashboardSubNav } from "@/components/DashboardSubNav";

export default function DashboardLayout({ children }: { children: ReactNode }) {
  return (
    <div className="min-w-0">
      <DashboardSubNav />
      {children}
    </div>
  );
}
