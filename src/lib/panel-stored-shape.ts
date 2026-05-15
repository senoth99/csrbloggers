import type {
  ContractorItem,
  ContractorLink,
  Delivery,
  Employee,
  NicheOption,
} from "@/types/panel-data";

/** JSON-снапшот панели (localStorage и PanelSnapshot.data). */
export type PanelStoredShape = {
  contractors: unknown[];
  integrations: unknown[];
  socialOptions: unknown[];
  nicheOptions: NicheOption[];
  contractorItems: ContractorItem[];
  contractorLinks: ContractorLink[];
  deliveries: Delivery[];
  employees: Employee[];
};

export type LegacyPromocodeSnapshot = {
  codeKey: string;
  t: number;
  activations: number;
};

function nonEmptyId(row: unknown): row is { id: string } {
  return (
    !!row &&
    typeof row === "object" &&
    typeof (row as { id?: unknown }).id === "string" &&
    (row as { id: string }).id.trim().length > 0
  );
}

function nonEmptyStringField(row: unknown, key: string): boolean {
  return (
    !!row &&
    typeof row === "object" &&
    typeof (row as Record<string, unknown>)[key] === "string" &&
    String((row as Record<string, string>)[key]).trim().length > 0
  );
}

/**
 * Проверка обязательных id у сущностей снапшота.
 * Возвращает текст ошибки для ответа 400 или null, если критических нарушений нет.
 */
export function validatePanelStoredShape(shape: PanelStoredShape): string | null {
  for (let i = 0; i < shape.contractors.length; i++) {
    const row = shape.contractors[i];
    if (!nonEmptyId(row)) return `contractors[${i}]: требуется непустой id`;
    if (!nonEmptyStringField(row, "name")) return `contractors[${i}]: требуется name`;
  }
  for (let i = 0; i < shape.integrations.length; i++) {
    const row = shape.integrations[i];
    if (!nonEmptyId(row)) return `integrations[${i}]: требуется непустой id`;
    if (!nonEmptyStringField(row, "contractorId")) {
      return `integrations[${i}]: требуется contractorId`;
    }
  }
  for (let i = 0; i < shape.deliveries.length; i++) {
    const row = shape.deliveries[i];
    if (!nonEmptyId(row)) return `deliveries[${i}]: требуется непустой id`;
    if (!nonEmptyStringField(row, "contractorId")) {
      return `deliveries[${i}]: требуется contractorId`;
    }
    if (!nonEmptyStringField(row, "trackNumber")) {
      return `deliveries[${i}]: требуется trackNumber`;
    }
  }
  for (let i = 0; i < shape.employees.length; i++) {
    const row = shape.employees[i];
    if (!nonEmptyId(row)) return `employees[${i}]: требуется непустой id`;
    if (!nonEmptyStringField(row, "fullName")) return `employees[${i}]: требуется fullName`;
    if (!nonEmptyStringField(row, "telegramUsername")) {
      return `employees[${i}]: требуется telegramUsername`;
    }
  }
  for (let i = 0; i < shape.contractorItems.length; i++) {
    const row = shape.contractorItems[i];
    if (!nonEmptyId(row)) return `contractorItems[${i}]: требуется непустой id`;
    if (!nonEmptyStringField(row, "contractorId")) {
      return `contractorItems[${i}]: требуется contractorId`;
    }
  }
  const social = shape.socialOptions as unknown[];
  for (let i = 0; i < social.length; i++) {
    const row = social[i];
    if (!nonEmptyId(row)) return `socialOptions[${i}]: требуется непустой id`;
    if (!nonEmptyStringField(row, "label")) return `socialOptions[${i}]: требуется label`;
  }
  return null;
}

/** Разбор произвольного JSON в нормализованный черновик снапшота. */
export function coercePanelStoredShape(parsed: unknown): PanelStoredShape | null {
  const p = parsed as PanelStoredShape;
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
  };
}

/** Legacy-поле в JSON снапшота (миграция в localStorage на клиенте). */
export function parseLegacyPromocodeSnapshots(
  parsed: unknown,
): LegacyPromocodeSnapshot[] {
  const raw = (parsed as { promocodeSnapshots?: unknown })?.promocodeSnapshots;
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
    .filter(Boolean) as LegacyPromocodeSnapshot[];
}
