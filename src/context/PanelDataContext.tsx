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
  coercePanelStoredShape,
  parseLegacyPromocodeSnapshots,
} from "@/lib/panel-stored-shape";
import {
  loadPromocodeSnapshots,
  migratePromocodeSnapshotsFromPanel,
  recordPromocodeSnapshotsLocal,
  type PromocodeSnapshotRow,
} from "@/lib/promocode-snapshots-local";
import {
  deliveryNotifyTaskKey,
  integrationReachTaskKey,
  integrationReleaseVerifyTaskKey,
  staleCompletedTaskKeys,
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
}

const PANEL_DATA_BC = "casher-panel-data";

/** JSON для panel-data / localStorage — без per-user completedTaskKeys (хранятся в User). */
function panelSnapshotPayload(data: StoredShape): StoredShape {
  return {
    contractors: data.contractors,
    integrations: data.integrations,
    socialOptions: data.socialOptions,
    nicheOptions: data.nicheOptions,
    contractorItems: data.contractorItems,
    contractorLinks: data.contractorLinks,
    deliveries: data.deliveries,
    employees: data.employees,
  };
}

function slugify(raw: string): string {
  const s = raw
    .trim()
    .toLowerCase()
    .replace(/\s+/g, "-")
    .replace(/[^a-z0-9-]/g, "");
  return s || `net-${Date.now()}`;
}

function loadStored(): StoredShape | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    return coercePanelStoredShape(JSON.parse(raw)) as StoredShape | null;
  } catch {
    return null;
  }
}

function saveStored(data: StoredShape) {
  if (typeof window === "undefined") return;
  localStorage.setItem(STORAGE_KEY, JSON.stringify(panelSnapshotPayload(data)));
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
  };
}

function normalizeIncomingPanelData(
  loaded: StoredShape,
  legacyPromo?: PromocodeSnapshotRow[],
): StoredShape {
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
  const result: StoredShape = {
    contractors,
    integrations,
    socialOptions: social,
    nicheOptions,
    contractorItems: loaded.contractorItems,
    contractorLinks: loaded.contractorLinks ?? [],
    deliveries,
    employees,
  };
  if (legacyPromo?.length && typeof window !== "undefined") {
    migratePromocodeSnapshotsFromPanel(legacyPromo);
  }
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
  const legacyPromo = parseLegacyPromocodeSnapshots(loaded);
  return normalizeIncomingPanelData(loaded, legacyPromo);
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
    }) => string | null;
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
  restoreIntegration: (row: Integration, completedTaskKeysToRestore: string[]) => void;
  restoreContractorDeletion: (snapshot: {
    contractor: Contractor;
    integrations: Integration[];
    contractorItems: ContractorItem[];
    contractorLinks: ContractorLink[];
    deliveries: Delivery[];
  }) => void;
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
  addDelivery: (input: AddDeliveryInput) => string | null;
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
  taskKeysError: string | null;
  clearTaskKeysError: () => void;
  saveError: string | null;
  clearSaveError: () => void;
  /** PUT отклонён из‑за более новой ревизии на сервере */
  saveConflictPending: boolean;
  /** Вернуть локальные правки поверх серверного снапшота и сохранить */
  applyLocalSaveConflict: () => void;
  /** Принять серверную версию и отбросить локальные правки из конфликта */
  dismissSaveConflict: () => void;
  /** Немедленно отправить текущий снапшот (сброс debounce) */
  retrySave: () => void;
  /** Ожидает debounce или активный PUT */
  savePending: boolean;
  /** На сервере / в другой вкладке есть более новая версия */
  remoteUpdatePending: boolean;
  applyRemoteUpdate: () => void;
  dismissRemoteUpdate: () => void;
  /** Снапшоты total-активаций промокодов (localStorage, не panel-data) */
  promocodeSnapshots: PromocodeSnapshotRow[];
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
};

