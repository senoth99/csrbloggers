"use client";

import { useState, useEffect, Suspense, type ReactNode } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { useAuth } from "@/context/AuthContext";
import { CasherLogoSpin } from "@/components/CasherLogoSpin";

const SAFE_INTERNAL_PATH = /^\/[a-zA-Z0-9_./?=&%-]*$/;

function safeRedirectPath(raw: string | null | undefined): string {
  const fallback = "/dashboard";
  if (!raw) return fallback;
  if (raw.startsWith("//")) return fallback;
  if (!SAFE_INTERNAL_PATH.test(raw)) return fallback;
  return raw;
}

function LoginForm() {
  const { login, hydrated, isAuthenticated, authBackendError } = useAuth();
  const router = useRouter();
  const searchParams = useSearchParams();
  const [loginField, setLoginField] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [loginError, setLoginError] = useState<string | null>(null);

  const nextPath = searchParams?.get("next") || "/dashboard";

  useEffect(() => {
    if (!hydrated) return;
    if (isAuthenticated) {
      router.replace(safeRedirectPath(nextPath));
    }
  }, [hydrated, isAuthenticated, nextPath, router]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const l = loginField.trim().replace(/^@+/, "").toLowerCase();
    if (!l || !password) return;
    setBusy(true);
    setLoginError(null);
    try {
      const ok = await login(l, password);
      if (ok) router.replace(safeRedirectPath(nextPath));
      else setLoginError("Неверный логин или пароль.");
    } finally {
      setBusy(false);
    }
  }

  const shell = (inner: ReactNode) => (
    <div className="login-root relative flex min-h-screen flex-col items-center justify-center overflow-hidden bg-[#020202] px-4 py-12">
      <div
        className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_85%_55%_at_50%_42%,rgba(34,197,94,0.14),transparent_58%)]"
        aria-hidden
      />
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_50%_50%,rgba(16,185,129,0.06),transparent_45%)]" aria-hidden />
      {inner}
    </div>
  );

  if (!hydrated) {
    return shell(
      <p className="relative text-sm text-white/45">Загрузка…</p>,
    );
  }

  if (isAuthenticated) {
    return shell(
      <p className="relative text-sm text-white/45">Загрузка…</p>,
    );
  }

  return shell(
    <div className="login-modal relative w-full max-w-[400px] border border-white/[0.08] bg-[#111111] px-8 py-10 text-center shadow-[0_0_72px_-24px_rgba(34,197,94,0.18)] sm:px-10 sm:py-12">
      <CasherLogoSpin className="mb-7" />

      <h1 className="text-2xl font-bold tracking-tight text-white sm:text-[1.65rem]">Привет)</h1>

      {authBackendError ? (
        <p className="mt-4 rounded border border-amber-500/30 bg-amber-500/10 px-3 py-2 text-left text-xs leading-relaxed text-amber-100/90">
          {authBackendError} Создайте в корне проекта файл <code className="text-white/80">.env</code> (или{" "}
          <code className="text-white/80">.env.local</code> для Next) с{" "}
          <code className="text-white/80">DATABASE_URL</code> и <code className="text-white/80">SESSION_SECRET</code>.
          Команды Prisma читают только <code className="text-white/80">.env</code>:{" "}
          <code className="text-white/80">npx prisma db push</code> и <code className="text-white/80">npm run db:seed</code>
          , затем перезапустите приложение.
        </p>
      ) : null}

      {loginError ? (
        <p className="mt-4 text-center text-sm text-red-400/90">{loginError}</p>
      ) : null}

      {busy ? (
        <div className="mt-5 flex justify-center gap-1.5" aria-hidden>
          <span className="login-busy-dot h-1.5 w-1.5 animate-pulse bg-emerald-400 [animation-delay:0ms]" />
          <span className="login-busy-dot h-1.5 w-1.5 animate-pulse bg-emerald-400 [animation-delay:150ms]" />
          <span className="login-busy-dot h-1.5 w-1.5 animate-pulse bg-emerald-400 [animation-delay:300ms]" />
        </div>
      ) : null}

      <form onSubmit={handleSubmit} className="mt-8 space-y-4 text-left">
        <label className="block text-[10px] font-semibold uppercase tracking-[0.2em] text-white/40">
          Логин
          <input
            value={loginField}
            onChange={(e) => setLoginField(e.target.value)}
            autoComplete="username"
            className="login-field mt-2.5 w-full border border-white/[0.08] bg-[#0a0a0a] px-4 py-3.5 text-sm text-white/95 outline-none transition placeholder:text-white/25 focus:border-emerald-500/40 focus:ring-1 focus:ring-emerald-500/30"
            placeholder=""
          />
        </label>
        <label className="block text-[10px] font-semibold uppercase tracking-[0.2em] text-white/40">
          Пароль
          <input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            autoComplete="current-password"
            className="login-field mt-2.5 w-full border border-white/[0.08] bg-[#0a0a0a] px-4 py-3.5 text-sm text-white/95 outline-none transition focus:border-emerald-500/40 focus:ring-1 focus:ring-emerald-500/30"
          />
        </label>
        <button
          type="submit"
          disabled={busy}
          className="login-submit mt-6 w-full bg-emerald-600 py-3.5 text-xs font-semibold uppercase tracking-[0.2em] text-white shadow-[0_0_24px_-4px_rgba(34,197,94,0.35)] transition hover:bg-emerald-500 disabled:opacity-60"
        >
          ВОЙТИ
        </button>
      </form>
    </div>,
  );
}

export function LoginScreen() {
  return (
    <Suspense
      fallback={
        <div className="login-root relative flex min-h-screen items-center justify-center overflow-hidden bg-[#020202]">
          <div
            className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_85%_55%_at_50%_42%,rgba(34,197,94,0.14),transparent_58%)]"
            aria-hidden
          />
          <p className="relative text-sm text-white/45">Загрузка…</p>
        </div>
      }
    >
      <LoginForm />
    </Suspense>
  );
}
