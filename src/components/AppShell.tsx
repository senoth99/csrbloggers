"use client";

import type { ReactNode } from "react";
import { Header } from "@/components/Header";
import { MainMenuNav } from "@/components/MainMenuNav";

export function AppShell({ children }: { children: ReactNode }) {
  return (
    <div className="flex min-h-screen flex-col bg-app-bg">
      <Header />
      <MainMenuNav />
      <main className="w-full min-w-0 flex-1 px-3 pb-10 pt-3 sm:px-4 sm:pt-4 md:px-6 md:pt-6">
        {children}
      </main>
    </div>
  );
}
