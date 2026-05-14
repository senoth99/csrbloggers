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
import { normalizeUsername, SUPERADMIN_LOGIN } from "@/lib/panel-auth-utils";
import type { PanelUserPublic } from "@/types/panel-auth-api";

export type UserRole = "superadmin" | "admin" | "user";

/** Логин панели */
export interface PanelUser {
  login: string;
  role: UserRole;
  displayName?: string;
  /** только при локальной отладке; с сервера не отдаётся */
  passwordHash?: string;
  employeeId?: string;
}

export { SUPERADMIN_LOGIN, normalizeUsername } from "@/lib/panel-auth-utils";

/** @deprecated используйте SUPERADMIN_LOGIN */
export const SUPERADMIN_USERNAME = SUPERADMIN_LOGIN;

function publicToPanelUser(p: PanelUserPublic): PanelUser {
  return {
    login: p.login,
    role: p.role,
    ...(p.displayName ? { displayName: p.displayName } : {}),
    ...(p.employeeId ? { employeeId: p.employeeId } : {}),
  };
}

interface AuthContextValue {
  currentLogin: string | null;
  /** @deprecated оставлено для совместимости; всегда null при входе через API */
  sessionPasswordHash: string | null;
  currentUsername: string | null;
  role: UserRole;
  users: PanelUser[];
  hydrated: boolean;
  isAuthenticated: boolean;
  isTelegramStub: boolean;
  /** База недоступна или не настроена (503 от /api/auth/me) */
  authBackendError: string | null;
  login: (login: string, password: string) => Promise<boolean>;
  logout: () => Promise<void>;
  refreshUsers: () => Promise<void>;
  createPanelAccount: (input: {
    login: string;
    password: string;
    role: Exclude<UserRole, "superadmin">;
    employeeId?: string;
  }) => Promise<boolean>;
  removeUserAccess: (login: string) => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [hydrated, setHydrated] = useState(false);
  const [currentLogin, setCurrentLogin] = useState<string | null>(null);
  const [users, setUsers] = useState<PanelUser[]>([]);
  const [authBackendError, setAuthBackendError] = useState<string | null>(null);

  const refreshUsers = useCallback(async () => {
    try {
      const res = await fetch("/api/auth/me", { credentials: "include" });
      if (res.status === 503) {
        const j = (await res.json().catch(() => ({}))) as { error?: string };
        setAuthBackendError(j.error ?? "База данных не настроена.");
        setUsers([]);
        setCurrentLogin(null);
        return;
      }
      setAuthBackendError(null);
      if (!res.ok) {
        setUsers([]);
        setCurrentLogin(null);
        return;
      }
      const data = (await res.json()) as
        | { authenticated: false }
        | { authenticated: true; me: PanelUserPublic; users: PanelUserPublic[] };
      if (!data.authenticated) {
        setUsers([]);
        setCurrentLogin(null);
        return;
      }
      setUsers(data.users.map(publicToPanelUser));
      setCurrentLogin(normalizeUsername(data.me.login));
    } catch (e) {
      console.error("[auth] refresh failed", e);
      setAuthBackendError("Не удалось связаться с сервером.");
      setUsers([]);
      setCurrentLogin(null);
    }
  }, []);

  useLayoutEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        await refreshUsers();
      } finally {
        if (!cancelled) setHydrated(true);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [refreshUsers]);

  const effectiveRole = useMemo((): UserRole => {
    if (!currentLogin) return "user";
    const u = users.find((x) => normalizeUsername(x.login) === normalizeUsername(currentLogin));
    if (!u) return "user";
    if (normalizeUsername(u.login) === SUPERADMIN_LOGIN && u.role === "superadmin")
      return "superadmin";
    if (u.role === "admin") return "admin";
    return "user";
  }, [currentLogin, users]);

  const isAuthenticated = Boolean(
    currentLogin &&
      users.some((u) => normalizeUsername(u.login) === normalizeUsername(currentLogin)),
  );

  const login = useCallback(async (rawLogin: string, password: string): Promise<boolean> => {
    const loginNorm = normalizeUsername(rawLogin);
    if (!loginNorm || !password) return false;
    const res = await fetch("/api/auth/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      credentials: "include",
      body: JSON.stringify({ login: loginNorm, password }),
    });
    if (!res.ok) return false;
    await refreshUsers();
    return true;
  }, [refreshUsers]);

  const logout = useCallback(async () => {
    try {
      await fetch("/api/auth/logout", { method: "POST", credentials: "include" });
    } catch {
      /* ignore */
    }
    setCurrentLogin(null);
    setUsers([]);
  }, []);

  const createPanelAccount = useCallback(
    async (input: {
      login: string;
      password: string;
      role: Exclude<UserRole, "superadmin">;
      employeeId?: string;
    }): Promise<boolean> => {
      const actor = normalizeUsername(currentLogin ?? "");
      if (actor !== SUPERADMIN_LOGIN) return false;
      const self = users.find((x) => normalizeUsername(x.login) === actor);
      if (!self || self.role !== "superadmin") return false;

      const loginNorm = normalizeUsername(input.login);
      if (!loginNorm || loginNorm === SUPERADMIN_LOGIN || !input.password.trim()) return false;
      if (users.some((x) => normalizeUsername(x.login) === loginNorm)) return false;

      const res = await fetch("/api/auth/users", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({
          login: loginNorm,
          password: input.password,
          role: input.role === "admin" ? "admin" : "user",
          employeeId: input.employeeId?.trim(),
        }),
      });
      if (!res.ok) return false;
      await refreshUsers();
      return true;
    },
    [currentLogin, users, refreshUsers],
  );

  const removeUserAccess = useCallback(
    async (login: string) => {
      const n = normalizeUsername(login);
      if (!n || n === SUPERADMIN_LOGIN) return;
      const res = await fetch(`/api/auth/users?login=${encodeURIComponent(n)}`, {
        method: "DELETE",
        credentials: "include",
      });
      if (!res.ok) return;
      await refreshUsers();
    },
    [refreshUsers],
  );

  const value: AuthContextValue = {
    currentLogin,
    sessionPasswordHash: null,
    currentUsername: currentLogin,
    role: isAuthenticated ? effectiveRole : "user",
    users,
    hydrated,
    isAuthenticated,
    isTelegramStub: false,
    authBackendError,
    login,
    logout,
    refreshUsers,
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
