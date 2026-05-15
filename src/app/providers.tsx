"use client";

import type { ReactNode } from "react";
import { DevConnectionProbe } from "@/components/DevConnectionProbe";
import { AuthProvider } from "@/context/AuthContext";
import { PanelDataProvider } from "@/context/PanelDataContext";
import { PromocodesProvider } from "@/context/PromocodesContext";

export function Providers({ children }: { children: ReactNode }) {
  return (
    <AuthProvider>
      <PanelDataProvider>
        <PromocodesProvider>
          {children}
          <DevConnectionProbe />
        </PromocodesProvider>
      </PanelDataProvider>
    </AuthProvider>
  );
}
