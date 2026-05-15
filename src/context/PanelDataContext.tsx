"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { SUPERADMIN_LOGIN, normalizeUsername, useAuth } from "@/context/AuthContext";
import type {
  AddDeliveryInput,
  AddIntegrationInput,
  Contractor,
  ContractorItem,
  ContractorLink,
  ContractorStatus,
  Delivery,
  DeliveryStatus,
  Employee,
  Integration,
  IntegrationCooperationType,
  IntegrationPosition,
  NicheOption,
  SocialOption,
} from "@/types/panel-data";
import { DEFAULT_SOCIAL_OPTIONS, normalizeIntegrationStatus } from "@/types/panel-data";
import { createPanelId } from "@/lib/id";
import { normalizeTelegramUsername } from "@/lib/employee-utils";
import {
  integrationPublicLinkHref,
  normalizeIntegrationPublicLink,
} from "@/lib/integration-link";
import {
  deliveryNotifyTaskKey,
  integrationReachTaskKey,
  integrationReleaseVerifyTaskKey,
} from "@/lib/panel-tasks";

const STORAGE_KEY = "casher-panel-data-v1";

interface StoredShape {
  contractors: Contractor[];
  integrations: Integration[];
  socialOptions: SocialOption[];
  nicheOptions: NicheOption[];
  contractorItems: ContractorItem[];
  contractorLinks: ContractorLink[];
  deliveries: Delivery[];
  employees: Employee[];
  /** Ключи вида delivery-notify:id / integration-reach:id / integration-release-verify:id */
  completedTaskKeys: string[];
  /** Снапшоты total-активаций промокодов (для расчёта дельт по месяцам) */
  promocodeSnapshots?: Array<{ codeKey: string; t: number; activations: number }>;
}

function slugify(raw: string): string {
  const s = raw
    .trim()
    .toLowerCase()
    .replace(/\s+/g, "-")
    .replace(/[^a-z0-9-]/g, "");
  return s || `net-${Date.now()}`;
}

/** Разбор произвольного JSON (localStorage или ответ сервера) в черновик StoredShape. */
function coercePanelStoredShape(parsed: unknown): StoredShape | null {
  const p = parsed as StoredShape;
  if (!p || typeof p !== "object") return null;
  return {
    contractors: Array.isArray(p.contractors) ? p.contractors : [],
    integrations: Array.isArray(p.integrations) ? p.integrations : [],
    socialOptions: Array.isArray(p.socialOptions) ? p.socialOptions : [],
    nicheOptions: Array.isArray((p as { nicheOptions?: unknown }).nicheOptions)
      ? ((p as { nicheOptions: NicheOption[] }).nicheOptions ?? []).filter(
          (row): row is NicheOption =>
            !!row &&
            typeof row === "object" &&
            typeof (row as NicheOption).id === "string" &&
            typeof (row as NicheOption).label === "string",
        )
      : [],
    contractorItems: Array.isArray((p as { contractorItems?: unknown }).contractorItems)
      ? ((p as { contractorItems: ContractorItem[] }).contractorItems ?? [])
      : [],
    contractorLinks: Array.isArray((p as { contractorLinks?: unknown }).contractorLinks)
      ? ((p as { contractorLinks: ContractorLink[] }).contractorLinks ?? []).filter(
          (row): row is ContractorLink =>
            !!row &&
            typeof row === "object" &&
            typeof (row as ContractorLink).id === "string" &&
            typeof (row as ContractorLink).contractorId === "string" &&
            typeof (row as ContractorLink).title === "string" &&
            typeof (row as ContractorLink).url === "string",
        )
      : [],
    deliveries: Array.isArray((p as { deliveries?: unknown }).deliveries)
      ? ((p as { deliveries: Delivery[] }).deliveries ?? [])
      : [],
    employees: Array.isArray((p as { employees?: unknown }).employees)
      ? ((p as { employees: Employee[] }).employees ?? [])
      : [],
    completedTaskKeys: Array.isArray((p as { completedTaskKeys?: unknown }).completedTaskKeys)
      ? ((p as { completedTaskKeys: string[] }).completedTaskKeys ?? []).filter(
          (x): x is string => typeof x === "string",
        )
      : [],
    promocodeSnapshots: Array.isArray(
      (p as { promocodeSnapshots?: unknown }).promocodeSnapshots,
    )
      ? ((p as {
          promocodeSnapshots: Array<{ codeKey?: unknown; t?: unknown; activations?: unknown }>;
        }).promocodeSnapshots ?? [])
          .map((row) => {
            const codeKey =
              typeof row.codeKey === "string" ? row.codeKey.trim().toLowerCase() : "";
            const t = typeof row.t === "number" && Number.isFinite(row.t) ? row.t : NaN;
            const activations =
              typeof row.activations === "number" && Number.isFinite(row.activations)
                ? row.activations
                : NaN;
            if (!codeKey || !Number.isFinite(t) || !Number.isFinite(activations)) return null;
            return { codeKey, t, activations };
          })
          .filter(Boolean) as Array<{ codeKey: string; t: number; activations: number }>
      : [],
  };
}

function loadStored(): StoredShape | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    return coercePanelStoredShape(JSON.parse(raw));
  } catch {
    return null;
  }
}

function saveStored(data: StoredShape) {
  if (typeof window === "undefined") return;
  localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
}

function normalizeSocial(opts: SocialOption[]): SocialOption[] {
  return opts.length > 0 ? opts : [...DEFAULT_SOCIAL_OPTIONS];
}

function normalizeNicheOptions(raw: NicheOption[]): NicheOption[] {
  const seen = new Set<string>();
  const out: NicheOption[] = [];
  for (const o of raw) {
    const id = typeof o.id === "string" ? o.id.trim() : "";
    const label = typeof o.label === "string" ? o.label.trim() : "";
    if (!id || !label || seen.has(id)) continue;
    seen.add(id);
    out.push({ id, label });
  }
  return out;
}

function ensureSocialIds(
  integrations: Integration[],
  socialOptions: SocialOption[],
): Integration[] {
  const ids = new Set(socialOptions.map((o) => o.id));
  const fallback = socialOptions[0]?.id ?? "twitch";
  return integrations.map((row) => ({
    ...row,
    socialNetworkId: ids.has(row.socialNetworkId)
      ? row.socialNetworkId
      : fallback,
  }));
}

function parseAmount(raw: unknown): number {
  if (typeof raw === "number" && !Number.isNaN(raw)) return raw;
  if (typeof raw === "string" && raw.trim() !== "") {
    const n = Number.parseFloat(raw.replace(",", "."));
    return Number.isNaN(n) ? 0 : n;
  }
  return 0;
}

/** Неотрицательное число или undefined (для опциональных полей интеграции) */
function parseNonNegativeOptional(raw: unknown): number | undefined {
  if (raw === undefined || raw === null) return undefined;
  const n =
    typeof raw === "number"
      ? raw
      : Number.parseFloat(String(raw).replace(/\s/g, "").replace(",", "."));
  if (Number.isNaN(n) || n < 0 || !Number.isFinite(n)) return undefined;
  return n;
}

