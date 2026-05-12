"use client";

import {
  createContext,
  useCallback,
  useContext,
  useLayoutEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import { hashLoginPassword } from "@/lib/auth-password";

export type UserRole = "superadmin" | "admin" | "user";

/** Логин панели (раньше в данных мог быть telegramUsername) */
export interface PanelUser {
  login: string;
  role: UserRole;
  displayName?: string;
  /** SHA-256 от пароля (см. lib/auth-password) */
  passwordHash?: string;
  employeeId?: string;
}

const SESSION_KEY = "casher-bloggers-session-v1";
const USERS_KEY = "casher-bloggers-users-v2";
const USERS_KEY_LEGACY = "casher-bloggers-users-v1";

/** Суперадмин по умолчанию: логин senoth, пароль admin (смените после первого входа в проде). */
export const SUPERADMIN_LOGIN = "senoth";
/** Старый захардкоженный SHA-256 для senoth+admin только при PEPPER по умолчанию (миграция при смене NEXT_PUBLIC_AUTH_PEPPER). */
const SENOTH_LEGACY_BAKED_PASSWORD_HASH =
  "34fc13a4f3732fb6512688a43c79e0b823f146b95c52a27f47fc477376411fed";

const DEFAULT_SUPERADMIN_PASSWORD = "admin";

/** @deprecated используйте SUPERADMIN_LOGIN */
export const SUPERADMIN_USERNAME = SUPERADMIN_LOGIN;

export function normalizeUsername(raw: string): string {
  return raw.trim().replace(/^@+/, "").toLowerCase();
}

type SessionPayload = { login: string; passwordHash: string };

function parseSession(raw: string | null): SessionPayload | null {
  if (!raw?.trim()) return null;
  try {
    const j = JSON.parse(raw) as unknown;
    if (!j || typeof j !== "object") return null;
    const login = typeof (j as SessionPayload).login === "string" ? (j as SessionPayload).login : "";
    const passwordHash =
      typeof (j as SessionPayload).passwordHash === "string"
        ? (j as SessionPayload).passwordHash
        : "";
    const l = normalizeUsername(login);
    if (!l || !passwordHash) return null;
    return { login: l, passwordHash };
  } catch {
    return null;
  }
}

function loadUsersRaw(): unknown[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = localStorage.getItem(USERS_KEY) ?? localStorage.getItem(USERS_KEY_LEGACY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as unknown;
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function migrateRow(raw: unknown): PanelUser | null {
  if (!raw || typeof raw !== "object") return null;
  const o = raw as Record<string, unknown>;
  const loginRaw =
    (typeof o.login === "string" && o.login.trim()) ||
    (typeof o.telegramUsername === "string" && o.telegramUsername.trim()) ||
    "";
  const login = normalizeUsername(loginRaw);
  if (!login) return null;
  const role =
    o.role === "superadmin" || o.role === "admin" || o.role === "user" ? o.role : "user";
  const passwordHash = typeof o.passwordHash === "string" ? o.passwordHash : undefined;
  const employeeId = typeof o.employeeId === "string" ? o.employeeId : undefined;
  const displayName = typeof o.displayName === "string" ? o.displayName : undefined;
  return { login, role, passwordHash, employeeId, displayName };
}

function saveUsers(users: PanelUser[]) {
  if (typeof window === "undefined") return;
  localStorage.setItem(USERS_KEY, JSON.stringify(users));
}

async function ensureSuperadmin(users: PanelUser[]): Promise<PanelUser[]> {
  const existing = users.find(
    (u) => normalizeUsername(u.login) === SUPERADMIN_LOGIN && u.role === "superadmin",
  );
  const withoutSenoth = users.filter((u) => normalizeUsername(u.login) !== SUPERADMIN_LOGIN);
  const freshDefaultHash = await hashLoginPassword(
    SUPERADMIN_LOGIN,
    DEFAULT_SUPERADMIN_PASSWORD,
  );
  let passwordHash: string;
  if (!existing?.passwordHash) {
    passwordHash = freshDefaultHash;
  } else if (existing.passwordHash === SENOTH_LEGACY_BAKED_PASSWORD_HASH) {
    // Раньше в localStorage писался хеш только под дефолтный PEPPER — пересчитать под текущий.
    passwordHash = freshDefaultHash;
  } else {
    passwordHash = existing.passwordHash;
  }
  const senoth: PanelUser = {
    login: SUPERADMIN_LOGIN,
    role: "superadmin",
    displayName: "Суперадмин",
    passwordHash,
  };
  const rest = withoutSenoth.filter((u) => u.role !== "superadmin");
  return [senoth, ...rest];
}

async function buildInitialUsers(): Promise<PanelUser[]> {
  const rows = loadUsersRaw()
    .map(migrateRow)
    .filter(Boolean) as PanelUser[];
  // Убрать дубликаты по login
  const byLogin = new Map<string, PanelUser>();
  for (const u of rows) {
    byLogin.set(normalizeUsername(u.login), u);
  }
  let list = Array.from(byLogin.values());
  // Удалить устаревший суперадмин-логин из старых данных
  list = list.filter((u) => normalizeUsername(u.login) !== "contact_voropaev");
  const next = await ensureSuperadmin(list);
  saveUsers(next);
  try {
    if (typeof window !== "undefined" && localStorage.getItem(USERS_KEY))
      localStorage.removeItem(USERS_KEY_LEGACY);
  } catch {
    /* ignore */
  }
  return next;
}

interface AuthState {
  currentLogin: string | null;
  sessionPasswordHash: string | null;
  role: UserRole;
  users: PanelUser[];
}

interface AuthContextValue extends AuthState {
  hydrated: boolean;
  isAuthenticated: boolean;
  /** @deprecated */
  currentUsername: string | null;
  isTelegramStub: boolean;
  login: (login: string, password: string) => Promise<boolean>;
  logout: () => void;
  /** Только суперадмин SENOTH: создать аккаунт (логин + пароль + роль) */
  createPanelAccount: (input: {
    login: string;
    password: string;
    role: Exclude<UserRole, "superadmin">;
    employeeId?: string;
  }) => Promise<boolean>;
  removeUserAccess: (login: string) => void;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [hydrated, setHydrated] = useState(false);
  const [currentLogin, setCurrentLogin] = useState<string | null>(null);
  const [sessionPasswordHash, setSessionPasswordHash] = useState<string | null>(null);
  const [users, setUsers] = useState<PanelUser[]>([]);

  useLayoutEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const initialUsers = await buildInitialUsers();
        if (cancelled) return;
        setUsers(initialUsers);
        const sess = parseSession(localStorage.getItem(SESSION_KEY));
        if (sess) {
          const u = initialUsers.find((x) => normalizeUsername(x.login) === sess.login);
          if (u?.passwordHash && u.passwordHash === sess.passwordHash) {
            setCurrentLogin(sess.login);
            setSessionPasswordHash(sess.passwordHash);
          } else {
            localStorage.removeItem(SESSION_KEY);
          }
        }
      } catch (e) {
        console.error("[auth] init failed", e);
      } finally {
        if (!cancelled) setHydrated(true);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const sessionValid = useMemo(() => {
    if (!currentLogin || !sessionPasswordHash) return false;
    const u = users.find(
      (x) => normalizeUsername(x.login) === normalizeUsername(currentLogin),
    );
    return Boolean(u?.passwordHash && u.passwordHash === sessionPasswordHash);
  }, [currentLogin, sessionPasswordHash, users]);

  const effectiveRole = useMemo((): UserRole => {
    if (!sessionValid || !currentLogin) return "user";
    const u = users.find(
      (x) => normalizeUsername(x.login) === normalizeUsername(currentLogin),
    );
    if (!u) return "user";
    if (normalizeUsername(u.login) === SUPERADMIN_LOGIN && u.role === "superadmin")
      return "superadmin";
    if (u.role === "admin") return "admin";
    return "user";
  }, [sessionValid, currentLogin, users]);

  const isAuthenticated = sessionValid;

  const login = useCallback(async (rawLogin: string, password: string): Promise<boolean> => {
    const loginNorm = normalizeUsername(rawLogin);
    if (!loginNorm || !password) return false;
    const h = await hashLoginPassword(loginNorm, password);
    const u = users.find((x) => normalizeUsername(x.login) === loginNorm);
    if (!u?.passwordHash || u.passwordHash !== h) return false;
    const payload: SessionPayload = { login: loginNorm, passwordHash: h };
    localStorage.setItem(SESSION_KEY, JSON.stringify(payload));
    setCurrentLogin(loginNorm);
    setSessionPasswordHash(h);
    return true;
  }, [users]);

  const logout = useCallback(() => {
    if (typeof window === "undefined") return;
    localStorage.removeItem(SESSION_KEY);
    setCurrentLogin(null);
    setSessionPasswordHash(null);
  }, []);

  const createPanelAccount = useCallback(
    async (input: {
      login: string;
      password: string;
      role: Exclude<UserRole, "superadmin">;
      employeeId?: string;
    }): Promise<boolean> => {
      const actor = normalizeUsername(currentLogin ?? "");
      if (actor !== SUPERADMIN_LOGIN || sessionPasswordHash == null) return false;
      const self = users.find((x) => normalizeUsername(x.login) === actor);
      if (!self || self.role !== "superadmin" || self.passwordHash !== sessionPasswordHash)
        return false;

      const loginNorm = normalizeUsername(input.login);
      if (!loginNorm || loginNorm === SUPERADMIN_LOGIN || !input.password.trim()) return false;
      if (users.some((x) => normalizeUsername(x.login) === loginNorm)) return false;

      const h = await hashLoginPassword(loginNorm, input.password);
      setUsers((prev) => {
        if (prev.some((x) => normalizeUsername(x.login) === loginNorm)) return prev;
        const row: PanelUser = {
          login: loginNorm,
          role: input.role === "admin" ? "admin" : "user",
          passwordHash: h,
          ...(input.employeeId?.trim() ? { employeeId: input.employeeId.trim() } : {}),
        };
        const next = [...prev, row].sort((a, b) =>
          normalizeUsername(a.login).localeCompare(normalizeUsername(b.login)),
        );
        saveUsers(next);
        return next;
      });
      return true;
    },
    [currentLogin, sessionPasswordHash, users],
  );

  const removeUserAccess = useCallback((login: string) => {
    const n = normalizeUsername(login);
    if (!n || n === SUPERADMIN_LOGIN) return;
    setUsers((prev) => {
      const next = prev.filter((x) => normalizeUsername(x.login) !== n);
      saveUsers(next);
      return next;
    });
  }, []);

  const value: AuthContextValue = {
    currentLogin,
    sessionPasswordHash,
    currentUsername: currentLogin,
    role: isAuthenticated ? effectiveRole : "user",
    users,
    hydrated,
    isAuthenticated,
    isTelegramStub: false,
    login,
    logout,
    createPanelAccount,
    removeUserAccess,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
}
