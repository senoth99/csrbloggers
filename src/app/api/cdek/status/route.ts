import { NextRequest, NextResponse } from "next/server";
import type { DeliveryStatus } from "@/types/panel-data";

const CDEK_API = "https://api.cdek.ru/v2";

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

interface CdekOrderStatus {
  code?: string | number;
  name?: string;
  date_time?: string;
}

interface CdekOrder {
  statuses?: CdekOrderStatus[];
}

function stripWhitespace(s: string): string {
  return s.replace(/\s+/g, "");
}

/**
 * CDEK GET /v2/orders returns `{ entity: { statuses, ... } }` or nested lists.
 * Some filters return `{ entity: { orders: [...] } }`.
 */
function extractOrdersFromCdekPayload(payload: unknown): CdekOrder[] {
  if (payload == null) return [];
  if (Array.isArray(payload)) {
    return payload.flatMap(extractOrdersFromCdekPayload);
  }
  if (typeof payload !== "object") return [];

  const obj = payload as Record<string, unknown>;

  if ("entity" in obj) {
    const e = obj.entity;
    if (e == null) return [];
    if (Array.isArray(e)) {
      return e.flatMap(extractOrdersFromCdekPayload);
    }
    if (typeof e === "object") {
      const ent = e as Record<string, unknown>;
      if (Array.isArray(ent.orders)) {
        return ent.orders.flatMap(extractOrdersFromCdekPayload);
      }
      if (Array.isArray(ent.statuses)) {
        return [{ statuses: ent.statuses as CdekOrderStatus[] }];
      }
      return extractOrdersFromCdekPayload(e);
    }
  }

  if ("statuses" in obj && Array.isArray(obj.statuses)) {
    return [{ statuses: obj.statuses as CdekOrderStatus[] }];
  }

  return [];
}

/** Fallback: walk JSON and take the longest plausible `statuses` array (CDEK field names vary). */
function collectStatusesDeep(payload: unknown): CdekOrderStatus[] {
  const candidates: CdekOrderStatus[][] = [];

  function isStatusRow(x: unknown): x is CdekOrderStatus {
    if (!x || typeof x !== "object") return false;
    const o = x as Record<string, unknown>;
    return typeof o.code === "string" || typeof o.date_time === "string";
  }

  function walk(node: unknown): void {
    if (node == null) return;
    if (Array.isArray(node)) {
      node.forEach(walk);
      return;
    }
    if (typeof node !== "object") return;
    const o = node as Record<string, unknown>;
    if (Array.isArray(o.statuses) && o.statuses.length > 0 && isStatusRow(o.statuses[0])) {
      candidates.push(o.statuses as CdekOrderStatus[]);
    }
    for (const v of Object.values(o)) {
      walk(v);
    }
  }

  walk(payload);
  if (candidates.length === 0) return [];
  candidates.sort((a, b) => b.length - a.length);
  return candidates[0] ?? [];
}

/**
 * Официальные коды статуса заказа СДЭК (v2) → статусы панели.
 * RETURNED_TO_* в списке СДЭК — не финальный возврат в ИМ, а повторный приход на склад → «В пути».
 */
