import { NextResponse } from "next/server";
import { getSessionUser, isDatabaseConfigured } from "@/lib/auth-session-prisma";
import { normalizeUsername, SUPERADMIN_LOGIN } from "@/lib/panel-auth-utils";

export const dynamic = "force-dynamic";

type PromocodeApiItem = {
  code?: unknown;
  promocode?: unknown;
  name?: unknown;
  activations?: unknown;
  uses?: unknown;
  count?: unknown;
  [k: string]: unknown;
};

function toCodeKey(raw: unknown): string | null {
  const s = typeof raw === "string" ? raw.trim() : "";
  if (!s) return null;
  return s.toLowerCase();
}

function toNumber(raw: unknown): number | null {
  if (typeof raw === "number" && Number.isFinite(raw)) return raw;
  if (typeof raw === "string" && raw.trim()) {
    const n = Number(raw.replace(/\s/g, "").replace(",", "."));
    if (Number.isFinite(n)) return n;
  }
  return null;
}

function extractList(payload: unknown): PromocodeApiItem[] {
  if (Array.isArray(payload)) return payload as PromocodeApiItem[];
  if (payload && typeof payload === "object") {
    const p = payload as Record<string, unknown>;
    const candidate = p.items ?? p.data ?? p.promocodes ?? p.results;
    if (Array.isArray(candidate)) return candidate as PromocodeApiItem[];
  }
  return [];
}

function pickFirstNumber(row: Record<string, unknown>, keys: string[]): number | null {
  for (const k of keys) {
    if (k in row) {
      const n = toNumber(row[k]);
      if (n != null) return n;
    }
  }
  return null;
}

const ACTIVATION_FIELD_KEYS = [
  "activations",
  "activationCount",
  "activationsCount",
  "activations_count",
  "promoActivations",
  "promo_activations",
  "used",
  "uses",
  "useCount",
  "usesCount",
  "uses_count",
  "usedCount",
  "used_count",
] as const;

function extractActivations(row: Record<string, unknown>): number {
  const direct = pickFirstNumber(row, [...ACTIVATION_FIELD_KEYS]);
  if (direct != null) return direct;

  for (const [k, v] of Object.entries(row)) {
    if (!/(activation|uses?|used)/i.test(k) || /order/i.test(k)) continue;
    const n = toNumber(v);
    if (n != null) return n;
  }
  return 0;
}

export async function GET(request: Request) {
  if (!isDatabaseConfigured()) {
    return NextResponse.json({ error: "Не задан DATABASE_URL." }, { status: 503 });
  }
  const sessionUser = await getSessionUser();
  if (!sessionUser) {
    return NextResponse.json({ error: "Требуется вход." }, { status: 401 });
  }

  const token = process.env.CASHER_PROMOCODES_TOKEN?.trim();
  if (!token) {
    return NextResponse.json(
      {
        error:
          "Не задан CASHER_PROMOCODES_TOKEN. Добавьте его в переменные окружения (например, в .env.local) и перезапустите сервер.",
      },
      { status: 503 },
    );
  }

  const url = new URL(request.url);
  const wantsDebug = url.searchParams.get("debug") === "1";
  const debug =
    wantsDebug &&
    sessionUser.role === "superadmin" &&
    normalizeUsername(sessionUser.login) === SUPERADMIN_LOGIN;
  const debugCode = url.searchParams.get("code")?.trim() || "";

  try {
    const upstreamUrl = "https://api.cashercollection.com/orders/admin/promocodes";

    const res = await fetch(upstreamUrl, {
      headers: {
        Authorization: `Bearer ${token}`,
        Accept: "application/json",
      },
      // Серверный кэш на 30 минут — это и есть «обновляй раз в 30 минут»
      next: { revalidate: 1800 },
    });

    let bodySnippet: string | null = null;
    if (!res.ok) {
      try {
        const t = await res.text();
        bodySnippet = t ? t.slice(0, 600) : "";
      } catch {
        bodySnippet = null;
      }

      return NextResponse.json(
        {
          error: `Не удалось получить промокоды (HTTP ${res.status}).`,
          ...(debug
            ? {
                upstreamStatus: res.status,
                upstreamUrl,
                bodySnippet,
              }
            : {}),
        },
        {
          status: 502,
          headers: {
            "x-upstream-status": String(res.status),
            "x-upstream-url": upstreamUrl,
          },
        },
      );
    }

    let payload: unknown = null;
    try {
      payload = (await res.json()) as unknown;
    } catch {
      payload = null;
    }

    const list = extractList(payload);

    const items = list
      .map((row) => {
        const codeKey =
          toCodeKey(row.code) ?? toCodeKey(row.promocode) ?? toCodeKey(row.name);
        if (!codeKey) return null;
        const activations = extractActivations(row as Record<string, unknown>);
        return { codeKey, activations };
      })
      .filter(Boolean) as Array<{ codeKey: string; activations: number }>;

    const fetchedAt = Date.now();
    if (debug) {
      const codeKeyWanted = debugCode ? debugCode.trim().toLowerCase() : "";
      const rawMatch =
        codeKeyWanted && list.length > 0
          ? list.find((row) => {
              const key =
                toCodeKey(row.code) ?? toCodeKey(row.promocode) ?? toCodeKey(row.name);
              return key === codeKeyWanted;
            })
          : undefined;

      return NextResponse.json(
        {
        items,
        fetchedAt,
          upstreamStatus: res.status,
          upstreamUrl,
        extractedCount: list.length,
        normalizedCount: items.length,
        sample: items.slice(0, 8),
          ...(codeKeyWanted
            ? {
                debugCode: codeKeyWanted,
                debugCodeFound: Boolean(rawMatch),
                debugCodeKeys: rawMatch ? Object.keys(rawMatch).slice(0, 80) : [],
                debugCodePreview: rawMatch
                  ? Object.fromEntries(
                      Object.entries(rawMatch).slice(0, 40),
                    )
                  : null,
              }
            : {}),
        payloadShape: Array.isArray(payload)
          ? "array"
          : payload && typeof payload === "object"
            ? "object"
            : typeof payload,
        },
        {
          headers: {
            "x-upstream-status": String(res.status),
            "x-upstream-url": upstreamUrl,
          },
        },
      );
    }

    return NextResponse.json(
      { items, fetchedAt },
      {
        headers: {
          "x-upstream-status": String(res.status),
          "x-upstream-url": upstreamUrl,
        },
      },
    );
  } catch {
    return NextResponse.json(
      {
        error: "Сбой при обращении к API промокодов (сеть или неожиданный ответ).",
        ...(debug ? { debug: true } : {}),
      },
      { status: 500 },
    );
  }
}

