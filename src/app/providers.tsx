"use client";

import type { ReactNode } from "react";
import { DevConnectionProbe } from "@/components/DevConnectionProbe";
import { AuthProvider } from "@/context/AuthContext";
import { PanelDataProvider } from "@/context/PanelDataContext";
import { PromocodesProvider } from "@/context/PromocodesContext";
import { UndoProvider } from "@/context/UndoContext";
import { ErrorBoundary } from "@/components/ErrorBoundary";

export function Providers({ children }: { children: ReactNode }) {
  return (
    <ErrorBoundary>
      <AuthProvider>
        <PanelDataProvider>
          <UndoProvider>
            <PromocodesProvider>
              {children}
              <DevConnectionProbe />
            </PromocodesProvider>
          </UndoProvider>
        </PanelDataProvider>
      </AuthProvider>
    </ErrorBoundary>
  );
}