function migrateContractor(c: Contractor): Contractor {
  const rawRating =
    typeof c.rating === "number"
      ? c.rating
      : Number.parseFloat(String(c.rating ?? 0).replace(",", "."));
  const cityRaw = (c as { city?: unknown }).city;
  const cityTrim = typeof cityRaw === "string" ? cityRaw.trim() : "";
  const promoRaw = (c as { promoCode?: unknown }).promoCode;
  const promoTrim = typeof promoRaw === "string" ? promoRaw.trim() : "";
  const viralityRaw = (c as { virality?: unknown }).virality;
  const viralityTrim = typeof viralityRaw === "string" ? viralityRaw.trim() : "";
  const nicheRaw = (c as { nicheId?: unknown }).nicheId;
  const nicheTrim = typeof nicheRaw === "string" ? nicheRaw.trim() : "";
  const sizeRaw = (c as { sizeCategory?: unknown }).sizeCategory;
  const next: Contractor = {
    ...c,
    createdAt: c.createdAt ?? new Date().toISOString(),
    contactPerson: c.contactPerson ?? "",
    status: c.status === "paused" ? "paused" : "active",
    rating: Number.isNaN(rawRating) ? 0 : Math.max(0, Math.min(10, rawRating)),
    note: c.note ?? "",
  };
  if (cityTrim) next.city = cityTrim;
  else delete next.city;
  if (promoTrim) next.promoCode = promoTrim;
  else delete next.promoCode;
  if (viralityTrim) next.virality = viralityTrim;
  else delete next.virality;
  if (nicheTrim) next.nicheId = nicheTrim;
  else delete next.nicheId;
  if (sizeRaw === "micro" || sizeRaw === "middle" || sizeRaw === "large") {
    next.sizeCategory = sizeRaw;
  } else delete next.sizeCategory;
  return next;
}

function migrateEmployee(raw: unknown): Employee | null {
  if (!raw || typeof raw !== "object") return null;
  const e = raw as Partial<Employee>;
  const id = typeof e.id === "string" ? e.id.trim() : "";
  if (!id) return null;
  const fullName = (e.fullName ?? "").trim();
  const telegramUsername = normalizeTelegramUsername(e.telegramUsername ?? "");
  if (!fullName || !telegramUsername) return null;
  const panelRaw = (e as { panelLogin?: unknown }).panelLogin;
  const panelLogin =
    typeof panelRaw === "string" && panelRaw.trim()
      ? normalizeTelegramUsername(panelRaw)
      : undefined;
  return {
    id,
    fullName,
    telegramUsername,
    ...(panelLogin ? { panelLogin } : {}),
    avatarUrl: e.avatarUrl?.trim() || undefined,
    createdAt: e.createdAt ?? new Date().toISOString(),
  };
}

/** Тестовые сотрудники из удалённого генератора (telegram user_0 … user_99). */
function isLegacySeedTestEmployee(e: Employee): boolean {
  return /^user_\d+$/i.test(normalizeTelegramUsername(e.telegramUsername));
}

function integrationCommentFromRow(row: Integration): string | undefined {
  const raw = (row as { comment?: unknown }).comment;
  if (typeof raw === "string" && raw.trim()) return raw.trim();
  if (typeof row.note === "string" && row.note.trim()) return row.note.trim();
  return undefined;
}

function migrateIntegration(
  row: Integration,
  socialOptions: SocialOption[],
): Integration {
  const coopRaw = (row as { cooperationType?: unknown }).cooperationType;
  const cooperationType: IntegrationCooperationType | undefined =
    coopRaw === "barter" || coopRaw === "commercial" ? coopRaw : undefined;
  const socialLabel =
    socialOptions.find((o) => o.id === row.socialNetworkId)?.label ??
    row.socialNetworkId;
  const comment = integrationCommentFromRow(row);
  const result: Integration = {
    ...row,
    status: normalizeIntegrationStatus(row.status),
    createdAt: row.createdAt ?? new Date().toISOString(),
    title: row.title ?? `Интеграция · ${socialLabel}`,
    amount: parseAmount((row as { amount?: unknown }).amount),
    note: row.note ?? "",
    ...(comment ? { comment } : {}),
    releaseDate: parseReleaseDateInput(
      typeof (row as { releaseDate?: unknown }).releaseDate === "string"
        ? (row as { releaseDate?: string }).releaseDate
        : undefined,
    ),
    releaseTime: parseReleaseTimeInput(
      typeof (row as { releaseTime?: unknown }).releaseTime === "string"
        ? (row as { releaseTime?: string }).releaseTime
        : undefined,
    ),
    budget: parseNonNegativeOptional(
      (row as { budget?: unknown }).budget,
    ),
    reach: parseNonNegativeOptional(
      (row as { reach?: unknown }).reach,
    ),
    promoActivations: parseNonNegativeOptional(
      (row as { promoActivations?: unknown }).promoActivations,
    ),
  };
  if (cooperationType) result.cooperationType = cooperationType;
  else delete (result as { cooperationType?: IntegrationCooperationType }).cooperationType;
  return result;
}

function normalizeIntegrationTitleKey(title: string): string {
  return title.trim().toLowerCase().replace(/\s+/g, " ");
}

function isIntegrationTitleTaken(
  integrations: Integration[],
  title: string,
  excludeId?: string,
): boolean {
  const key = normalizeIntegrationTitleKey(title);
  if (!key) return false;
  return integrations.some(
    (row) =>
      row.id !== excludeId &&
      normalizeIntegrationTitleKey(row.title ?? "") === key,
  );
}

function parseReleaseDateInput(raw: string | undefined): string | undefined {
  const v = raw?.trim() ?? "";
  if (!v) return undefined;
  return /^\d{4}-\d{2}-\d{2}$/.test(v) ? v : undefined;
}

function parseReleaseTimeInput(raw: string | undefined): string | undefined {
  const v = raw?.trim() ?? "";
  if (!v) return undefined;
  const m = /^([01]?\d|2[0-3]):([0-5]\d)$/.exec(v);
  if (!m) return undefined;
  return `${String(Number(m[1])).padStart(2, "0")}:${m[2]}`;
}

function emptyStoredShape(): StoredShape {
  return {
    contractors: [],
    integrations: [],
    socialOptions: [...DEFAULT_SOCIAL_OPTIONS],
    nicheOptions: [],
    contractorItems: [],
    contractorLinks: [],
    deliveries: [],
    employees: [],
    completedTaskKeys: [],
    promocodeSnapshots: [],
  };
}

function normalizeIncomingPanelData(loaded: StoredShape): StoredShape {
  const social = normalizeSocial(loaded.socialOptions);
  const nicheOptions = normalizeNicheOptions(loaded.nicheOptions ?? []);
  const employeesRaw = Array.isArray(loaded.employees) ? loaded.employees : [];
  const employeesMigrated = employeesRaw
    .map(migrateEmployee)
    .filter((x): x is Employee => x !== null);
  const employees = employeesMigrated.filter((e) => !isLegacySeedTestEmployee(e));
  const strippedLegacyDemo = employees.length !== employeesMigrated.length;
  const employeeIds = new Set(employees.map((e) => e.id));
  const contractors = loaded.contractors.map(migrateContractor);
  const integrations = ensureSocialIds(loaded.integrations, social).map((row) => {
    const m = migrateIntegration(row, social);
    if (m.assignedEmployeeId && !employeeIds.has(m.assignedEmployeeId)) {
      const { assignedEmployeeId: _a, ...rest } = m;
      return rest as Integration;
    }
    return m;
  });
  const deliveries = loaded.deliveries.map((d) => {
    const next = { ...d };
    if (next.assignedEmployeeId && !employeeIds.has(next.assignedEmployeeId)) {
      delete next.assignedEmployeeId;
    }
    if (next.status === "delivered" && !next.deliveredAt) {
      next.deliveredAt = next.updatedAt ?? next.createdAt;
    }
    return next;
  });
  const completedTaskKeys = Array.isArray(loaded.completedTaskKeys)
    ? loaded.completedTaskKeys.filter((x): x is string => typeof x === "string")
    : [];
  const result: StoredShape = {
    contractors,
    integrations,
    socialOptions: social,
    nicheOptions,
    contractorItems: loaded.contractorItems,
    contractorLinks: loaded.contractorLinks ?? [],
    deliveries,
    employees,
    completedTaskKeys,
    promocodeSnapshots: loaded.promocodeSnapshots ?? [],
  };
  if (strippedLegacyDemo && typeof window !== "undefined") {
    saveStored(result);
  }
  return result;
}

