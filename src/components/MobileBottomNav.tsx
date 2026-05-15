"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import {
  BarChart3,
  CheckSquare,
  FileText,
  LayoutList,
  MoreHorizontal,
  Package,
  Settings,
  Users,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { isActive } from "@/lib/nav-utils";
import { usePanelData } from "@/context/PanelDataContext";

const primaryItems: { href: string; label: string; icon: LucideIcon }[] = [
  { href: "/integrations", label: "Интеграции", icon: LayoutList },
  { href: "/contractors", label: "Контрагенты", icon: Users },
  { href: "/deliveries", label: "Доставки", icon: Package },
  { href: "/tasks", label: "Задачи", icon: CheckSquare },
];

const moreItems: { href: string; label: string; icon: LucideIcon; adminOnly?: boolean }[] = [
  { href: "/dashboard", label: "Дашборд", icon: BarChart3, adminOnly: true },
  { href: "/reports", label: "Отчёты", icon: FileText, adminOnly: true },
  { href: "/admin", label: "Админ", icon: Settings, adminOnly: true },
];

export function MobileBottomNav() {
  const pathname = usePathname() ?? "";
  const { isAdmin } = usePanelData();
  const [moreOpen, setMoreOpen] = useState(false);
  const moreRef = useRef<HTMLDivElement>(null);

  const moreActive = moreItems.some((item) => isActive(pathname, item.href));

  useEffect(() => {
    if (!moreOpen) return;
    const onPointerDown = (e: MouseEvent) => {
      if (!moreRef.current?.contains(e.target as Node)) setMoreOpen(false);
    };
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") setMoreOpen(false);
    };
    document.addEventListener("mousedown", onPointerDown);
    window.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("mousedown", onPointerDown);
      window.removeEventListener("keydown", onKeyDown);
    };
  }, [moreOpen]);

  const visibleMore = moreItems.filter((item) => !item.adminOnly || isAdmin);
  const showMoreMenu = visibleMore.length > 0;

  return (
    <nav
      aria-label="Мобильное меню"
      className="fixed inset-x-0 bottom-0 z-50 border-t border-app-fg/10 bg-app-bg pb-safe md:hidden"
    >
      <div className="flex h-14 items-stretch">
        {primaryItems.map(({ href, label, icon: Icon }) => {
          const active = isActive(pathname, href);
          return (
            <Link
              key={href}
              href={href}
              className={[
                "relative flex min-w-0 flex-1 flex-col items-center justify-center gap-0.5 px-1 transition",
                active ? "text-app-accent" : "text-app-fg/45 hover:text-app-fg/70",
              ].join(" ")}
            >
              {active && (
                <span
                  className="absolute inset-x-2 top-0 h-[3px] bg-app-accent"
                  aria-hidden
                />
              )}
              <Icon className="h-5 w-5 shrink-0" strokeWidth={1.75} aria-hidden />
              <span className="max-w-full truncate text-[9px] font-semibold uppercase leading-tight tracking-wide">
                {label}
              </span>
            </Link>
          );
        })}

        {showMoreMenu ? (
          <div ref={moreRef} className="relative flex min-w-0 flex-1">
            <button
              type="button"
              onClick={() => setMoreOpen((v) => !v)}
              className={[
                "relative flex h-full w-full flex-col items-center justify-center gap-0.5 px-1 transition",
                moreActive || moreOpen
                  ? "text-app-accent"
                  : "text-app-fg/45 hover:text-app-fg/70",
              ].join(" ")}
              aria-expanded={moreOpen}
              aria-haspopup="menu"
            >
              {(moreActive || moreOpen) && (
                <span
                  className="absolute inset-x-2 top-0 h-[3px] bg-app-accent"
                  aria-hidden
                />
              )}
              <MoreHorizontal className="h-5 w-5 shrink-0" strokeWidth={1.75} aria-hidden />
              <span className="max-w-full truncate text-[9px] font-semibold uppercase leading-tight tracking-wide">
                Ещё
              </span>
            </button>

            {moreOpen ? (
              <div
                role="menu"
                className="absolute bottom-full right-0 mb-1 min-w-[10rem] border border-app-fg/15 bg-app-bg py-1 shadow-accent-glow"
              >
                {visibleMore.map(({ href, label, icon: Icon }) => (
                  <Link
                    key={href}
                    href={href}
                    role="menuitem"
                    onClick={() => setMoreOpen(false)}
                    className={[
                      "flex items-center gap-2 px-3 py-2.5 text-[10px] font-semibold uppercase tracking-wide transition hover:bg-app-fg/[0.04]",
                      isActive(pathname, href) ? "text-app-accent" : "text-app-fg/80",
                    ].join(" ")}
                  >
                    <Icon className="h-4 w-4 shrink-0" strokeWidth={1.75} aria-hidden />
                    {label}
                  </Link>
                ))}
              </div>
            ) : null}
          </div>
        ) : null}
      </div>
    </nav>
  );
}
