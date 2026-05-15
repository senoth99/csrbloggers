"use client";

import type { ReactNode } from "react";
import { AppSidebar } from "@/components/AppSidebar";
import { Header } from "@/components/Header";
import { MobileBottomNav } from "@/components/MobileBottomNav";
import { usePanelData } from "@/context/PanelDataContext";

export function AppShell({ children }: { children: ReactNode }) {
  const {
    saveError,
    clearSaveError,
    saveConflictPending,
    applyLocalSaveConflict,
    dismissSaveConflict,
    retrySave,
    taskKeysError,
    clearTaskKeysError,
    remoteUpdatePending,
    applyRemoteUpdate,
    dismissRemoteUpdate,
  } = usePanelData();
  return (
    <div className="flex h-dvh max-h-dvh flex-col overflow-hidden bg-app-bg">
      <Header />
      {taskKeysError && (
        <div className="flex shrink-0 items-center gap-3 bg-amber-950/60 px-4 py-2 text-xs text-amber-200">
          <span className="flex-1">{taskKeysError}</span>
          <button
            type="button"
            onClick={clearTaskKeysError}
            className="shrink-0 opacity-60 hover:opacity-100"
            aria-label="Закрыть"
          >
            ✕
          </button>
        </div>
      )}
      {saveConflictPending && (
        <div className="flex shrink-0 flex-wrap items-center gap-2 bg-amber-950/70 px-4 py-2 text-xs text-amber-100">
          <span className="min-w-0 flex-1">
            {saveError ??
              "Конфликт версий данных. Примите серверные данные или сохраните свои правки."}
          </span>
          {remoteUpdatePending ? (
            <button
              type="button"
              onClick={applyRemoteUpdate}
              className="shrink-0 border border-amber-400/40 px-2 py-0.5 transition hover:border-amber-300/60"
            >
              Принять серверные
            </button>
          ) : (
            <button
              type="button"
              onClick={dismissSaveConflict}
              className="shrink-0 border border-amber-400/40 px-2 py-0.5 transition hover:border-amber-300/60"
            >
              Принять серверные
            </button>
          )}
          <button
            type="button"
            onClick={applyLocalSaveConflict}
            className="shrink-0 border border-amber-400/40 px-2 py-0.5 transition hover:border-amber-300/60"
          >
            Сохранить мои правки
          </button>
        </div>
      )}
      {remoteUpdatePending && !saveConflictPending && (
        <div className="flex shrink-0 items-center gap-3 bg-sky-950/60 px-4 py-2 text-xs text-sky-200">
          <span className="flex-1">
            На сервере или в другой вкладке есть более новая версия данных.
          </span>
          <button
            type="button"
            onClick={applyRemoteUpdate}
            className="shrink-0 border border-sky-400/40 px-2 py-0.5 text-sky-100 transition hover:border-sky-300/60"
          >
            Обновить
          </button>
          <button
            type="button"
            onClick={dismissRemoteUpdate}
            className="shrink-0 opacity-60 hover:opacity-100"
            aria-label="Закрыть"
          >
            ✕
          </button>
        </div>
      )}
      {saveError && !saveConflictPending && (
        <div className="flex shrink-0 items-center gap-3 bg-red-950/60 px-4 py-2 text-xs text-red-300">
          <span className="flex-1">{saveError}</span>
          <button
            type="button"
            onClick={retrySave}
            className="shrink-0 border border-red-400/40 px-2 py-0.5 text-red-200 transition hover:border-red-300/60 hover:text-red-100"
          >
            Повторить
          </button>
          <button
            type="button"
            onClick={clearSaveError}
            className="shrink-0 opacity-60 hover:opacity-100"
            aria-label="Закрыть"
          >
            ✕
          </button>
        </div>
      )}
      <div className="flex min-h-0 flex-1 overflow-hidden">
        <AppSidebar className="hidden md:flex" />
        <main
          id="app-main-content"
          className="app-main-surface min-h-0 min-w-0 flex-1 overflow-y-auto px-3 pb-[calc(3.5rem+env(safe-area-inset-bottom,0px))] pt-3 sm:px-4 sm:pt-4 md:px-6 md:pb-6 md:pt-6"
        >
          {children}
        </main>
      </div>
      <MobileBottomNav />
    </div>
  );
}

