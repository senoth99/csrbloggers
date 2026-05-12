"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { LogOut } from "lucide-react";
import { useAuth } from "@/context/AuthContext";

export function Header() {
  const { logout } = useAuth();
  const router = useRouter();

  return (
    <header className="relative shrink-0 bg-app-bg pt-safe">
      <div className="relative flex min-h-[44px] w-full items-center justify-center sm:min-h-[48px]">
        <Link
          href="/dashboard"
          className="flex items-center justify-center py-2"
          aria-label="На дашборд"
        >
          <img
            src="/casher-logo.png"
            alt="Casher"
            className="h-8 w-auto max-w-[120px] object-contain md:h-9 md:max-w-[132px]"
            draggable={false}
          />
        </Link>
        <button
          type="button"
          onClick={() => {
            logout();
            router.replace("/login");
          }}
          className="absolute right-2 top-1/2 flex -translate-y-1/2 items-center gap-1.5 border border-app-fg/15 px-2.5 py-1.5 text-[10px] font-semibold uppercase tracking-wide text-app-fg/80 transition hover:border-app-fg/35 hover:text-app-fg sm:right-3 sm:px-3 sm:text-xs"
          aria-label="Выйти из панели"
        >
          <LogOut className="h-3.5 w-3.5 shrink-0 sm:h-4 sm:w-4" strokeWidth={1.5} />
          <span className="hidden sm:inline">Выйти</span>
        </button>
      </div>
    </header>
  );
}