const CDEK_CODE_TO_PANEL: Record<string, DeliveryStatus> = {
  // Создано
  ACCEPTED: "created",
  CREATED: "created",
  INVALID: "created",

  // Возврат (отказ, отмена, изъятие для возврата в ИМ)
  REMOVED: "returned",
  NOT_DELIVERED: "returned",
  POSTOMAT_SEIZED: "returned",

  // Получено
  DELIVERED: "delivered",
  POSTOMAT_RECEIVED: "delivered",

  // В пути (вся цепочка перевозки, склады, курьер, таможня, возвраты на склады по маршруту)
  RECEIVED_AT_SHIPMENT_WAREHOUSE: "in_transit",
  READY_FOR_SHIPMENT_IN_SENDER_CITY: "in_transit",
  TAKEN_BY_TRANSPORTER_FROM_SENDER_CITY: "in_transit",
  SENT_TO_RECIPIENT_CITY: "in_transit",
  ACCEPTED_IN_RECIPIENT_CITY: "in_transit",
  ACCEPTED_AT_RECIPIENT_CITY_WAREHOUSE: "in_transit",
  TAKEN_BY_COURIER: "in_transit",
  ACCEPTED_AT_TRANSIT_WAREHOUSE: "in_transit",
  RETURNED_TO_SENDER_CITY_WAREHOUSE: "in_transit",
  RETURNED_TO_TRANSIT_WAREHOUSE: "in_transit",
  RETURNED_TO_RECIPIENT_CITY_WAREHOUSE: "in_transit",
  READY_FOR_SHIPMENT_IN_TRANSIT_CITY: "in_transit",
  TAKEN_BY_TRANSPORTER_FROM_TRANSIT_CITY: "in_transit",
  SENT_TO_TRANSIT_CITY: "in_transit",
  ACCEPTED_IN_TRANSIT_CITY: "in_transit",
  SENT_TO_SENDER_CITY: "in_transit",
  ACCEPTED_IN_SENDER_CITY: "in_transit",
  ENTERED_TO_TRANSIT_WAREHOUSE: "in_transit",
  ENTERED_TO_RECIPIENT_CITY_WAREHOUSE: "in_transit",
  IN_CUSTOMS_INTERNATIONAL: "in_transit",
  SHIPPED_TO_DESTINATION: "in_transit",
  PASSED_TO_TRANSIT_CARRIER: "in_transit",
  IN_CUSTOMS_LOCAL: "in_transit",
  CUSTOMS_COMPLETE: "in_transit",

  // В ПВЗ / склад до востребования / постамат до забора
  ACCEPTED_AT_PICK_UP_POINT: "in_pickup",
  ENTERED_TO_PICK_UP_POINT: "in_pickup",
  POSTOMAT_POSTED: "in_pickup",
};

function normalizeCdekStatusCode(raw: unknown): string {
  if (raw == null) return "";
  return String(raw)
    .trim()
    .toUpperCase()
    .replace(/[\s-]+/g, "_");
}

/** Если СДЭК вернёт новый код — не оставляем заказ без статуса. */
function mapUnknownCdekStatus(latest: CdekOrderStatus): DeliveryStatus {
  const compact = normalizeCdekStatusCode(latest.code);
  const name = (latest.name ?? "").toLowerCase();

  if (name.includes("не вручен") || name.includes("отказ") || name.includes("возврат")) {
    return "returned";
  }
  if ((name.includes("вручен") || name.includes("вручён")) && !name.includes("не вручен")) {
    return "delivered";
  }
  if (
    name.includes("постамат") ||
    name.includes("до востребования") ||
    name.includes("пвз") ||
    (name.includes("склад") && (name.includes("забор") || name.includes("выдач")))
  ) {
    return "in_pickup";
  }
  if (
    compact.includes("PICK_UP") ||
    compact.includes("PICKUP") ||
    compact.includes("POSTOMAT") ||
    compact.includes("PVZ")
  ) {
    return "in_pickup";
  }
  if (compact) {
    return "in_transit";
  }
  return "created";
}

function mapCdekStatus(statuses: CdekOrderStatus[]): DeliveryStatus {
  if (statuses.length === 0) return "created";

  const sorted = [...statuses].sort((a, b) => {
    const ta = String(a.date_time ?? "").trim();
    const tb = String(b.date_time ?? "").trim();
    if (!ta && !tb) return 0;
    if (!ta) return -1;
    if (!tb) return 1;
    return ta.localeCompare(tb);
  });
  const latest = sorted[sorted.length - 1]!;
  const key = normalizeCdekStatusCode(latest.code);
  const mapped = key ? CDEK_CODE_TO_PANEL[key] : undefined;
  if (mapped) {
    return mapped;
  }

  return mapUnknownCdekStatus(latest);
}

async function getCdekToken(account: string, password: string): Promise<string | null> {
  const body = new URLSearchParams({
    grant_type: "client_credentials",
    client_id: account,
    client_secret: password,
  });

  const res = await fetch(`${CDEK_API}/oauth/token`, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body,
    cache: "no-store",
  });
  if (!res.ok) return null;
  const payload = (await res.json()) as { access_token?: string };
  return payload.access_token ?? null;
}

function cdekAuthHeaders(token: string): HeadersInit {
  return {
    Authorization: `Bearer ${token}`,
    "Content-Type": "application/json",
    Accept: "application/json",
  };
}

