/** UUID без падения в небезопасном контексте (http по IP и т.п., где нет randomUUID). */
export function createPanelId(): string {
  try {
    if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
      return crypto.randomUUID();
    }
  } catch {
    /* secure context unavailable */
  }
  const p = Math.random().toString(36).slice(2, 11);
  return `id-${Date.now().toString(36)}-${p}`;
}
