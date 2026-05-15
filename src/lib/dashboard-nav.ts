/** Четыре страницы дашборда */
export const DASHBOARD_NAV_ITEMS = [
  { id: "overview", label: "Обзор", href: "/dashboard" },
  { id: "integrations", label: "Интеграции", href: "/dashboard/integrations" },
  { id: "deliveries", label: "Доставки", href: "/dashboard/deliveries" },
  { id: "employees", label: "Сотрудники", href: "/dashboard/employees" },
] as const;

export type DashboardNavId = (typeof DASHBOARD_NAV_ITEMS)[number]["id"];

export function dashboardNavActive(pathname: string, href: string): boolean {
  if (href === "/dashboard") {
    return pathname === "/dashboard";
  }
  return pathname === href || pathname.startsWith(`${href}/`);
}
