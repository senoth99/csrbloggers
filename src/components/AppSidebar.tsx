"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useCallback, useEffect, useState } from "react";
import {
  BarChart3,
  CheckSquare,
  FileText,
  LayoutList,
  Package,
  PanelLeftClose,
  PanelLeftOpen,
  Settings,
  Users,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { isActive } from "@/lib/nav-utils";
import { usePanelData } from "@/context/PanelDataContext";

const STORAGE_KEY = "casher-sidebar-collapsed";

type NavItem = {
  href: string;
  label: string;
  icon: LucideIcon;
};

const workItems: NavItem[] = [
  { href: "/integrations", label: "Интеграции", icon: LayoutList },
  { href: "/contractors", label: "Контрагенты", icon: Users },
  { href: "/deliveries", label: "Доставки", icon: Package },
  { href: "/tasks", label: "Задачи", icon: CheckSquare },
];

const bottomItems: NavItem[] = [
  { href: "/dashboard", label: "Дашборд", icon: BarChart3 },
  { href: "/reports", label: "Отчёты", icon: FileText },
  { href: "/admin", label: "Админ", icon: Settings },
];

function NavLink({
  item,
  active,
  collapsed,
}: {
  item: NavItem;
  active: boolean;
  collapsed: boolean;
}) {
  const Icon = item.icon;
  return (
    <Link
      href={item.href}
      title={collapsed ? item.label : undefined}
      className={[
        "relative flex min-h-[44px] items-center gap-3 transition",
        collapsed ? "justify-center px-0" : "px-3",
        active
          ? "bg-app-accent/10 text-app-accent"
          : "text-app-fg/55 hover:bg-app-fg/5 hover:text-app-fg/80",
      ].join(" ")}
    >
      {active && (
        <span
          className="absolute left-0 top-1/2 h-6 w-[3px] -translate-y-1/2 bg-app-accent"
          aria-hidden
        />
      )}
      <Icon className="h-5 w-5 shrink-0" strokeWidth={1.75} aria-hidden />
      {!collapsed && (
        <span className="truncate text-xs font-semibold uppercase tracking-wide">{item.label}</span>
      )}
    </Link>
  );
}

export function AppSidebar({ className = "" }: { className?: string }) {
  const pathname = usePathname() ?? "";
  const { isAdmin } = usePanelData();
  const [collapsed, setCollapsed] = useState(false);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    try {
      setCollapsed(localStorage.getItem(STORAGE_KEY) === "true");
    } catch (err) {
      console.warn("AppSidebar: failed to read sidebar collapsed state", err);
    }
    setReady(true);
  }, []);

  useEffect(() => {
    if (!ready) return;
    try {
      localStorage.setItem(STORAGE_KEY, String(collapsed));
    } catch (err) {
      console.warn("AppSidebar: failed to persist sidebar collapsed state", err);
    }
  }, [collapsed, ready]);

  const toggle = useCallback(() => setCollapsed((c) => !c), []);

  return (
    <aside
      className={[
        "shrink-0 flex-col border-r border-app-fg/10 bg-app-bg transition-[width] duration-200 ease-out",
        "md:sticky md:top-0 md:z-20 md:flex md:h-full md:max-h-full md:self-start md:overflow-hidden",
        collapsed ? "w-14" : "w-[200px]",
        className,
      ].join(" ")}
      aria-label="Боковое меню"
    >
      <div className="flex h-10 shrink-0 items-center border-b border-app-fg/10">
        <button
          type="button"
          onClick={toggle}
          className={[
            "flex h-10 w-full items-center text-app-fg/55 transition hover:bg-app-fg/5 hover:text-app-fg",
            collapsed ? "justify-center" : "justify-end px-3",
          ].join(" ")}
          aria-label={collapsed ? "Развернуть меню" : "Свернуть меню"}
          aria-expanded={!collapsed}
        >
          {collapsed ? (
            <PanelLeftOpen className="h-5 w-5" strokeWidth={1.75} />
          ) : (
            <PanelLeftClose className="h-5 w-5" strokeWidth={1.75} />
          )}
        </button>
      </div>

      <div className="flex min-h-0 flex-1 flex-col">
      <nav className="shrink-0 py-1" aria-label="Рабочие разделы">
        {workItems.map((item) => (
          <NavLink
            key={item.href}
            item={item}
            active={isActive(pathname, item.href)}
            collapsed={collapsed}
          />
        ))}
      </nav>

      <div className="min-h-0 flex-1" aria-hidden />

      <div className="shrink-0 pb-2">
        <div className="border-t border-app-fg/10" aria-hidden />
        <nav className="py-1" aria-label="Аналитика и настройки">
          {bottomItems
            .filter((item) => item.href !== "/admin" || isAdmin)
            .map((item) => (
              <NavLink
                key={item.href}
                item={item}
                active={isActive(pathname, item.href)}
                collapsed={collapsed}
              />
            ))}
        </nav>
      </div>
      </div>
    </aside>
  );
}
