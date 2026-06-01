"use client";

import { useEffect, useState } from "react";
import {
  CASHER_PRODUCTS_API_URL,
  type CasherProduct,
} from "@/lib/casher-products";

export function useCasherProducts(enabled: boolean) {
  const [products, setProducts] = useState<CasherProduct[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!enabled) return;
    let active = true;

    async function load() {
      setLoading(true);
      setError(null);
      try {
        const response = await fetch(CASHER_PRODUCTS_API_URL, { cache: "no-store" });
        if (!response.ok) throw new Error(`HTTP ${response.status}`);
        const payload = (await response.json()) as unknown;
        if (!Array.isArray(payload)) throw new Error("Unexpected payload");
        if (!active) return;
        setProducts(payload as CasherProduct[]);
      } catch {
        if (!active) return;
        setProducts([]);
        setError("Не удалось загрузить каталог вещей.");
      } finally {
        if (active) setLoading(false);
      }
    }

    void load();
    return () => {
      active = false;
    };
  }, [enabled]);

  return { products, loading, error };
}
