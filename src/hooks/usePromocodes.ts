import { useEffect, useMemo, useState } from "react";

export type PromocodeItem = { codeKey: string; activations: number };

type PromocodeResponse = {
  items?: Array<{ codeKey?: unknown; activations?: unknown }>;
  fetchedAt?: unknown;
  error?: unknown;
};

function parseActivations(raw: unknown): number {
  if (typeof raw === "number" && Number.isFinite(raw)) return raw;
  if (typeof raw === "string" && raw.trim()) {
    const n = Number(raw.replace(/\s/g, "").replace(",", "."));
    if (Number.isFinite(n)) return n;
  }
  return 0;
}

export function usePromocodes() {
  const [items, setItems] = useState<PromocodeItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [fetchedAt, setFetchedAt] = useState<number | null>(null);

  useEffect(() => {
    let alive = true;

    async function load() {
      setLoading(true);
      try {
        const res = await fetch("/api/promocodes", {
          cache: "no-store",
          credentials: "include",
        });
        const json = (await res.json()) as PromocodeResponse;
        if (!alive) return;
        if (!res.ok) {
          const msg =
            typeof json.error === "string" && json.error.trim()
              ? json.error.trim()
              : "Не удалось загрузить промокоды.";
          setError(msg);
          setItems([]);
          setFetchedAt(null);
          return;
        }

        const next =
          Array.isArray(json.items) && json.items.length > 0
            ? json.items
                .map((it) => {
                  const codeKey =
                    typeof it.codeKey === "string" ? it.codeKey.trim().toLowerCase() : "";
                  const activations = parseActivations(it.activations);
                  if (!codeKey) return null;
                  return { codeKey, activations };
                })
                .filter(Boolean)
            : [];

        setItems(next as Array<{ codeKey: string; activations: number }>);
        setError(null);
        setFetchedAt(
          typeof json.fetchedAt === "number" && Number.isFinite(json.fetchedAt)
            ? json.fetchedAt
            : Date.now(),
        );
      } catch {
        if (!alive) return;
        setError("Не удалось загрузить промокоды (сеть).");
        setItems([]);
        setFetchedAt(null);
      } finally {
        if (alive) setLoading(false);
      }
    }

    void load();
    const t = window.setInterval(() => void load(), 30 * 60 * 1000);
    return () => {
      alive = false;
      window.clearInterval(t);
    };
  }, []);

  const byCodeKey = useMemo(() => {
    const m = new Map<string, number>();
    for (const it of items) m.set(it.codeKey, it.activations);
    return m;
  }, [items]);

  return { items, byCodeKey, loading, error, fetchedAt };
}

