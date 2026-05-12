"use client";

import { useCallback, useEffect, useState } from "react";
import { checkServerHealth } from "@/lib/dev-connection";

/**
 * В development: один запрос к /api/health, лог в консоль и плашка при ошибке.
 * Добавьте ?debug=1 к URL, чтобы плашка показывала и успех.
 */
export function DevConnectionProbe() {
  const [result, setResult] = useState<
    | { kind: "idle" }
    | { kind: "ok"; ms: number }
    | { kind: "err"; message: string; hint?: string }
  >({ kind: "idle" });

  const run = useCallback(async () => {
    const r = await checkServerHealth();
    if (r.ok) {
      setResult({ kind: "ok", ms: r.latencyMs });
      console.info(`[Casher dev] связь с сервером: OK (${r.latencyMs} ms)`);
    } else {
      setResult({ kind: "err", message: r.message, hint: r.hint });
      console.error("[Casher dev] связь с сервером: ошибка", r.message, r.hint ?? "");
    }
  }, []);

  useEffect(() => {
    if (process.env.NODE_ENV !== "development") return;

    void run();

    const onOnline = () => void run();
    window.addEventListener("online", onOnline);
    return () => window.removeEventListener("online", onOnline);
  }, [run]);

  if (process.env.NODE_ENV !== "development") return null;

  const showDebug =
    typeof window !== "undefined" && window.location.search.includes("debug=1");
  if (result.kind === "idle") return null;
  if (result.kind === "ok" && !showDebug) return null;

  if (result.kind === "ok") {
    return (
      <div
        className="pointer-events-none fixed bottom-2 left-2 z-[9999] max-w-sm border border-emerald-500/40 bg-black/90 px-2 py-1 font-mono text-[10px] text-emerald-300/95"
        role="status"
      >
        [dev] API OK · {result.ms}ms
      </div>
    );
  }

  return (
    <div
      className="fixed bottom-2 left-2 z-[9999] max-w-md border border-amber-500/50 bg-black/95 p-2 text-left font-mono text-[10px] text-amber-100 shadow-lg"
      role="alert"
    >
      <div className="font-semibold text-amber-200">[dev] Нет связи с сервером</div>
      <div className="mt-1 break-words text-amber-100/90">{result.message}</div>
      {result.hint ? (
        <div className="mt-1 text-[9px] leading-snug text-amber-100/70">{result.hint}</div>
      ) : null}
    </div>
  );
}
