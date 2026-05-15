/**
 * Снапшоты активаций промокодов — только в localStorage браузера (ключ ниже).
 * Не синхронизируются между устройствами; Δ на дашборде может отличаться на другом ПК.
 */
export type PromocodeSnapshotRow = {
  codeKey: string;
  t: number;
  activations: number;
};

const STORAGE_KEY = "casher-promocode-snapshots-v1";
const HARD_LIMIT = 1200;

function parseRows(raw: unknown): PromocodeSnapshotRow[] {
  if (!Array.isArray(raw)) return [];
  return raw
    .map((row) => {
      const codeKey =
        typeof (row as { codeKey?: unknown }).codeKey === "string"
          ? (row as { codeKey: string }).codeKey.trim().toLowerCase()
          : "";
      const t =
        typeof (row as { t?: unknown }).t === "number" &&
        Number.isFinite((row as { t: number }).t)
          ? (row as { t: number }).t
          : NaN;
      const activations =
        typeof (row as { activations?: unknown }).activations === "number" &&
        Number.isFinite((row as { activations: number }).activations)
          ? (row as { activations: number }).activations
          : NaN;
      if (!codeKey || !Number.isFinite(t) || !Number.isFinite(activations)) return null;
      return { codeKey, t, activations };
    })
    .filter(Boolean) as PromocodeSnapshotRow[];
}

export function loadPromocodeSnapshots(): PromocodeSnapshotRow[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    return parseRows(JSON.parse(raw));
  } catch {
    return [];
  }
}

function savePromocodeSnapshots(rows: PromocodeSnapshotRow[]) {
  if (typeof window === "undefined") return;
  localStorage.setItem(STORAGE_KEY, JSON.stringify(rows));
}

/** Перенос legacy-поля из panel JSON (один раз при загрузке). */
export function migratePromocodeSnapshotsFromPanel(
  legacy: PromocodeSnapshotRow[] | undefined,
): PromocodeSnapshotRow[] {
  const local = loadPromocodeSnapshots();
  if (!legacy?.length) return local;
  return appendPromocodeSnapshots(local, legacy);
}

export function appendPromocodeSnapshots(
  prevRows: PromocodeSnapshotRow[],
  incoming: PromocodeSnapshotRow[],
): PromocodeSnapshotRow[] {
  if (incoming.length === 0) return prevRows;
  const next = [...prevRows];
  const lastByCodeKey = new Map<string, PromocodeSnapshotRow>();
  for (const row of next) {
    lastByCodeKey.set(row.codeKey, row);
  }
  for (const row of incoming) {
    const last = lastByCodeKey.get(row.codeKey);
    if (
      last &&
      last.activations === row.activations &&
      Math.abs(last.t - row.t) < 60_000
    ) {
      continue;
    }
    next.push(row);
    lastByCodeKey.set(row.codeKey, row);
  }
  const trimmed =
    next.length > HARD_LIMIT ? next.slice(next.length - HARD_LIMIT) : next;
  savePromocodeSnapshots(trimmed);
  return trimmed;
}

export function recordPromocodeSnapshotsLocal(
  items: Array<{ codeKey: string; activations: number }>,
  fetchedAt: number,
): PromocodeSnapshotRow[] {
  const t = Number.isFinite(fetchedAt) ? fetchedAt : Date.now();
  const normalized = items
    .map((it) => {
      const codeKey = (it.codeKey ?? "").trim().toLowerCase();
      const activations = Number.isFinite(it.activations) ? it.activations : 0;
      if (!codeKey) return null;
      return { codeKey, t, activations };
    })
    .filter(Boolean) as PromocodeSnapshotRow[];
  if (normalized.length === 0) return loadPromocodeSnapshots();
  return appendPromocodeSnapshots(loadPromocodeSnapshots(), normalized);
}