async function fetchOrderByUuid(token: string, uuid: string): Promise<CdekOrder[]> {
  const res = await fetch(`${CDEK_API}/orders/${encodeURIComponent(uuid)}`, {
    headers: cdekAuthHeaders(token),
    cache: "no-store",
  });
  if (!res.ok) return [];
  let payload: unknown;
  try {
    payload = await res.json();
  } catch {
    return [];
  }
  let orders = extractOrdersFromCdekPayload(payload);
  const flat = orders.flatMap((o) => o.statuses ?? []);
  if (flat.length === 0) {
    const deep = collectStatusesDeep(payload);
    if (deep.length > 0) {
      orders = [{ statuses: deep }];
    }
  }
  return orders;
}

const ORDER_QUERY_KEYS = ["number", "im_number", "cdek_number"] as const;

async function fetchOrdersByQuery(token: string, id: string): Promise<CdekOrder[]> {
  let fallback: CdekOrder[] = [];
  const trimmed = id.trim();
  const compact = stripWhitespace(trimmed);

  const tryValues =
    compact !== trimmed && compact.length > 0 ? [trimmed, compact] : [trimmed];

  for (const raw of tryValues) {
    for (const key of ORDER_QUERY_KEYS) {
      const url = `${CDEK_API}/orders?${key}=${encodeURIComponent(raw)}`;
      const res = await fetch(url, {
        headers: cdekAuthHeaders(token),
        cache: "no-store",
      });
      if (!res.ok) continue;

      let payload: unknown;
      try {
        payload = await res.json();
      } catch {
        continue;
      }

      let orders = extractOrdersFromCdekPayload(payload);
      let statuses = orders.flatMap((o) => o.statuses ?? []);
      if (statuses.length === 0) {
        const deep = collectStatusesDeep(payload);
        if (deep.length > 0) {
          orders = [{ statuses: deep }];
          statuses = deep;
        }
      }

      if (statuses.length > 0) {
        return orders;
      }
      if (orders.length > 0 && fallback.length === 0) {
        fallback = orders;
      }
    }
  }

  return fallback;
}

function uniqueStrings(values: string[]): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const v of values) {
    const t = v.trim();
    if (!t || seen.has(t)) continue;
    seen.add(t);
    out.push(t);
  }
  return out;
}

/** Fetch order info: UUID path, then every id × query key variation. */
async function fetchAllOrderVariants(token: string, track: string, orderNumber?: string) {
  const ids = uniqueStrings([track, orderNumber ?? ""].filter(Boolean));

  for (const id of ids) {
    if (UUID_RE.test(id)) {
      const byUuid = await fetchOrderByUuid(token, id);
      if (byUuid.some((o) => (o.statuses?.length ?? 0) > 0)) {
        return byUuid;
      }
    }
  }

  for (const id of ids) {
    const orders = await fetchOrdersByQuery(token, id);
    if (orders.some((o) => (o.statuses?.length ?? 0) > 0)) {
      return orders;
    }
  }

  return [];
}

export async function GET(request: NextRequest) {
  const track = request.nextUrl.searchParams.get("track")?.trim();
  const orderNumber = request.nextUrl.searchParams.get("orderNumber")?.trim();

  if (!track) {
    return NextResponse.json(
      { error: "Не передан номер для запроса (track)." },
      { status: 400 },
    );
  }

  const account = process.env.CDEK_ACCOUNT;
  const password = process.env.CDEK_PASSWORD;
  if (!account || !password) {
    return NextResponse.json(
      {
        error:
          "Не заданы CDEK_ACCOUNT / CDEK_PASSWORD (например в .env.local). Добавьте и перезапустите сервер.",
      },
      { status: 503 },
    );
  }

  try {
    const token = await getCdekToken(account, password);
    if (!token) {
      return NextResponse.json(
        {
          error:
            "СДЭК не выдал токен: проверьте логин и пароль договора интеграции (клиентский ID и секрет).",
        },
        { status: 502 },
      );
    }

    const list = await fetchAllOrderVariants(token, track, orderNumber);
    const statuses = list.flatMap((o) => o.statuses ?? []);
    if (statuses.length === 0) {
      return NextResponse.json({
        status: "created" as DeliveryStatus,
        message:
          "Заказ не найден по этому треку/номеру в вашем договоре СДЭК или у заказа ещё пустая история статусов. Проверьте номер СДЭК, номер заказа в ИМ или вставьте UUID заказа.",
      });
    }
    const status = mapCdekStatus(statuses);
    return NextResponse.json({ status });
  } catch {
    return NextResponse.json(
      { error: "Сбой при обращении к API СДЭК (сеть или неожиданный ответ)." },
      { status: 500 },
    );
  }
}
