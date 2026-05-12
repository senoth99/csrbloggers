export type ConnectionCheckResult =
  | { ok: true; latencyMs: number }
  | { ok: false; message: string; hint?: string };

function nowMs(): number {
  return typeof performance !== "undefined" ? performance.now() : Date.now();
}

/**
 * Проверка доступности этого же origin (маршрут /api/health).
 * В консоль детали не пишет — только возвращает результат; логируйте снаружи.
 */
export async function checkServerHealth(): Promise<ConnectionCheckResult> {
  const t0 = nowMs();
  try {
    const res = await fetch("/api/health", {
      cache: "no-store",
      credentials: "same-origin",
    });
    const latencyMs = Math.round(nowMs() - t0);
    if (!res.ok) {
      return {
        ok: false,
        message: `HTTP ${res.status} ${res.statusText || ""}`.trim(),
        hint:
          "Сервер отвечает, но не 200. Проверьте прокси и путь к приложению.",
      };
    }
    const data = (await res.json()) as { ok?: boolean };
    if (!data?.ok) {
      return {
        ok: false,
        message: "Неверное тело ответа /api/health",
        hint: "Пересоберите проект (next build) или очистите .next.",
      };
    }
    return { ok: true, latencyMs };
  } catch (e) {
    const err = e instanceof Error ? e : new Error(String(e));
    const msg = err.message || String(e);
    let hint: string | undefined;
    if (msg === "Failed to fetch" || msg.includes("NetworkError")) {
      hint =
        "Браузер не достучался до сервера (не тот host/port, сервер выключен, VPN/файрвол). В dev с телефона по Wi‑Fi задайте NEXT_DEV_ALLOWED_ORIGINS в .env.local — см. комментарий в next.config.mjs.";
    }
    return { ok: false, message: msg, hint };
  }
}
