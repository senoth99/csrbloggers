"use client";

import { createContext, useContext, type ReactNode } from "react";
import { usePromocodes } from "@/hooks/usePromocodes";
import type { PromocodeItem } from "@/hooks/usePromocodes";

interface PromocodesContextValue {
  items: PromocodeItem[];
  byCodeKey: Map<string, number>;
  loading: boolean;
  error: string | null;
  fetchedAt: number | null;
}

const PromocodesContext = createContext<PromocodesContextValue | null>(null);

export function PromocodesProvider({ children }: { children: ReactNode }) {
  const value = usePromocodes();
  return <PromocodesContext.Provider value={value}>{children}</PromocodesContext.Provider>;
}

export function usePromocodesCtx(): PromocodesContextValue {
  const ctx = useContext(PromocodesContext);
  if (!ctx) throw new Error("usePromocodesCtx must be used within PromocodesProvider");
  return ctx;
}
