"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { LogOut } from "lucide-react";
import { useAuth } from "@/context/AuthContext";
import { usePanelData } from "@/context/PanelDataContext";

function userInitials(username: string | null): string {
  if (!username) return "??";
  const clean = username.trim();
  if (clean.length === 0) return "??";
  return clean.slice(0, 2).toUpperCase();
}

export function Header() {
  const { logout, currentUsername } = useAuth();
  const { savePending } = usePanelData();
  const router = useRouter();
  const [logoutBusy, setLogoutBusy] = useState(false);
  const initials = userInitials(currentUsername);

  return (
    <header className="relative z-40 shrink-0 border-b border-app-fg/10 bg-app-bg pt-safe">
      <div className="relative flex h-10 w-full items-center justify-end gap-3 px-3 sm:px-4 md:px-5">
        <Link
          href="/integrations"
          className="absolute left-1/2 top-1/2 flex -translate-x-1/2 -translate-y-1/2 items-center"
          aria-label="Casher"
        >
          <img
            src="/casher-logo.png"
            alt="Casher"
            className="h-6 w-auto max-w-[96px] object-contain"
            draggable={false}
          />
        </Link>
        <div className="relative z-10 flex shrink-0 items-center gap-2">
          {savePending && (
            <span className="text-[10px] text-app-fg/45" aria-live="polite">
              Сохранение…
            </span>
          )}
          <span
            className="flex h-7 w-7 items-center justify-center rounded-full border border-app-fg/20 bg-app-fg/[0.06] text-[10px] font-bold tracking-wide text-app-fg"
            title={currentUsername ?? undefined}
            aria-label={currentUsername ? `Пользователь ${currentUsername}` : "Пользователь"}
          >
            {initials}
          </span>
          <button
            type="button"
            disabled={logoutBusy}
            onClick={() => {
              if (logoutBusy) return;
              setLogoutBusy(true);
              void (async () => {
                try {
                  await logout();
                  router.replace("/login");
                } finally {
                  setLogoutBusy(false);
                }
              })();
            }}
            className="flex h-7 w-7 items-center justify-center border border-app-fg/15 text-app-fg/70 transition hover:border-app-fg/35 hover:text-app-fg disabled:cursor-not-allowed disabled:opacity-50"
            aria-label="Выйти из панели"
          >
            <LogOut className="h-3.5 w-3.5" strokeWidth={1.5} />
          </button>
        </div>
      </div>
    </header>
  );
}
