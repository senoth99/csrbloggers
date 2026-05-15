"use client";

import type { ReactNode } from "react";
import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/context/AuthContext";
import { defaultAuthenticatedPath, isPanelAdminRole } from "@/lib/panel-auth-utils";

export function AdminRouteGuard({ children }: { children: ReactNode }) {
  const { hydrated, role } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (!hydrated) return;
    if (!isPanelAdminRole(role)) {
      router.replace(defaultAuthenticatedPath(role));
    }
  }, [hydrated, role, router]);

  if (!hydrated || !isPanelAdminRole(role)) {
    return (
      <p className="py-12 text-center text-sm text-app-fg/55">Загрузка…</p>
    );
  }

  return <>{children}</>;
}
