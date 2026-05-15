"use client";

import type { ReactNode } from "react";
import { Header } from "@/components/Header";
import { MainMenuNav } from "@/components/MainMenuNav";
import { usePanelData } from "@/context/PanelDataContext";

export function AppShell({ children }: { children: ReactNode }) {
  const { saveError, clearSaveError } = usePanelData();
  return (
    <div className="flex min-h-screen flex-col bg-app-bg">
      <Header />
      <MainMenuNav />
      {saveError && (
        <div className="flex items-center gap-3 bg-red-950/60 px-4 py-2 text-xs text-red-300">
          <span className="flex-1">{saveError}</span>
          <button onClick={clearSaveError} className="shrink-0 opacity-60 hover:opacity-100" aria-label="Закрыть">✕</button>
        </div>
      )}
      <main className="w-full min-w-0 flex-1 px-3 pb-10 pt-3 sm:px-4 sm:pt-4 md:px-6 md:pt-6">
        {children}
      </main>
    </div>
  );
}
