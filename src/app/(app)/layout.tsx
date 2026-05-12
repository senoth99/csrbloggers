"use client";

import type { ReactNode } from "react";
import { Suspense } from "react";
import { AppShell } from "@/components/AppShell";
import { AuthGate } from "@/components/AuthGate";
import { useAuth } from "@/context/AuthContext";

export default function AppLayout({ children }: { children: ReactNode }) {
  const { hydrated } = useAuth();

  if (!hydrated) {
    return (
      <div
        className="flex min-h-screen items-center justify-center bg-app-bg text-app-fg/55"
        style={{ backgroundColor: "#000000", color: "rgba(255,255,255,0.55)" }}
      >
        Загрузка…
      </div>
    );
  }

  return (
    <Suspense
      fallback={
        <div
          className="flex min-h-screen items-center justify-center bg-black text-white/55"
        >
          Загрузка…
        </div>
      }
    >
      <AuthGate>
        <AppShell>{children}</AppShell>
      </AuthGate>
    </Suspense>
  );
}
