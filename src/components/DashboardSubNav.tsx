"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const links = [
  { href: "/dashboard", label: "Обзор", matchExact: true as boolean },
  { href: "/dashboard/integrations", label: "Интеграции", matchExact: false as boolean },
  { href: "/dashboard/deliveries", label: "Доставки", matchExact: false as boolean },
  { href: "/dashboard/employees", label: "Сотрудники", matchExact: false as boolean },
] as const;

function active(pathname: string, href: string, exact: boolean) {
  if (exact) return pathname === href;
  return pathname === href || pathname.startsWith(`${href}/`);
}

export function DashboardSubNav() {
  const pathname = usePathname() ?? "";

  return (
    <nav
      aria-label="Разделы дашборда"
      className="mb-6 flex min-w-0 max-w-full gap-1 overflow-x-auto overflow-y-hidden border-b border-app-fg/[0.08] pb-0 [-ms-overflow-style:none] [scrollbar-width:none] sm:mb-8 [&::-webkit-scrollbar]:hidden"
      style={{ WebkitOverflowScrolling: "touch" }}
    >
      {links.map(({ href, label, matchExact }) => {
        const isActive = active(pathname, href, matchExact);
        return (
          <Link
            key={href}
            href={href}
            className={[
              "-mb-px shrink-0 whitespace-nowrap border-b-2 px-3 pb-3 pt-1 text-[11px] font-medium uppercase tracking-[0.14em] transition sm:px-3",
              isActive
                ? "border-app-accent text-app-fg"
                : "border-transparent text-app-fg/45 hover:border-app-fg/20",
            ].join(" ")}
          >
            {label}
          </Link>
        );
      })}
    </nav>
  );
}
