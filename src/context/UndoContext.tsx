"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { UndoBanner } from "@/components/ui";

type UndoContextValue = {
  showUndo: (message: string, onUndo: () => void) => void;
};

const UndoContext = createContext<UndoContextValue | null>(null);

const UNDO_AUTO_DISMISS_MS = 8000;

export function UndoProvider({ children }: { children: ReactNode }) {
  const onUndoRef = useRef<(() => void) | null>(null);
  const dismissTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const isBannerVisibleRef = useRef(false);
  const [banner, setBanner] = useState<{ message: string; visible: boolean } | null>(
    null,
  );

  const clearDismissTimer = useCallback(() => {
    if (dismissTimerRef.current !== null) {
      clearTimeout(dismissTimerRef.current);
      dismissTimerRef.current = null;
    }
  }, []);

  const dismiss = useCallback(() => {
    clearDismissTimer();
    isBannerVisibleRef.current = false;
    setBanner(null);
    onUndoRef.current = null;
  }, [clearDismissTimer]);

  const showUndo = useCallback(
    (message: string, onUndo: () => void) => {
      clearDismissTimer();
      onUndoRef.current = onUndo;
      isBannerVisibleRef.current = true;
      setBanner({ message, visible: true });
      dismissTimerRef.current = setTimeout(() => {
        dismissTimerRef.current = null;
        dismiss();
      }, UNDO_AUTO_DISMISS_MS);
    },
    [clearDismissTimer, dismiss],
  );

  useEffect(() => () => clearDismissTimer(), [clearDismissTimer]);

  const handleUndo = useCallback(() => {
    onUndoRef.current?.();
    dismiss();
  }, [dismiss]);

  return (
    <UndoContext.Provider value={{ showUndo }}>
      {children}
      {banner ? (
        <UndoBanner
          message={banner.message}
          visible={banner.visible}
          onUndo={handleUndo}
          onDismiss={dismiss}
        />
      ) : null}
    </UndoContext.Provider>
  );
}

export function useUndo() {
  const ctx = useContext(UndoContext);
  if (!ctx) throw new Error("useUndo must be used within UndoProvider");
  return ctx;
}