/** All authenticated roles receive the full snapshot; see GET /api/panel-data. */
export function PanelDataProvider({ children }: { children: ReactNode }) {
  const { role, currentLogin, isAuthenticated, hydrated } = useAuth();
  const isAdmin = role === "admin" || role === "superadmin";
  const isAdminRef = useRef(isAdmin);
  isAdminRef.current = isAdmin;

  const [data, setData] = useState<StoredShape>(EMPTY_STORED);
  const dataRef = useRef(data);
  dataRef.current = data;

  const completeTaskKeyRef = useRef<(key: string) => void>(() => {});
  const uncompleteTaskKeyRef = useRef<(key: string) => void>(() => {});

  const [userTaskKeys, setUserTaskKeys] = useState<string[]>([]);
  const userTaskKeysRef = useRef<string[]>([]);
  userTaskKeysRef.current = userTaskKeys;

  const [saveError, setSaveError] = useState<string | null>(null);
  const [taskKeysError, setTaskKeysError] = useState<string | null>(null);
  const [savePending, setSavePending] = useState(false);
  const [saveConflictPending, setSaveConflictPending] = useState(false);
  const [promocodeSnapshots, setPromocodeSnapshots] = useState<PromocodeSnapshotRow[]>([]);
  const [remoteUpdatePending, setRemoteUpdatePending] = useState(false);
  const remotePayloadRef = useRef<{ data: unknown; revision: number } | null>(null);
  const conflictLocalRef = useRef<StoredShape | null>(null);
  const saveConflictPendingRef = useRef(false);
  saveConflictPendingRef.current = saveConflictPending;

  const serverRevisionRef = useRef<number | null>(null);
  const pendingSaveRef = useRef(false);
  const flushTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const syncSavePending = useCallback(() => {
    setSavePending(flushTimerRef.current !== null || pendingSaveRef.current);
  }, []);

  const applyServerPayload = useCallback((bodyData: unknown, revision: number) => {
    const legacyPromo = parseLegacyPromocodeSnapshots(bodyData);
    const coerced = (coercePanelStoredShape(bodyData) as StoredShape | null) ?? EMPTY_STORED;
    const normalized = normalizeIncomingPanelData(coerced, legacyPromo);
    setData(normalized);
    saveStored(normalized);
    serverRevisionRef.current = revision;
    if (legacyPromo.length > 0) {
      setPromocodeSnapshots(migratePromocodeSnapshotsFromPanel(legacyPromo));
    }
  }, []);

  const applyRemoteUpdate = useCallback(() => {
    const pending = remotePayloadRef.current;
    if (!pending) return;
    if (flushTimerRef.current) {
      clearTimeout(flushTimerRef.current);
      flushTimerRef.current = null;
    }
    conflictLocalRef.current = null;
    setSaveConflictPending(false);
    setSaveError(null);
    syncSavePending();
    applyServerPayload(pending.data, pending.revision);
    remotePayloadRef.current = null;
    setRemoteUpdatePending(false);
  }, [applyServerPayload, syncSavePending]);

  const dismissRemoteUpdate = useCallback(() => {
    if (saveConflictPendingRef.current) return;
    remotePayloadRef.current = null;
    setRemoteUpdatePending(false);
  }, []);

  const clearSaveConflict = useCallback(() => {
    conflictLocalRef.current = null;
    setSaveConflictPending(false);
  }, []);

  useEffect(() => {
    if (typeof window === "undefined") return;
    setPromocodeSnapshots(loadPromocodeSnapshots());
  }, []);

  useEffect(() => {
    if (typeof BroadcastChannel === "undefined") return;
    const bc = new BroadcastChannel(PANEL_DATA_BC);
    bc.onmessage = () => setRemoteUpdatePending(true);
    return () => bc.close();
  }, []);

  const pruneStaleUserTaskKeysRef = useRef<() => void>(() => {});

  const reloadUserTaskKeys = useCallback(async (): Promise<string[]> => {
    const res = await fetch("/api/tasks/completed", { credentials: "include" });
    if (!res.ok) {
      throw new Error(`task keys reload failed: ${res.status}`);
    }
    const j = (await res.json()) as { keys?: unknown };
    const keys = Array.isArray(j.keys)
      ? j.keys.filter((k): k is string => typeof k === "string")
      : [];
    setUserTaskKeys(keys);
    setTaskKeysError(null);
    queueMicrotask(() => pruneStaleUserTaskKeysRef.current());
    return keys;
  }, []);

  const patchUserTaskKeys = useCallback(
    async (ops: { add?: string[]; remove?: string[] }): Promise<boolean> => {
      const add = (ops.add ?? []).map((k) => k.trim()).filter(Boolean);
      const remove = (ops.remove ?? []).map((k) => k.trim()).filter(Boolean);
      if (add.length === 0 && remove.length === 0) return true;

      const prevKeys = userTaskKeysRef.current;
      const removeSet = new Set(remove);
      let next = prevKeys.filter((k) => !removeSet.has(k));
      for (const k of add) {
        if (!next.includes(k)) next.push(k);
      }
      setUserTaskKeys(next);

      try {
        const res = await fetch("/api/tasks/completed", {
          method: "PATCH",
          credentials: "include",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ add, remove }),
        });
        if (!res.ok) {
          setTaskKeysError("Не удалось сохранить отметку задачи. Попробуйте снова.");
          setUserTaskKeys(prevKeys);
          await reloadUserTaskKeys();
          return false;
        }
        const j = (await res.json()) as { keys?: unknown };
        if (Array.isArray(j.keys)) {
          setUserTaskKeys(j.keys.filter((k): k is string => typeof k === "string"));
        }
        setTaskKeysError(null);
        return true;
      } catch {
        setTaskKeysError("Не удалось сохранить отметку задачи. Проверьте соединение.");
        setUserTaskKeys(prevKeys);
        await reloadUserTaskKeys();
        return false;
      }
    },
    [reloadUserTaskKeys],
  );

  const pruneStaleUserTaskKeys = useCallback(() => {
    const keys = userTaskKeysRef.current;
    if (keys.length === 0) return;
    const { deliveries, integrations } = dataRef.current;
    if (deliveries.length === 0 && integrations.length === 0) return;
    const stale = staleCompletedTaskKeys(keys, deliveries, integrations);
    if (stale.length === 0) return;
    void patchUserTaskKeys({ remove: stale });
  }, [patchUserTaskKeys]);
  pruneStaleUserTaskKeysRef.current = pruneStaleUserTaskKeys;

  const pushSnapshotToServer = useCallback(
    async (snapshot: StoredShape): Promise<boolean> => {
      if (!isAuthenticated) return false;
      pendingSaveRef.current = true;
      syncSavePending();
      const payload = panelSnapshotPayload(snapshot);
      const SAVE_ATTEMPTS = 3;
      const backoffMs = (attempt: number) => 400 * 2 ** attempt;
      try {
        for (let attempt = 0; attempt < SAVE_ATTEMPTS; attempt++) {
          try {
            const base = serverRevisionRef.current ?? 0;
            const res = await fetch("/api/panel-data", {
              method: "PUT",
              credentials: "include",
              headers: {
                "Content-Type": "application/json",
                "X-Panel-Base-Revision": String(base),
              },
              body: JSON.stringify(payload),
            });
            if (res.status === 200) {
              const j = (await res.json()) as { revision?: unknown };
              if (typeof j.revision === "number") {
                serverRevisionRef.current = j.revision;
              }
              setSaveError(null);
              clearSaveConflict();
              if (typeof BroadcastChannel !== "undefined") {
                new BroadcastChannel(PANEL_DATA_BC).postMessage({ saved: true });
              }
              return true;
            }
            if (res.status === 409) {
              const j = (await res.json()) as { revision?: unknown; data?: unknown };
              const r = typeof j.revision === "number" ? j.revision : 0;
              if (flushTimerRef.current) {
                clearTimeout(flushTimerRef.current);
                flushTimerRef.current = null;
              }
              conflictLocalRef.current = dataRef.current;
              setSaveConflictPending(true);
              try {
                await reloadUserTaskKeys();
              } catch (e) {
                console.error("[panel-data] reload task keys after 409", e);
                setTaskKeysError(
                  "Не удалось синхронизировать выполненные задачи после конфликта.",
                );
                setSaveError(
                  "Конфликт сохранения: не удалось синхронизировать задачи. Обновите страницу и повторите.",
                );
                return false;
              }
              applyServerPayload(j.data ?? null, r);
              setSaveError(
                "Конфликт сохранения: на сервере более новая версия. Примите серверные данные или восстановите свои правки.",
              );
              return false;
            }
            if (res.status === 401 || res.status === 403) {
              console.warn("[panel-data] отказ при сохранении (сессия)");
              return false;
            }
            if (res.status >= 500 && attempt < SAVE_ATTEMPTS - 1) {
              await new Promise((r) => setTimeout(r, backoffMs(attempt)));
              continue;
            }
            setSaveError("Не удалось сохранить данные. Проверьте соединение.");
            return false;
          } catch (e) {
            if (attempt < SAVE_ATTEMPTS - 1) {
              await new Promise((r) => setTimeout(r, backoffMs(attempt)));
              continue;
            }
            console.error("[panel-data] сохранение не удалось", e);
            setSaveError("Не удалось сохранить данные. Проверьте соединение.");
            return false;
          }
        }
        return false;
      } finally {
        pendingSaveRef.current = false;
        syncSavePending();
      }
    },
    [applyServerPayload, clearSaveConflict, isAuthenticated, reloadUserTaskKeys, syncSavePending],
  );

  const applyLocalSaveConflict = useCallback(() => {
    const local = conflictLocalRef.current;
    if (!local) return;
    clearSaveConflict();
    setSaveError(null);
    remotePayloadRef.current = null;
    setRemoteUpdatePending(false);
    setData(local);
    saveStored(local);
    if (flushTimerRef.current) {
      clearTimeout(flushTimerRef.current);
      flushTimerRef.current = null;
    }
    syncSavePending();
    void pushSnapshotToServer(local);
  }, [clearSaveConflict, pushSnapshotToServer, syncSavePending]);

  const dismissSaveConflict = useCallback(() => {
    clearSaveConflict();
    setSaveError(null);
  }, [clearSaveConflict]);

  const scheduleServerSave = useCallback(
    (next: StoredShape) => {
      if (!isAuthenticated) return;
      if (flushTimerRef.current) clearTimeout(flushTimerRef.current);
      flushTimerRef.current = setTimeout(() => {
        flushTimerRef.current = null;
        syncSavePending();
        void pushSnapshotToServer(next);
      }, 650);
      syncSavePending();
    },
    [isAuthenticated, pushSnapshotToServer, syncSavePending],
  );

  const retrySave = useCallback(() => {
    if (!isAuthenticated) return;
    if (saveConflictPendingRef.current) return;
    if (flushTimerRef.current) {
      clearTimeout(flushTimerRef.current);
      flushTimerRef.current = null;
    }
    setSaveError(null);
    void pushSnapshotToServer(dataRef.current);
  }, [isAuthenticated, pushSnapshotToServer]);

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
      .then((r) => (r.ok ? r.json() : null))
      .then((j: { keys?: string[] } | null) => {
        if (Array.isArray(j?.keys)) {
          setUserTaskKeys(j.keys.filter((k): k is string => typeof k === "string"));
          queueMicrotask(() => pruneStaleUserTaskKeysRef.current());
        }
      })
      .catch(() => {});
  }, [hydrated, isAuthenticated]);

  useEffect(() => {
    if (!hydrated || !isAuthenticated) return;
    pruneStaleUserTaskKeys();
  }, [hydrated, isAuthenticated, data.deliveries, data.integrations, pruneStaleUserTaskKeys]);

  useEffect(() => {
    const onBeforeUnload = (e: BeforeUnloadEvent) => {
      if (flushTimerRef.current == null && !pendingSaveRef.current) return;
      e.preventDefault();
      e.returnValue = "";
    };
    window.addEventListener("beforeunload", onBeforeUnload);
    return () => window.removeEventListener("beforeunload", onBeforeUnload);
  }, []);

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
          remotePayloadRef.current = { data: body.data, revision };
          setRemoteUpdatePending(true);
          if (flushTimerRef.current != null || pendingSaveRef.current) {
            conflictLocalRef.current = dataRef.current;
            setSaveConflictPending(true);
            setSaveError(
              "На сервере есть более новая версия. Примите серверные данные или сохраните свои правки — редактирование заблокировано.",
            );
          }
        } catch {
          /* ignore */
        }
      })();
    }, 42_000);
    return () => clearInterval(id);
  }, [hydrated, isAuthenticated, applyServerPayload]);

  const patch = useCallback(
    (fn: (prev: StoredShape) => StoredShape) => {
      if (saveConflictPendingRef.current) {
        setSaveError(
          "Сначала разрешите конфликт сохранения: примите серверные данные или восстановите свои правки.",
        );
        return;
      }
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
    }): string | null => {
      const n = input.name.trim();
      if (!n || !isAdminRef.current) return null;
      const rawRating =
        typeof input.rating === "number" ? input.rating : Number(input.rating ?? 0);
      const newId = createPanelId();
      let applied = false;
      patch((prev) => {
        const nid = input.nicheId?.trim();
        const nicheId =
          nid && prev.nicheOptions.some((o) => o.id === nid) ? nid : undefined;
        const sc = input.sizeCategory;
        const sizeCategory =
          sc === "micro" || sc === "middle" || sc === "large" ? sc : undefined;
        applied = true;
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
      return applied ? newId : null;
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
      const prev = dataRef.current;
      const keysToRemove = new Set<string>();
      for (const d of prev.deliveries.filter((row) => row.contractorId === id)) {
        keysToRemove.add(deliveryNotifyTaskKey(d.id));
      }
      for (const i of prev.integrations.filter((row) => row.contractorId === id)) {
        keysToRemove.add(integrationReachTaskKey(i.id));
        keysToRemove.add(integrationReleaseVerifyTaskKey(i.id));
      }
      patch((p) => ({
        ...p,
        contractors: p.contractors.filter((c) => c.id !== id),
        integrations: p.integrations.filter((row) => row.contractorId !== id),
        contractorItems: p.contractorItems.filter((row) => row.contractorId !== id),
        contractorLinks: p.contractorLinks.filter((row) => row.contractorId !== id),
        deliveries: p.deliveries.filter((row) => row.contractorId !== id),
      }));
      if (keysToRemove.size > 0) {
        const toRemove = userTaskKeysRef.current.filter((k) => keysToRemove.has(k));
        if (toRemove.length > 0) {
          void patchUserTaskKeys({ remove: toRemove });
        }
      }
    },
    [isAdmin, patch, patchUserTaskKeys],
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
      if (!isAdminRef.current) return;
      const autoCompleteKeys: string[] = [];
      const autoUncompleteKeys: string[] = [];
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

        if (typeof next.reach === "number" && !Number.isNaN(next.reach) && next.reach > 0) {
          autoCompleteKeys.push(integrationReachTaskKey(id));
        } else if ("reach" in updates) {
          autoUncompleteKeys.push(integrationReachTaskKey(id));
        }
        if (next.status === "returned" || next.status === "exchange") {
          autoCompleteKeys.push(integrationReleaseVerifyTaskKey(id));
        } else if (
          updates.status !== undefined &&
          (row.status === "returned" || row.status === "exchange")
        ) {
          autoUncompleteKeys.push(integrationReleaseVerifyTaskKey(id));
        }

        return {
          ...prev,
          integrations: prev.integrations.map((r) =>
            r.id === id ? next : r,
          ),
        };
      });
      for (const key of autoCompleteKeys) {
        completeTaskKeyRef.current(key);
      }
      for (const key of autoUncompleteKeys) {
        uncompleteTaskKeyRef.current(key);
      }
    },
    [isAdmin, patch],
  );

  const removeIntegration = useCallback(
    (id: string) => {
      if (!isAdminRef.current) return;
      const rk = integrationReachTaskKey(id);
      const vk = integrationReleaseVerifyTaskKey(id);
      const drop = new Set([rk, vk]);
      patch((prev) => ({
        ...prev,
        integrations: prev.integrations.filter((r) => r.id !== id),
      }));
      const toRemove = userTaskKeysRef.current.filter((k) => drop.has(k));
      if (toRemove.length > 0) {
        void patchUserTaskKeys({ remove: toRemove });
      }
    },
    [isAdmin, patch, patchUserTaskKeys],
  );

  const restoreIntegration = useCallback(
    (row: Integration, completedTaskKeysToRestore: string[]) => {
      if (!isAdminRef.current) return;
      patch((prev) => {
        if (prev.integrations.some((r) => r.id === row.id)) return prev;
        return {
          ...prev,
          integrations: [...prev.integrations, row],
        };
      });
      const extraKeys = completedTaskKeysToRestore.filter(
        (k) => !userTaskKeysRef.current.includes(k),
      );
      if (extraKeys.length > 0) {
        void patchUserTaskKeys({ add: extraKeys });
      }
    },
    [isAdmin, patch, patchUserTaskKeys],
  );

  const restoreContractorDeletion = useCallback(
    (snapshot: {
      contractor: Contractor;
      integrations: Integration[];
      contractorItems: ContractorItem[];
      contractorLinks: ContractorLink[];
      deliveries: Delivery[];
    }) => {
      if (!isAdminRef.current) return;
      patch((prev) => {
        if (prev.contractors.some((c) => c.id === snapshot.contractor.id)) return prev;
        const existingIntegrationIds = new Set(prev.integrations.map((r) => r.id));
        const existingItemIds = new Set(prev.contractorItems.map((r) => r.id));
        const existingLinkIds = new Set(prev.contractorLinks.map((r) => r.id));
        const existingDeliveryIds = new Set(prev.deliveries.map((r) => r.id));
        return {
          ...prev,
          contractors: [...prev.contractors, snapshot.contractor],
          integrations: [
            ...prev.integrations,
            ...snapshot.integrations.filter((r) => !existingIntegrationIds.has(r.id)),
          ],
          contractorItems: [
            ...prev.contractorItems,
            ...snapshot.contractorItems.filter((r) => !existingItemIds.has(r.id)),
          ],
          contractorLinks: [
            ...prev.contractorLinks,
            ...snapshot.contractorLinks.filter((r) => !existingLinkIds.has(r.id)),
          ],
          deliveries: [
            ...prev.deliveries,
            ...snapshot.deliveries.filter((r) => !existingDeliveryIds.has(r.id)),
          ],
        };
      });
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
      if (!isAdminRef.current) return null;
      const contractorId = input.contractorId.trim();
      const orderNumber = input.orderNumber?.trim() ?? "";
      const trackNumber = input.trackNumber.trim();
      if (!contractorId || !trackNumber) return null;
      const items = input.items
        .map((item) => ({
          id: createPanelId(),
          productId: item.productId.trim(),
          productName: item.productName.trim(),
          size: item.size.trim(),
          imageUrl: item.imageUrl?.trim() ?? "",
        }))
        .filter((item) => item.productId && item.productName && item.size);
      const newId = createPanelId();
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
              id: newId,
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
      return newId;
    },
    [isAdmin, patch],
  );

  const updateDeliveryStatus = useCallback(
    (id: string, status: DeliveryStatus) => {
      if (!isAdminRef.current) return;
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
      }));
      if (userTaskKeysRef.current.includes(dk)) {
        void patchUserTaskKeys({ remove: [dk] });
      }
    },
    [isAdmin, patch, patchUserTaskKeys],
  );

  const completeTaskKey = useCallback((key: string) => {
    const k = key.trim();
    if (!k) return;
    const prevKeys = userTaskKeysRef.current;
    if (prevKeys.includes(k)) return;
    setUserTaskKeys([...prevKeys, k]);
    void fetch("/api/tasks/completed", {
      method: "PATCH",
      credentials: "include",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ add: [k] }),
    })
      .then(async (res) => {
        if (!res.ok) {
          setUserTaskKeys(prevKeys);
          setTaskKeysError("Не удалось отметить задачу выполненной.");
          return;
        }
        const j = (await res.json()) as { keys?: unknown };
        if (Array.isArray(j.keys)) {
          setUserTaskKeys(j.keys.filter((x): x is string => typeof x === "string"));
        }
        setTaskKeysError(null);
      })
      .catch(() => {
        setUserTaskKeys(prevKeys);
        setTaskKeysError("Не удалось отметить задачу выполненной. Проверьте соединение.");
      });
  }, []);

  const uncompleteTaskKey = useCallback((key: string) => {
    const k = key.trim();
    if (!k) return;
    const prevKeys = userTaskKeysRef.current;
    if (!prevKeys.includes(k)) return;
    setUserTaskKeys(prevKeys.filter((x) => x !== k));
    void fetch("/api/tasks/completed", {
      method: "PATCH",
      credentials: "include",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ remove: [k] }),
    })
      .then(async (res) => {
        if (!res.ok) {
          setUserTaskKeys(prevKeys);
          setTaskKeysError("Не удалось снять отметку задачи.");
          return;
        }
        const j = (await res.json()) as { keys?: unknown };
        if (Array.isArray(j.keys)) {
          setUserTaskKeys(j.keys.filter((x): x is string => typeof x === "string"));
        }
        setTaskKeysError(null);
      })
      .catch(() => {
        setUserTaskKeys(prevKeys);
        setTaskKeysError("Не удалось снять отметку задачи. Проверьте соединение.");
      });
  }, []);

  completeTaskKeyRef.current = completeTaskKey;
  uncompleteTaskKeyRef.current = uncompleteTaskKey;

  const clearSaveError = useCallback(() => setSaveError(null), []);
  const clearTaskKeysError = useCallback(() => setTaskKeysError(null), []);

  const recordPromocodeSnapshot = useCallback(
    (items: Array<{ codeKey: string; activations: number }>, fetchedAt: number) => {
      const next = recordPromocodeSnapshotsLocal(items, fetchedAt);
      setPromocodeSnapshots(next);
    },
    [],
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
      restoreIntegration,
      restoreContractorDeletion,
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
      completedTaskKeys: userTaskKeys,
      completeTaskKey,
      taskKeysError,
      clearTaskKeysError,
      saveError,
      clearSaveError,
      saveConflictPending,
      applyLocalSaveConflict,
      dismissSaveConflict,
      retrySave,
      savePending,
      remoteUpdatePending,
      applyRemoteUpdate,
      dismissRemoteUpdate,
      promocodeSnapshots,
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
      promocodeSnapshots,
      remoteUpdatePending,
      applyRemoteUpdate,
      dismissRemoteUpdate,
      userTaskKeys,
      taskKeysError,
      clearTaskKeysError,
      saveError,
      clearSaveError,
      saveConflictPending,
      applyLocalSaveConflict,
      dismissSaveConflict,
      retrySave,
      savePending,
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
      restoreIntegration,
      restoreContractorDeletion,
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
