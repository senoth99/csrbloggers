"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { DASHBOARD_NAV_ITEMS, dashboardNavActive } from "@/lib/dashboard-nav";
import { DashboardNavBar, dashboardTabClass } from "@/components/dashboard/DashboardNavBar";

export function DashboardSubNav() {
  const pathname = usePathname() ?? "";
  const onDashboard = pathname === "/dashboard" || pathname.startsWith("/dashboard/");

  if (!onDashboard) return null;

  return (
    <DashboardNavBar ariaLabel="Разделы дашборда">
      {DASHBOARD_NAV_ITEMS.map(({ href, label }) => (
        <Link
          key={href}
          href={href}
          className={dashboardTabClass(dashboardNavActive(pathname, href))}
        >
          {label}
        </Link>
      ))}
    </DashboardNavBar>
  );
}
