"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useAuth } from "@/context/AuthContext";
import { isPanelAdminRole } from "@/lib/panel-auth-utils";
import { isActive } from "@/lib/nav-utils";

const navItems = [
  { href: "/integrations", label: "Интеграции" },
  { href: "/contractors", label: "Контрагенты" },
  { href: "/dashboard", label: "Дашборд", adminOnly: true },
  { href: "/deliveries", label: "Доставки" },
  { href: "/tasks", label: "Задачи" },
  { href: "/reports", label: "Отчёты", adminOnly: true },
] as const;

function linkClass(active: boolean) {
  return [
    "flex min-h-[40px] min-w-0 flex-1 basis-0 items-center justify-center overflow-hidden text-ellipsis whitespace-nowrap border-r border-app-fg/10 px-[clamp(0.25rem,1.5vw,1rem)] py-[clamp(0.35rem,1vw,0.65rem)] text-center font-semibold uppercase leading-snug tracking-wide transition last:border-r-0",
    "text-[clamp(0.625rem,calc(0.48rem+0.45vw),1rem)]",
    active ? "bg-app-accent text-app-fg" : "text-app-fg/55 hover:bg-app-fg/5",
  ].join(" ");
}

export function MainMenuNav() {
  const pathname = usePathname() ?? "";
  const { role } = useAuth();
  const isAdmin = isPanelAdminRole(role);
  const visibleItems = navItems.filter((item) => !("adminOnly" in item && item.adminOnly) || isAdmin);

  return (
    <nav aria-label="Основное меню" className="w-full shrink-0 border-b border-app-fg/10 bg-app-bg">
      <div className="h-px w-full bg-app-fg/10" aria-hidden />
      <div className="px-3 sm:px-4 md:px-6">
        <div
          className="flex w-full min-w-0 overflow-x-auto overscroll-x-contain [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
          style={{ WebkitOverflowScrolling: "touch" }}
        >
          {visibleItems.map(({ href, label }) => {
            const active = isActive(pathname, href);
            return (
              <Link key={href} href={href} className={linkClass(active)} title={label}>
                {label}
              </Link>
            );
          })}
        </div>
      </div>
    </nav>
  );
}
