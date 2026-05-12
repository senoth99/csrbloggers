"use client";

import type { ReactNode } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useEffect } from "react";
import { useAuth } from "@/context/AuthContext";

export function AuthGate({ children }: { children: ReactNode }) {
  const { hydrated, isAuthenticated } = useAuth();
  const pathname = usePathname() ?? "";
  const searchParams = useSearchParams();
  const router = useRouter();

  useEffect(() => {
    if (!hydrated) return;
    if (pathname.startsWith("/login")) return;
    if (!isAuthenticated) {
      const q = searchParams?.toString();
      const next = q ? `${pathname}?${q}` : pathname;
      router.replace(`/login?next=${encodeURIComponent(next || "/dashboard")}`);
    }
  }, [hydrated, isAuthenticated, pathname, router, searchParams]);

  if (!hydrated) {
    return (
      <div
        className="flex min-h-screen items-center justify-center text-app-fg/55"
        style={{ backgroundColor: "#000000", color: "rgba(255,255,255,0.55)" }}
      >
        Загрузка…
      </div>
    );
  }

  if (!pathname.startsWith("/login") && !isAuthenticated) {
    return (
      <div
        className="flex min-h-screen items-center justify-center text-app-fg/55"
        style={{ backgroundColor: "#000000", color: "rgba(255,255,255,0.55)" }}
      >
        Загрузка…
      </div>
    );
  }

  return <>{children}</>;
}
