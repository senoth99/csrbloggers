import {
  useCallback,
  useEffect,
  useRef,
  type KeyboardEvent as ReactKeyboardEvent,
  type RefObject,
} from "react";

export const FOCUSABLE_SELECTOR =
  'button:not([disabled]), [href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])';

export function queryFocusables(root: HTMLElement): HTMLElement[] {
  return Array.from(root.querySelectorAll<HTMLElement>(FOCUSABLE_SELECTOR)).filter(
    (el) => el.offsetParent !== null || el.getClientRects().length > 0,
  );
}

export function handleTabTrapKey(
  e: ReactKeyboardEvent<HTMLElement>,
  panelRef: RefObject<HTMLElement | null>,
) {
  if (e.key !== "Tab") return;
  const panel = panelRef.current;
  if (!panel) return;
  const focusables = queryFocusables(panel);
  if (focusables.length === 0) return;
  const first = focusables[0];
  const last = focusables[focusables.length - 1];
  if (e.shiftKey) {
    if (document.activeElement === first) {
      e.preventDefault();
      last.focus();
    }
  } else if (document.activeElement === last) {
    e.preventDefault();
    first.focus();
  }
}

const APP_MAIN_ID = "app-main-content";

/** Marks main app content inert while a modal/dialog is open. */
export function useInertAppMain(active: boolean) {
  useEffect(() => {
    if (!active) return;
    const main = document.getElementById(APP_MAIN_ID);
    if (!main) return;
    main.setAttribute("inert", "");
    main.setAttribute("aria-hidden", "true");
    return () => {
      main.removeAttribute("inert");
      main.removeAttribute("aria-hidden");
    };
  }, [active]);
}

export function useDialogA11y(
  open: boolean,
  onClose: () => void,
  panelRef: RefObject<HTMLElement | null>,
  options?: { focusOnOpen?: boolean },
) {
  const focusOnOpen = options?.focusOnOpen ?? true;
  const returnFocusRef = useRef<HTMLElement | null>(null);

  useInertAppMain(open);

  useEffect(() => {
    if (!open) return;
    returnFocusRef.current =
      document.activeElement instanceof HTMLElement ? document.activeElement : null;
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [open, onClose]);

  useEffect(() => {
    if (!open) {
      returnFocusRef.current?.focus();
      returnFocusRef.current = null;
      return;
    }
    if (!focusOnOpen) return;
    const panel = panelRef.current;
    if (!panel) return;
    const id = requestAnimationFrame(() => {
      queryFocusables(panel)[0]?.focus();
    });
    return () => cancelAnimationFrame(id);
  }, [open, focusOnOpen, panelRef]);

  const onKeyDownTrap = useCallback(
    (e: ReactKeyboardEvent<HTMLElement>) => handleTabTrapKey(e, panelRef),
    [panelRef],
  );

  return { onKeyDownTrap };
}
