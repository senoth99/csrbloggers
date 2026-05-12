import type { Contractor, Delivery, Integration } from "@/types/panel-data";
import { formatIntegrationReleaseLine } from "@/lib/format-ru";
import {
  addCalendarDaysLocal,
  deadlineEodAfterEventDay,
  parseYmdLocal,
  startOfLocalDay,
} from "@/lib/task-deadline";

export type PanelTaskKind =
  | "delivery_notify"
  | "integration_reach"
  | "integration_release_verify";

export interface PanelTask {
  key: string;
  kind: PanelTaskKind;
  title: string;
  detail: string;
  href: string;
  /** Для задач по интеграции — переход в карточку `/panel/[id]` */
  integrationId?: string;
  employeeId?: string;
  /** ISO конец дня дедлайна */
  deadlineIso: string;
  isOverdue: boolean;
  /** для сортировки */
  deadlineMs: number;
}

const DELIVERY_PREFIX = "delivery-notify:";
const INTEGRATION_PREFIX = "integration-reach:";
const INTEGRATION_RELEASE_VERIFY_PREFIX = "integration-release-verify:";

export function deliveryNotifyTaskKey(deliveryId: string): string {
  return `${DELIVERY_PREFIX}${deliveryId}`;
}

export function integrationReachTaskKey(integrationId: string): string {
  return `${INTEGRATION_PREFIX}${integrationId}`;
}

export function integrationReleaseVerifyTaskKey(integrationId: string): string {
  return `${INTEGRATION_RELEASE_VERIFY_PREFIX}${integrationId}`;
}

/**
 * Локальная отметка времени выхода (YYYY-MM-DD + HH:mm). Нужны оба поля.
 * @returns epoch ms или null
 */
export function localReleaseDateTimeMs(
  releaseDateYmd: string | undefined,
  releaseTimeHm: string | undefined,
): number | null {
  const d = releaseDateYmd?.trim();
  const t = releaseTimeHm?.trim();
  if (!d || !t) return null;
  const base = parseYmdLocal(d);
  if (!base) return null;
  const m = /^([01]?\d|2[0-3]):([0-5]\d)$/.exec(t);
  if (!m) return null;
  const dt = new Date(
    base.getFullYear(),
    base.getMonth(),
    base.getDate(),
    Number(m[1]),
    Number(m[2]),
    0,
    0,
  );
  return dt.getTime();
}

/** Дата начала показа задачи «ввести охваты»: releaseDate + 5 календарных дней, 00:00 локально */
export function integrationReachTaskOpensAt(releaseDateYmd: string): Date | null {
  const d = parseYmdLocal(releaseDateYmd);
  if (!d) return null;
  const fifth = addCalendarDaysLocal(startOfLocalDay(d), 5);
  return startOfLocalDay(fifth);
}

export function buildOpenTasks(params: {
  deliveries: Delivery[];
  integrations: Integration[];
  contractors: Contractor[];
  completedKeys: Set<string>;
  now?: Date;
}): PanelTask[] {
  const now = params.now ?? new Date();
  const contractorName = new Map<string, string>();
  for (const c of params.contractors) {
    contractorName.set(c.id, c.name);
  }

  const out: PanelTask[] = [];

  for (const d of params.deliveries) {
    if (d.status !== "delivered") continue;
    const key = deliveryNotifyTaskKey(d.id);
    if (params.completedKeys.has(key)) continue;
    const eventIso = d.deliveredAt ?? d.updatedAt ?? d.createdAt ?? now.toISOString();
    const deadline = deadlineEodAfterEventDay(eventIso);
    const deadlineIso = deadline.toISOString();
    out.push({
      key,
      kind: "delivery_notify",
      title: "Отписать контрагенту, что посылка пришла",
      detail: `Трек ${d.trackNumber} · ${contractorName.get(d.contractorId)?.trim() || "контрагент"}`,
      href: `/deliveries/${d.id}`,
      employeeId: d.assignedEmployeeId,
      deadlineIso,
      isOverdue: now.getTime() > deadline.getTime(),
      deadlineMs: deadline.getTime(),
    });
  }

  for (const row of params.integrations) {
    const rd = row.releaseDate?.trim();
    if (!rd) continue;
    const opens = integrationReachTaskOpensAt(rd);
    if (!opens || now.getTime() < opens.getTime()) continue;
    if (typeof row.reach === "number" && !Number.isNaN(row.reach)) continue;
    const key = integrationReachTaskKey(row.id);
    if (params.completedKeys.has(key)) continue;

    const eventForDeadline = opens.toISOString();
    const deadline = deadlineEodAfterEventDay(eventForDeadline);
    const deadlineIso = deadline.toISOString();
    out.push({
      key,
      kind: "integration_reach",
      title: "Ввести охваты по интеграции",
      detail: row.title?.trim() || "Интеграция",
      href: `/panel/${row.id}`,
      integrationId: row.id,
      employeeId: row.assignedEmployeeId,
      deadlineIso,
      isOverdue: now.getTime() > deadline.getTime(),
      deadlineMs: deadline.getTime(),
    });
  }

  for (const row of params.integrations) {
    if (row.status === "completed") continue;
    const assignee = row.assignedEmployeeId?.trim();
    if (!assignee) continue;
    const releaseMs = localReleaseDateTimeMs(row.releaseDate, row.releaseTime);
    if (releaseMs === null || now.getTime() < releaseMs) continue;
    const key = integrationReleaseVerifyTaskKey(row.id);
    if (params.completedKeys.has(key)) continue;

    const eventIso = new Date(releaseMs).toISOString();
    const deadline = deadlineEodAfterEventDay(eventIso);
    const deadlineIso = deadline.toISOString();
    const planLine = formatIntegrationReleaseLine(row.releaseDate, row.releaseTime);
    out.push({
      key,
      kind: "integration_release_verify",
      title: "Убедиться в выходе интеграции",
      detail: `${row.title?.trim() || "Интеграция"} · план: ${planLine}`,
      href: `/panel/${row.id}`,
      integrationId: row.id,
      employeeId: assignee,
      deadlineIso,
      isOverdue: now.getTime() > deadline.getTime(),
      deadlineMs: deadline.getTime(),
    });
  }

  out.sort((a, b) => a.deadlineMs - b.deadlineMs);
  return out;
}
