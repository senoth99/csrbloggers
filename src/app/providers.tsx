"use client";

import type { ReactNode } from "react";
import { DevConnectionProbe } from "@/components/DevConnectionProbe";
import { AuthProvider } from "@/context/AuthContext";
import { PanelDataProvider } from "@/context/PanelDataContext";

export function Providers({ children }: { children: ReactNode }) {
  return (
    <AuthProvider>
      <PanelDataProvider>
        {children}
        <DevConnectionProbe />
      </PanelDataProvider>
    </AuthProvider>
  );
}