function getInitialState(): StoredShape {
  const empty = emptyStoredShape();
  if (typeof window === "undefined") {
    return empty;
  }
  const loaded = loadStored();
  if (!loaded) {
    saveStored(empty);
    return empty;
  }
  return normalizeIncomingPanelData(loaded);
}

interface PanelDataContextValue {
  contractors: Contractor[];
  integrations: Integration[];
  socialOptions: SocialOption[];
  nicheOptions: NicheOption[];
  contractorItems: ContractorItem[];
  contractorLinks: ContractorLink[];
  deliveries: Delivery[];
  employees: Employee[];
  isAdmin: boolean;
  addContractor: (input: {
      name: string;
      contactPerson?: string;
      city?: string;
      promoCode?: string;
      virality?: string;
      nicheId?: string;
      sizeCategory?: Contractor["sizeCategory"];
      status?: ContractorStatus;
      rating?: number;
      note?: string;
      /** Именованные ссылки (как в карточке → «Ссылки»), создаются вместе с контрагентом */
      initialLinks?: { title: string; url: string }[];
    }) => void;
  updateContractor: (
    id: string,
    updates: Partial<
      Pick<
        Contractor,
        | "name"
        | "contactPerson"
        | "city"
        | "promoCode"
        | "virality"
        | "nicheId"
        | "sizeCategory"
        | "status"
        | "rating"
        | "note"
      >
    >,
  ) => void;
  removeContractor: (id: string) => void;
  addEmployee: (input: {
    fullName: string;
    telegramUsername: string;
    avatarUrl?: string;
    /** Логин панели (= логин входа), уникален среди сотрудников */
    panelLogin?: string;
  }) => string | null;
  updateEmployee: (
    id: string,
    updates: Partial<Pick<Employee, "fullName" | "telegramUsername" | "panelLogin" | "avatarUrl">>,
  ) => void;
  /** Аватар: только для своей карточки сотрудника */
  updateEmployeeSelfAvatar: (employeeId: string, avatarUrl: string) => void;
  removeEmployee: (id: string) => void;
  addIntegration: (input: AddIntegrationInput) => string | null;
  updateIntegration: (
    id: string,
    updates: Partial<
      Pick<
        Integration,
        | "contractorId"
        | "socialNetworkId"
        | "status"
        | "title"
        | "releaseDate"
        | "releaseTime"
        | "budget"
        | "reach"
        | "promoActivations"
        | "publicLink"
        | "comment"
        | "assignedEmployeeId"
        | "cooperationType"
      >
    >,
  ) => void;
  removeIntegration: (id: string) => void;
  addSocialOption: (label: string) => void;
  updateSocialOption: (id: string, label: string) => void;
  removeSocialOption: (id: string) => void;
  addNicheOption: (label: string) => void;
  updateNicheOption: (id: string, label: string) => void;
  removeNicheOption: (id: string) => void;
  addContractorItem: (input: {
    contractorId: string;
    productId: string;
    productName: string;
    size: string;
    imageUrl?: string;
  }) => void;
  removeContractorItem: (id: string) => void;
  addContractorLink: (input: { contractorId: string; title: string; url: string }) => void;
  updateContractorLink: (
    id: string,
    updates: Partial<Pick<ContractorLink, "title" | "url">>,
  ) => void;
  removeContractorLink: (id: string) => void;
  addDelivery: (input: AddDeliveryInput) => void;
  updateDeliveryStatus: (id: string, status: DeliveryStatus) => void;
  updateDelivery: (
    id: string,
    updates: Partial<
      Pick<Delivery, "contractorId" | "orderNumber" | "trackNumber" | "assignedEmployeeId">
    >,
  ) => void;
  addDeliveryItem: (
    deliveryId: string,
    item: { productId: string; productName: string; size: string; imageUrl?: string },
  ) => void;
  removeDeliveryItem: (deliveryId: string, itemId: string) => void;
  removeDelivery: (id: string) => void;
  completedTaskKeys: string[];
  /** Отметить задачу выполненной (доставка, проверка выхода интеграции). */
  completeTaskKey: (key: string) => void;
  saveError: string | null;
  clearSaveError: () => void;
  /** Снапшоты total-активаций промокодов (для расчёта дельт по месяцам) */
  promocodeSnapshots: Array<{ codeKey: string; t: number; activations: number }>;
  /** Записать снапшоты total-активаций промокодов */
  recordPromocodeSnapshot: (
    items: Array<{ codeKey: string; activations: number }>,
    fetchedAt: number,
  ) => void;
  addIntegrationPosition: (
    integrationId: string,
    input: Omit<IntegrationPosition, "id" | "createdAt">,
  ) => void;
  removeIntegrationPosition: (integrationId: string, positionId: string) => void;
}

const PanelDataContext = createContext<PanelDataContextValue | null>(null);

const EMPTY_STORED: StoredShape = {
  contractors: [],
  integrations: [],
  socialOptions: [...DEFAULT_SOCIAL_OPTIONS],
  nicheOptions: [],
  contractorItems: [],
  contractorLinks: [],
  deliveries: [],
  employees: [],
  completedTaskKeys: [],
  promocodeSnapshots: [],
};

export function PanelDataProvider({ children }: { children: ReactNode }) {
  const { role, currentLogin, isAuthenticated, hydrated } = useAuth();
  const isAdmin = role === "admin" || role === "superadmin";
  const isAdminRef = useRef(isAdmin);
  isAdminRef.current = isAdmin;

  const [data, setData] = useState<StoredShape>(EMPTY_STORED);
  const dataRef = useRef(data);
  dataRef.current = data;

  const [userTaskKeys, setUserTaskKeys] = useState<string[]>([]);
  const userTaskKeysRef = useRef<string[]>([]);
  userTaskKeysRef.current = userTaskKeys;

  const [saveError, setSaveError] = useState<string | null>(null);

  const serverRevisionRef = useRef<number | null>(null);
  const pendingSaveRef = useRef(false);
  const flushTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const applyServerPayload = useCallback((bodyData: unknown, revision: number) => {
    const coerced = coercePanelStoredShape(bodyData) ?? EMPTY_STORED;
    const normalized = normalizeIncomingPanelData(coerced);
    setData(normalized);
    saveStored(normalized);
    serverRevisionRef.current = revision;
  }, []);

  const pushSnapshotToServer = useCallback(
    async (snapshot: StoredShape): Promise<boolean> => {
      if (!isAuthenticated) return false;
      pendingSaveRef.current = true;
      try {
        const base = serverRevisionRef.current ?? 0;
        const res = await fetch("/api/panel-data", {
          method: "PUT",
          credentials: "include",
          headers: {
            "Content-Type": "application/json",
            "X-Panel-Base-Revision": String(base),
          },
          body: JSON.stringify(snapshot),
        });
        if (res.status === 200) {
          const j = (await res.json()) as { revision?: unknown };
          if (typeof j.revision === "number") {
            serverRevisionRef.current = j.revision;
          }
          setSaveError(null);
          return true;
        }
        if (res.status === 409) {
          const j = (await res.json()) as { revision?: unknown; data?: unknown };
          const r = typeof j.revision === "number" ? j.revision : 0;
          applyServerPayload(j.data ?? null, r);
          return false;
        }
        if (res.status === 401 || res.status === 403) {
          console.warn("[panel-data] отказ при сохранении (сессия)");
        }
        setSaveError("Не удалось сохранить данные. Проверьте соединение.");
        return false;
      } catch (e) {
        console.error("[panel-data] сохранение не удалось", e);
        setSaveError("Не удалось сохранить данные. Проверьте соединение.");
        return false;
      } finally {
        pendingSaveRef.current = false;
      }
    },
    [applyServerPayload, isAuthenticated],
  );

  const scheduleServerSave = useCallback(
    (next: StoredShape) => {
      if (!isAuthenticated) return;
      if (flushTimerRef.current) clearTimeout(flushTimerRef.current);
      flushTimerRef.current = setTimeout(() => {
        flushTimerRef.current = null;
        void pushSnapshotToServer(next);
      }, 650);
    },
    [isAuthenticated, pushSnapshotToServer],
  );

  useEffect(() => {
    try {
      setData(getInitialState());
    } catch (e) {
      console.error("[panel-data] init from storage failed", e);
      setData(EMPTY_STORED);
    }
  }, []);

  useEffect(() => {
    if (!hydrated || !isAuthenticated) return;
    const ac = new AbortController();
    (async () => {
      try {
        const res = await fetch("/api/panel-data", {
          credentials: "include",
          signal: ac.signal,
        });
        if (ac.signal.aborted) return;
        if (res.status === 401 || res.status === 403) {
          console.warn("[panel-data] нет сессии при загрузке снимка");
          return;
        }
        if (res.status === 503 || !res.ok) return;
        const body = (await res.json()) as { revision?: unknown; data?: unknown };
        const revision = typeof body.revision === "number" ? body.revision : 0;
        if (ac.signal.aborted) return;
        if (body.data == null && revision === 0) {
          const local = getInitialState();
          setData(local);
          serverRevisionRef.current = 0;
          queueMicrotask(() => {
            void pushSnapshotToServer(local);
          });
          return;
        }
        applyServerPayload(body.data, revision);
      } catch (e) {
        if (ac.signal.aborted) return;
        console.error("[panel-data] загрузка с сервера", e);
      }
    })();
    return () => ac.abort();
  }, [hydrated, isAuthenticated, applyServerPayload, pushSnapshotToServer]);

  useEffect(() => {
    if (!hydrated || !isAuthenticated) return;
    void fetch("/api/tasks/completed", { credentials: "include" })
      .then((r) => r.ok ? r.json() : null)
      .then((j: { keys?: string[] } | null) => {
        if (Array.isArray(j?.keys)) setUserTaskKeys(j!.keys.filter((k): k is string => typeof k === "string"));
      })
      .catch(() => {});
  }, [hydrated, isAuthenticated]);

  useEffect(() => {
    if (!hydrated || !isAuthenticated) return;
    const id = window.setInterval(() => {
      if (pendingSaveRef.current) return;
      if (document.visibilityState === "hidden") return;
      void (async () => {
        try {
          const res = await fetch("/api/panel-data", { credentials: "include" });
          if (!res.ok) return;
          const body = (await res.json()) as { revision?: unknown; data?: unknown };
          const revision = typeof body.revision === "number" ? body.revision : 0;
          const localRev = serverRevisionRef.current ?? 0;
          if (revision <= localRev) return;
          if (body.data == null) return;
          applyServerPayload(body.data, revision);
        } catch {
          /* ignore */
        }
      })();
    }, 42_000);
    return () => clearInterval(id);
  }, [hydrated, isAuthenticated, applyServerPayload]);

  const patch = useCallback(
    (fn: (prev: StoredShape) => StoredShape) => {
      setData((prev) => {
        const next = fn(prev);
        saveStored(next);
        scheduleServerSave(next);
        return next;
      });
    },
    [scheduleServerSave],
  );

  const addContractor = useCallback(
    (input: {
      name: string;
      contactPerson?: string;
      city?: string;
      promoCode?: string;
      virality?: string;
      nicheId?: string;
      sizeCategory?: Contractor["sizeCategory"];
      status?: ContractorStatus;
      rating?: number;
      note?: string;
      initialLinks?: { title: string; url: string }[];
    }) => {
      const n = input.name.trim();
      if (!n || !isAdminRef.current) return;
      const rawRating =
        typeof input.rating === "number" ? input.rating : Number(input.rating ?? 0);
      patch((prev) => {
        const nid = input.nicheId?.trim();
        const nicheId =
          nid && prev.nicheOptions.some((o) => o.id === nid) ? nid : undefined;
        const sc = input.sizeCategory;
        const sizeCategory =
          sc === "micro" || sc === "middle" || sc === "large" ? sc : undefined;
        const newId = createPanelId();
        const now = new Date().toISOString();
        const linkRows: ContractorLink[] = [];
        for (const row of input.initialLinks ?? []) {
          const title = row.title?.trim();
          const urlRaw = normalizeIntegrationPublicLink(row.url);
          if (!title || !urlRaw || !integrationPublicLinkHref(urlRaw)) continue;
          linkRows.push({
            id: createPanelId(),
            contractorId: newId,
            title,
            url: urlRaw,
            createdAt: now,
          });
        }
        return {
          ...prev,
          contractors: [
            ...prev.contractors,
            {
              id: newId,
              name: n,
              createdAt: now,
              contactPerson: input.contactPerson?.trim() ?? "",
              ...(input.city?.trim() ? { city: input.city.trim() } : {}),
              ...(input.promoCode?.trim() ? { promoCode: input.promoCode.trim() } : {}),
              ...(input.virality?.trim() ? { virality: input.virality.trim() } : {}),
              ...(nicheId ? { nicheId } : {}),
              ...(sizeCategory ? { sizeCategory } : {}),
              status: input.status === "paused" ? "paused" : "active",
              rating: Number.isNaN(rawRating) ? 0 : Math.max(0, Math.min(10, rawRating)),
              note: input.note?.trim() ?? "",
            },
          ],
          contractorLinks: [...prev.contractorLinks, ...linkRows],
        };
      });
    },
    [isAdmin, patch],
  );

  const updateContractor = useCallback(
    (
      id: string,
      updates: Partial<
        Pick<
          Contractor,
          | "name"
          | "contactPerson"
          | "city"
          | "promoCode"
          | "virality"
          | "nicheId"
          | "sizeCategory"
          | "status"
          | "rating"
          | "note"
        >
      >,
    ) => {
      if (!isAdminRef.current) return;
      patch((prev) => ({
        ...prev,
        contractors: prev.contractors.map((c) => {
          if (c.id !== id) return c;
          const next = { ...c };
          if (updates.name !== undefined) next.name = updates.name;
          if (updates.contactPerson !== undefined)
            next.contactPerson = updates.contactPerson;
          if (updates.city !== undefined) {
            const t = updates.city.trim();
            if (t) next.city = t;
            else delete next.city;
          }
          if (updates.promoCode !== undefined) {
            const t = updates.promoCode.trim();
            if (t) next.promoCode = t;
            else delete next.promoCode;
          }
          if (updates.virality !== undefined) {
            const t = updates.virality.trim();
            if (t) next.virality = t;
            else delete next.virality;
          }
          if ("nicheId" in updates) {
            const nid = typeof updates.nicheId === "string" ? updates.nicheId.trim() : "";
            if (nid && prev.nicheOptions.some((o) => o.id === nid)) next.nicheId = nid;
            else delete next.nicheId;
          }
          if ("sizeCategory" in updates) {
            const v = updates.sizeCategory;
            if (v === undefined || v === null) {
              delete next.sizeCategory;
            } else if (v === "micro" || v === "middle" || v === "large") {
              next.sizeCategory = v;
            }
          }
          if (updates.status !== undefined) {
            next.status = updates.status === "paused" ? "paused" : "active";
          }
          if (updates.rating !== undefined) {
            const raw =
              typeof updates.rating === "number"
                ? updates.rating
                : Number(updates.rating);
            next.rating = Number.isNaN(raw) ? 0 : Math.max(0, Math.min(10, raw));
          }
          if (updates.note !== undefined) next.note = updates.note;
          return next;
        }),
      }));
    },
    [isAdmin, patch],
  );

  const removeContractor = useCallback(
    (id: string) => {
      if (!isAdminRef.current) return;
      patch((prev) => ({
        ...prev,
        contractors: prev.contractors.filter((c) => c.id !== id),
        integrations: prev.integrations.filter((row) => row.contractorId !== id),
        contractorItems: prev.contractorItems.filter((row) => row.contractorId !== id),
        contractorLinks: prev.contractorLinks.filter((row) => row.contractorId !== id),
        deliveries: prev.deliveries.filter((row) => row.contractorId !== id),
      }));
    },
    [isAdmin, patch],
  );

  const addEmployee = useCallback(
    (input: {
      fullName: string;
      telegramUsername: string;
      avatarUrl?: string;
      panelLogin?: string;
    }): string | null => {
      const actor = normalizeUsername(currentLogin ?? "");
      if (actor !== SUPERADMIN_LOGIN || role !== "superadmin") return null;
      const fullName = input.fullName.trim();
      const telegramUsername = normalizeTelegramUsername(input.telegramUsername);
      const panelLogin = input.panelLogin?.trim()
        ? normalizeTelegramUsername(input.panelLogin)
        : undefined;
      if (!fullName || !telegramUsername) return null;
      const newId = createPanelId();
      let applied = false;
      patch((prev) => {
        if (
          prev.employees.some(
            (e) => normalizeTelegramUsername(e.telegramUsername) === telegramUsername,
          )
        ) {
          return prev;
        }
        if (
          panelLogin &&
          prev.employees.some(
            (e) => e.panelLogin && normalizeTelegramUsername(e.panelLogin) === panelLogin,
          )
        ) {
          return prev;
        }
        applied = true;
        return {
          ...prev,
          employees: [
            ...prev.employees,
            {
              id: newId,
              fullName,
              telegramUsername,
              ...(panelLogin ? { panelLogin } : {}),
              avatarUrl: input.avatarUrl?.trim() || undefined,
              createdAt: new Date().toISOString(),
            },
          ],
        };
      });
      return applied ? newId : null;
    },
    [currentLogin, role, patch],
  );

  const updateEmployee = useCallback(
    (
      id: string,
      updates: Partial<
        Pick<Employee, "fullName" | "telegramUsername" | "panelLogin" | "avatarUrl">
      >,
    ) => {
      if (!isAdminRef.current) return;
      patch((prev) => ({
        ...prev,
        employees: prev.employees.map((e) => {
          if (e.id !== id) return e;
          const next = { ...e };
          if (updates.fullName !== undefined) {
            const v = updates.fullName.trim();
            if (v) next.fullName = v;
          }
          if (updates.telegramUsername !== undefined) {
            const tg = normalizeTelegramUsername(updates.telegramUsername);
            if (
              tg &&
              !prev.employees.some(
                (x) =>
                  x.id !== id && normalizeTelegramUsername(x.telegramUsername) === tg,
              )
            ) {
              next.telegramUsername = tg;
            }
          }
          if (updates.panelLogin !== undefined) {
            const pl = normalizeTelegramUsername(updates.panelLogin);
            if (
              pl &&
              !prev.employees.some(
                (x) => x.id !== id && x.panelLogin && normalizeTelegramUsername(x.panelLogin) === pl,
              )
            ) {
              next.panelLogin = pl;
            }
          }
          if (updates.avatarUrl !== undefined) {
            const u = updates.avatarUrl.trim();
            next.avatarUrl = u || undefined;
          }
          return next;
        }),
      }));
    },
    [isAdmin, patch],
  );

  const updateEmployeeSelfAvatar = useCallback(
    (employeeId: string, avatarUrl: string) => {
      if (!isAuthenticated || !currentLogin?.trim()) return;
      const sessionN = normalizeTelegramUsername(currentLogin);
      patch((prev) => ({
        ...prev,
        employees: prev.employees.map((e) => {
          if (e.id !== employeeId) return e;
          const ownPanel = e.panelLogin && normalizeTelegramUsername(e.panelLogin) === sessionN;
          const ownTg = normalizeTelegramUsername(e.telegramUsername) === sessionN;
          if (!ownPanel && !ownTg) return e;
          const u = avatarUrl.trim();
          return { ...e, avatarUrl: u || undefined };
        }),
      }));
    },
    [currentLogin, isAuthenticated, patch],
  );

  const removeEmployee = useCallback(
    (id: string) => {
      const actor = normalizeUsername(currentLogin ?? "");
      if (actor !== SUPERADMIN_LOGIN || role !== "superadmin") return;
      patch((prev) => ({
        ...prev,
        employees: prev.employees.filter((e) => e.id !== id),
        integrations: prev.integrations.map((row) =>
          row.assignedEmployeeId === id
            ? { ...row, assignedEmployeeId: undefined }
            : row,
        ),
        deliveries: prev.deliveries.map((d) =>
          d.assignedEmployeeId === id ? { ...d, assignedEmployeeId: undefined } : d,
        ),
      }));
    },
    [currentLogin, role, patch],
  );

  const addIntegration = useCallback(
    (input: AddIntegrationInput): string | null => {
      if (!isAdminRef.current) return null;
      const contractorId = input.contractorId.trim();
      const socialPick = input.socialNetworkId.trim();
      const title = input.title?.trim() ?? "";
      if (!contractorId || !socialPick || !title) return null;

      const newId = createPanelId();
      const status = normalizeIntegrationStatus(input.status ?? "draft");
      const releaseDate = parseReleaseDateInput(input.releaseDate);
      const releaseTime = parseReleaseTimeInput(input.releaseTime);
      const budget = parseNonNegativeOptional(input.budget);
      const reach = parseNonNegativeOptional(input.reach);
      const promoActivations = parseNonNegativeOptional(input.promoActivations);
      const publicLink = normalizeIntegrationPublicLink(input.publicLink);
      const coopIn = input.cooperationType;
      const cooperationType: IntegrationCooperationType | undefined =
        coopIn === "barter" || coopIn === "commercial" ? coopIn : undefined;

      let applied = false;
      patch((prev) => {
        if (!prev.contractors.some((c) => c.id === contractorId)) {
          return prev;
        }
        if (isIntegrationTitleTaken(prev.integrations, title)) {
          return prev;
        }
        const socialNetworkId = prev.socialOptions.some((o) => o.id === socialPick)
          ? socialPick
          : (prev.socialOptions[0]?.id ?? "twitch");
        applied = true;
        let assign = input.assignedEmployeeId?.trim();
        if (!assign || !prev.employees.some((em) => em.id === assign)) {
          assign = undefined;
        }
        const row: Integration = {
          id: newId,
          contractorId,
          socialNetworkId,
          status,
          createdAt: new Date().toISOString(),
          title,
          ...(releaseDate ? { releaseDate } : {}),
          ...(releaseTime ? { releaseTime } : {}),
          ...(budget !== undefined ? { budget } : {}),
          ...(reach !== undefined ? { reach } : {}),
          ...(promoActivations !== undefined ? { promoActivations } : {}),
          ...(publicLink ? { publicLink } : {}),
          ...(input.comment?.trim() ? { comment: input.comment.trim() } : {}),
          ...(assign ? { assignedEmployeeId: assign } : {}),
          ...(cooperationType ? { cooperationType } : {}),
        };
        return { ...prev, integrations: [...prev.integrations, row] };
      });

      return applied ? newId : null;
    },
    [isAdmin, patch],
  );

  const updateIntegration = useCallback(
    (
      id: string,
      updates: Partial<
        Pick<
          Integration,
          | "contractorId"
          | "socialNetworkId"
          | "status"
          | "title"
          | "releaseDate"
          | "releaseTime"
          | "budget"
          | "reach"
          | "promoActivations"
          | "publicLink"
          | "comment"
          | "assignedEmployeeId"
          | "cooperationType"
        >
      >,
    ) => {
      patch((prev) => {
        const row = prev.integrations.find((r) => r.id === id);
        if (!row) return prev;

        const next: Integration = { ...row };

        if (updates.contractorId !== undefined) {
          next.contractorId = updates.contractorId;
        }
        if (updates.socialNetworkId !== undefined) {
          next.socialNetworkId = updates.socialNetworkId;
        }
        if (updates.status !== undefined) {
          next.status = normalizeIntegrationStatus(updates.status);
        }
        if (updates.title !== undefined) {
          const t = updates.title.trim();
          if (!t) return prev;
          if (isIntegrationTitleTaken(prev.integrations, t, id)) return prev;
          next.title = t;
        }
        if ("releaseDate" in updates) {
          next.releaseDate = parseReleaseDateInput(updates.releaseDate);
        }
        if ("releaseTime" in updates) {
          next.releaseTime = parseReleaseTimeInput(updates.releaseTime);
        }
        if ("budget" in updates) {
          if (updates.budget === undefined) {
            next.budget = undefined;
          } else {
            const b = parseNonNegativeOptional(updates.budget);
            if (b !== undefined) next.budget = b;
          }
        }
        if ("reach" in updates) {
          if (updates.reach === undefined) {
            next.reach = undefined;
          } else {
            const r = parseNonNegativeOptional(updates.reach);
            if (r !== undefined) next.reach = r;
          }
        }
        if ("promoActivations" in updates) {
          if (updates.promoActivations === undefined) {
            next.promoActivations = undefined;
          } else {
            const p = parseNonNegativeOptional(updates.promoActivations);
            if (p !== undefined) next.promoActivations = p;
          }
        }
        if ("publicLink" in updates) {
          const pl = normalizeIntegrationPublicLink(
            typeof updates.publicLink === "string" ? updates.publicLink : undefined,
          );
          if (pl) next.publicLink = pl;
          else delete next.publicLink;
        }
        if ("comment" in updates) {
          const c =
            typeof updates.comment === "string" ? updates.comment.trim() : "";
          if (c) next.comment = c;
          else delete next.comment;
        }
        if ("cooperationType" in updates) {
          const v = updates.cooperationType;
          if (v === undefined || v === null) {
            delete next.cooperationType;
          } else if (v === "barter" || v === "commercial") {
            next.cooperationType = v;
          }
        }
        if ("assignedEmployeeId" in updates) {
          const v = updates.assignedEmployeeId;
          if (v === undefined || v === "") {
            delete next.assignedEmployeeId;
          } else if (prev.employees.some((em) => em.id === v)) {
            next.assignedEmployeeId = v;
          }
        }

        let completedTaskKeys = prev.completedTaskKeys;
        if (typeof next.reach === "number" && !Number.isNaN(next.reach)) {
          const rk = integrationReachTaskKey(id);
          if (!completedTaskKeys.includes(rk)) {
            completedTaskKeys = [...completedTaskKeys, rk];
          }
        }
        if (next.status === "returned" || next.status === "exchange") {
          const vk = integrationReleaseVerifyTaskKey(id);
          if (!completedTaskKeys.includes(vk)) {
            completedTaskKeys = [...completedTaskKeys, vk];
          }
        }

        return {
          ...prev,
          completedTaskKeys,
          integrations: prev.integrations.map((r) =>
            r.id === id ? next : r,
          ),
        };
      });
    },
    [patch],
  );

  const removeIntegration = useCallback(
    (id: string) => {
      if (!isAdminRef.current) return;
      const rk = integrationReachTaskKey(id);
      const vk = integrationReleaseVerifyTaskKey(id);
      patch((prev) => ({
        ...prev,
        integrations: prev.integrations.filter((r) => r.id !== id),
        completedTaskKeys: prev.completedTaskKeys.filter((k) => k !== rk && k !== vk),
      }));
    },
    [isAdmin, patch],
  );

  const addIntegrationPosition = useCallback(
    (integrationId: string, input: Omit<IntegrationPosition, "id" | "createdAt">) => {
      const newPos: IntegrationPosition = {
        id: createPanelId(),
        ...input,
        createdAt: new Date().toISOString(),
      };
      patch((prev) => ({
        ...prev,
        integrations: prev.integrations.map((r) =>
          r.id === integrationId
            ? { ...r, positions: [...(r.positions ?? []), newPos] }
            : r,
        ),
      }));
    },
    [patch],
  );

  const removeIntegrationPosition = useCallback(
    (integrationId: string, positionId: string) => {
      patch((prev) => ({
        ...prev,
        integrations: prev.integrations.map((r) =>
          r.id === integrationId
            ? { ...r, positions: (r.positions ?? []).filter((p) => p.id !== positionId) }
            : r,
        ),
      }));
    },
    [patch],
  );

  const addSocialOption = useCallback(
    (label: string) => {
      const t = label.trim();
      if (!t || !isAdminRef.current) return;
      patch((prev) => {
        let id = slugify(t);
        const used = new Set(prev.socialOptions.map((o) => o.id));
        let candidate = id;
        let i = 2;
        while (used.has(candidate)) {
          candidate = `${id}-${i}`;
          i += 1;
        }
        return {
          ...prev,
          socialOptions: [...prev.socialOptions, { id: candidate, label: t }],
        };
      });
    },
    [isAdmin, patch],
  );

  const updateSocialOption = useCallback(
    (id: string, label: string) => {
      const t = label.trim();
      if (!t || !isAdminRef.current) return;
      patch((prev) => ({
        ...prev,
        socialOptions: prev.socialOptions.map((o) =>
          o.id === id ? { ...o, label: t } : o,
        ),
      }));
    },
    [isAdmin, patch],
  );

  const removeSocialOption = useCallback(
    (id: string) => {
      if (!isAdminRef.current) return;
      patch((prev) => {
        const next = prev.socialOptions.filter((o) => o.id !== id);
        if (next.length === 0) return prev;
        return {
          ...prev,
          socialOptions: next,
          integrations: ensureSocialIds(prev.integrations, next),
        };
      });
    },
    [isAdmin, patch],
  );

  const addNicheOption = useCallback(
    (label: string) => {
      const t = label.trim();
      if (!t || !isAdminRef.current) return;
      patch((prev) => {
        let id = slugify(t);
        const used = new Set(prev.nicheOptions.map((o) => o.id));
        let candidate = id;
        let i = 2;
        while (used.has(candidate)) {
          candidate = `${id}-${i}`;
          i += 1;
        }
        return {
          ...prev,
          nicheOptions: [...prev.nicheOptions, { id: candidate, label: t }],
        };
      });
    },
    [isAdmin, patch],
  );

  const updateNicheOption = useCallback(
    (id: string, label: string) => {
      const t = label.trim();
      if (!t || !isAdminRef.current) return;
      patch((prev) => ({
        ...prev,
        nicheOptions: prev.nicheOptions.map((o) =>
          o.id === id ? { ...o, label: t } : o,
        ),
      }));
    },
    [isAdmin, patch],
  );

  const removeNicheOption = useCallback(
    (id: string) => {
      if (!isAdminRef.current) return;
      patch((prev) => ({
        ...prev,
        nicheOptions: prev.nicheOptions.filter((o) => o.id !== id),
        contractors: prev.contractors.map((c) => {
          if (c.nicheId !== id) return c;
          const next = { ...c };
          delete next.nicheId;
          return next;
        }),
      }));
    },
    [isAdmin, patch],
  );

  const addContractorItem = useCallback(
    (input: {
      contractorId: string;
      productId: string;
      productName: string;
      size: string;
      imageUrl?: string;
    }) => {
      if (!isAdminRef.current) return;
      const contractorId = input.contractorId.trim();
      const productId = input.productId.trim();
      const productName = input.productName.trim();
      const size = input.size.trim();
      if (!contractorId || !productId || !productName || !size) return;
      patch((prev) => ({
        ...prev,
        contractorItems: [
          ...prev.contractorItems,
          {
            id: createPanelId(),
            contractorId,
            productId,
            productName,
            size,
            imageUrl: input.imageUrl?.trim() ?? "",
            createdAt: new Date().toISOString(),
          },
        ],
      }));
    },
    [isAdmin, patch],
  );

  const removeContractorItem = useCallback(
    (id: string) => {
      if (!isAdminRef.current) return;
      patch((prev) => ({
        ...prev,
        contractorItems: prev.contractorItems.filter((item) => item.id !== id),
      }));
    },
    [isAdmin, patch],
  );

  const addContractorLink = useCallback(
    (input: { contractorId: string; title: string; url: string }) => {
      if (!isAdminRef.current) return;
      const contractorId = input.contractorId.trim();
      const title = input.title.trim();
      const urlNorm = normalizeIntegrationPublicLink(input.url);
      if (!contractorId || !title || !urlNorm) return;
      patch((prev) => ({
        ...prev,
        contractorLinks: [
          ...prev.contractorLinks,
          {
            id: createPanelId(),
            contractorId,
            title,
            url: urlNorm,
            createdAt: new Date().toISOString(),
          },
        ],
      }));
    },
    [isAdmin, patch],
  );

  const updateContractorLink = useCallback(
    (id: string, updates: Partial<Pick<ContractorLink, "title" | "url">>) => {
      if (!isAdminRef.current) return;
      patch((prev) => ({
        ...prev,
        contractorLinks: prev.contractorLinks.map((row) => {
          if (row.id !== id) return row;
          const next = { ...row };
          if (updates.title !== undefined) {
            const t = updates.title.trim();
            if (t) next.title = t;
          }
          if (updates.url !== undefined) {
            const u = normalizeIntegrationPublicLink(updates.url);
            if (u) next.url = u;
          }
          return next;
        }),
      }));
    },
    [isAdmin, patch],
  );

  const removeContractorLink = useCallback(
    (id: string) => {
      if (!isAdminRef.current) return;
      patch((prev) => ({
        ...prev,
        contractorLinks: prev.contractorLinks.filter((row) => row.id !== id),
      }));
    },
    [isAdmin, patch],
  );

  const addDelivery = useCallback(
    (input: AddDeliveryInput) => {
      if (!isAdminRef.current) return;
      const contractorId = input.contractorId.trim();
      const orderNumber = input.orderNumber?.trim() ?? "";
      const trackNumber = input.trackNumber.trim();
      if (!contractorId || !trackNumber) return;
      const items = input.items
        .map((item) => ({
          id: createPanelId(),
          productId: item.productId.trim(),
          productName: item.productName.trim(),
          size: item.size.trim(),
          imageUrl: item.imageUrl?.trim() ?? "",
        }))
        .filter((item) => item.productId && item.productName && item.size);
      patch((prev) => {
        let assign = input.assignedEmployeeId?.trim();
        if (!assign || !prev.employees.some((em) => em.id === assign)) {
          assign = undefined;
        }
        return {
          ...prev,
          deliveries: [
            ...prev.deliveries,
            {
              id: createPanelId(),
              contractorId,
              orderNumber,
              trackNumber,
              items,
              itemIds: [],
              status: "created",
              createdAt: new Date().toISOString(),
              updatedAt: new Date().toISOString(),
              ...(assign ? { assignedEmployeeId: assign } : {}),
            },
          ],
        };
      });
    },
    [isAdmin, patch],
  );

  const updateDeliveryStatus = useCallback(
    (id: string, status: DeliveryStatus) => {
      patch((prev) => {
        const delivery = prev.deliveries.find((d) => d.id === id);
        if (!delivery) {
          return prev;
        }

        const now = new Date().toISOString();
        let nextDelivery: Delivery = { ...delivery, status, updatedAt: now };
        if (status === "delivered" && !nextDelivery.deliveredAt) {
          nextDelivery = { ...nextDelivery, deliveredAt: now };
        }

        if (status !== "delivered" || delivery.receivedStockSyncedAt) {
          return {
            ...prev,
            deliveries: prev.deliveries.map((d) => (d.id === id ? nextDelivery : d)),
          };
        }

        const contractorId = delivery.contractorId.trim();
        const stockRows: ContractorItem[] = contractorId
          ? (delivery.items ?? [])
              .filter(
                (item) =>
                  item.productId?.trim() && item.productName?.trim() && item.size?.trim(),
              )
              .map((item) => ({
                id: createPanelId(),
                contractorId,
                productId: item.productId.trim(),
                productName: item.productName.trim(),
                size: item.size.trim(),
                imageUrl: item.imageUrl?.trim() ?? "",
                createdAt: now,
              }))
          : [];

        return {
          ...prev,
          contractorItems:
            stockRows.length > 0 ? [...prev.contractorItems, ...stockRows] : prev.contractorItems,
          deliveries: prev.deliveries.map((d) =>
            d.id === id ? { ...nextDelivery, receivedStockSyncedAt: now } : d,
          ),
        };
      });
    },
    [patch],
  );

  const updateDelivery = useCallback(
    (
      id: string,
      updates: Partial<
        Pick<Delivery, "contractorId" | "orderNumber" | "trackNumber" | "assignedEmployeeId">
      >,
    ) => {
      if (!isAdminRef.current) return;
      patch((prev) => ({
        ...prev,
        deliveries: prev.deliveries.map((delivery) => {
          if (delivery.id !== id) return delivery;
          const next = { ...delivery };
          if (updates.contractorId !== undefined) {
            const value = updates.contractorId.trim();
            if (value) next.contractorId = value;
          }
          if (updates.orderNumber !== undefined) next.orderNumber = updates.orderNumber;
          if (updates.trackNumber !== undefined) {
            const value = updates.trackNumber.trim();
            if (value) next.trackNumber = value;
          }
          if ("assignedEmployeeId" in updates) {
            const v = updates.assignedEmployeeId;
            if (v === undefined || v === "") {
              delete next.assignedEmployeeId;
            } else if (prev.employees.some((em) => em.id === v)) {
              next.assignedEmployeeId = v;
            }
          }
          next.updatedAt = new Date().toISOString();
          return next;
        }),
      }));
    },
    [isAdmin, patch],
  );

  const addDeliveryItem = useCallback(
    (
      deliveryId: string,
      item: { productId: string; productName: string; size: string; imageUrl?: string },
    ) => {
      if (!isAdminRef.current) return;
      const productId = item.productId.trim();
      const productName = item.productName.trim();
      const size = item.size.trim();
      if (!deliveryId.trim() || !productId || !productName || !size) return;
      patch((prev) => ({
        ...prev,
        deliveries: prev.deliveries.map((delivery) => {
          if (delivery.id !== deliveryId) return delivery;
          const existing = delivery.items ?? [];
          const nextItems = [
            ...existing,
            {
              id: createPanelId(),
              productId,
              productName,
              size,
              imageUrl: item.imageUrl?.trim() ?? "",
            },
          ];
          return {
            ...delivery,
            items: nextItems,
            updatedAt: new Date().toISOString(),
          };
        }),
      }));
    },
    [isAdmin, patch],
  );

  const removeDeliveryItem = useCallback(
    (deliveryId: string, itemId: string) => {
      if (!isAdminRef.current) return;
      patch((prev) => ({
        ...prev,
        deliveries: prev.deliveries.map((delivery) => {
          if (delivery.id !== deliveryId) return delivery;
          return {
            ...delivery,
            items: (delivery.items ?? []).filter((x) => x.id !== itemId),
            updatedAt: new Date().toISOString(),
          };
        }),
      }));
    },
    [isAdmin, patch],
  );

  const removeDelivery = useCallback(
    (id: string) => {
      if (!isAdminRef.current) return;
      const dk = deliveryNotifyTaskKey(id);
      patch((prev) => ({
        ...prev,
        deliveries: prev.deliveries.filter((d) => d.id !== id),
        completedTaskKeys: prev.completedTaskKeys.filter((k) => k !== dk),
      }));
    },
    [isAdmin, patch],
  );

  const completeTaskKey = useCallback(
    (key: string) => {
      const k = key.trim();
      if (!k) return;
      setUserTaskKeys((prev) => {
        if (prev.includes(k)) return prev;
        const next = [...prev, k];
        void fetch("/api/tasks/completed", {
          method: "PUT",
          credentials: "include",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ keys: Array.from(new Set([...userTaskKeysRef.current, k])) }),
        }).catch(() => {});
        return next;
      });
    },
    [],
  );

  const clearSaveError = useCallback(() => setSaveError(null), []);

  const recordPromocodeSnapshot = useCallback(
    (items: Array<{ codeKey: string; activations: number }>, fetchedAt: number) => {
      const t = Number.isFinite(fetchedAt) ? fetchedAt : Date.now();
      const normalized = items
        .map((it) => {
          const codeKey = (it.codeKey ?? "").trim().toLowerCase();
          const activations = Number.isFinite(it.activations) ? it.activations : 0;
          if (!codeKey) return null;
          return { codeKey, t, activations };
        })
        .filter(Boolean) as Array<{ codeKey: string; t: number; activations: number }>;

      if (normalized.length === 0) return;

      patch((prev) => {
        const prevRows = prev.promocodeSnapshots ?? [];
        const next = [...prevRows];

        // Ограничим рост: храним максимум ~1200 записей (примерно 25 дней по 2 снапшота/час для 1 кода,
        // или меньше при нескольких кодах). Этого достаточно для "месяц".
        const HARD_LIMIT = 1200;

        for (const row of normalized) {
          const last = next.length > 0 ? next[next.length - 1] : undefined;
          // Если подряд прилетает ровно то же значение по тому же коду и времени ~ то же — пропускаем.
          if (
            last &&
            last.codeKey === row.codeKey &&
            last.activations === row.activations &&
            Math.abs(last.t - row.t) < 60_000
          ) {
            continue;
          }
          next.push(row);
        }

        const trimmed =
          next.length > HARD_LIMIT ? next.slice(next.length - HARD_LIMIT) : next;

        return { ...prev, promocodeSnapshots: trimmed };
      });
    },
    [patch],
  );

  const value = useMemo(
    (): PanelDataContextValue => ({
      contractors: data.contractors,
      integrations: data.integrations,
      socialOptions: data.socialOptions,
      nicheOptions: data.nicheOptions,
      contractorItems: data.contractorItems,
      contractorLinks: data.contractorLinks,
      deliveries: data.deliveries,
      employees: data.employees,
      isAdmin,
      addContractor,
      updateContractor,
      removeContractor,
      addEmployee,
      updateEmployee,
      updateEmployeeSelfAvatar,
      removeEmployee,
      addIntegration,
      updateIntegration,
      removeIntegration,
      addSocialOption,
      updateSocialOption,
      removeSocialOption,
      addNicheOption,
      updateNicheOption,
      removeNicheOption,
      addContractorItem,
      removeContractorItem,
      addContractorLink,
      updateContractorLink,
      removeContractorLink,
      addDelivery,
      updateDeliveryStatus,
      updateDelivery,
      addDeliveryItem,
      removeDeliveryItem,
      removeDelivery,
      completedTaskKeys: Array.from(new Set([...data.completedTaskKeys, ...userTaskKeys])),
      completeTaskKey,
      saveError,
      clearSaveError,
      promocodeSnapshots: data.promocodeSnapshots ?? [],
      recordPromocodeSnapshot,
      addIntegrationPosition,
      removeIntegrationPosition,
    }),
    [
      data.contractors,
      data.integrations,
      data.socialOptions,
      data.nicheOptions,
      data.contractorItems,
      data.contractorLinks,
      data.deliveries,
      data.employees,
      data.completedTaskKeys,
      data.promocodeSnapshots,
      userTaskKeys,
      saveError,
      clearSaveError,
      isAdmin,
      addContractor,
      updateContractor,
      removeContractor,
      addEmployee,
      updateEmployee,
      updateEmployeeSelfAvatar,
      removeEmployee,
      addIntegration,
      updateIntegration,
      removeIntegration,
      addSocialOption,
      updateSocialOption,
      removeSocialOption,
      addNicheOption,
      updateNicheOption,
      removeNicheOption,
      addContractorItem,
      removeContractorItem,
      addContractorLink,
      updateContractorLink,
      removeContractorLink,
      addDelivery,
      updateDeliveryStatus,
      updateDelivery,
      addDeliveryItem,
      removeDeliveryItem,
      removeDelivery,
      completeTaskKey,
      recordPromocodeSnapshot,
      addIntegrationPosition,
      removeIntegrationPosition,
    ],
  );

  return (
    <PanelDataContext.Provider value={value}>{children}</PanelDataContext.Provider>
  );
}

export function usePanelData() {
  const ctx = useContext(PanelDataContext);
  if (!ctx) throw new Error("usePanelData must be used within PanelDataProvider");
  return ctx;
}
