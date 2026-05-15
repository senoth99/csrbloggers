"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { Check } from "lucide-react";
import { useAuth } from "@/context/AuthContext";
import { usePanelData } from "@/context/PanelDataContext";
import { abbreviateFio, resolveSessionEmployeeId } from "@/lib/employee-utils";
import { normalizeUsername } from "@/lib/panel-auth-utils";
import {
  buildCompletedTasks,
  buildOpenTasks,
  type PanelTask,
} from "@/lib/panel-tasks";
import { startOfLocalDay, startOfLocalDayFromIso } from "@/lib/task-deadline";
import { SlideOver } from "@/components/ui";
import {
  crmPageHeaderRowClass,
  crmPageTitleClass,
  dashboardPanelClass,
  listDivideClass,
} from "@/screens/dashboard-shared";

const deadlineFmt = new Intl.DateTimeFormat("ru-RU", {
  weekday: "short",
  day: "numeric",
  month: "short",
  hour: "2-digit",
  minute: "2-digit",
});

function formatDeadline(iso: string): string {
  try {
    return deadlineFmt.format(new Date(iso));
  } catch {
    return iso;
  }
}

type TaskBucket = "overdue" | "today" | "upcoming";

function taskBucket(task: PanelTask, now: Date): TaskBucket {
  const todayStart = startOfLocalDay(now).getTime();
  const dueDay = startOfLocalDayFromIso(task.deadlineIso).getTime();
  if (dueDay < todayStart) return "overdue";
  if (dueDay === todayStart) return "today";
  return "upcoming";
}

const INTEGRATION_DETAIL_PLAN_SEP = " · план:";

export function TasksScreen() {
  const { currentUsername, users } = useAuth();
  const {
    deliveries,
    integrations,
    contractors,
    employees,
    completedTaskKeys,
    completeTaskKey,
    isAdmin,
  } = usePanelData();

  const [selectedTask, setSelectedTask] = useState<PanelTask | null>(null);
  const [showCompleted, setShowCompleted] = useState(false);

  const completed = useMemo(
    () => new Set(completedTaskKeys),
    [completedTaskKeys],
  );

  const openTasks = useMemo(
    () =>
      buildOpenTasks({
        deliveries,
        integrations,
        contractors,
        completedKeys: completed,
        now: new Date(),
      }),
    [deliveries, integrations, contractors, completed],
  );

  const completedTasks = useMemo(
    () =>
      buildCompletedTasks({
        deliveries,
        integrations,
        contractors,
        completedKeys: completed,
        now: new Date(),
      }),
    [deliveries, integrations, contractors, completed],
  );

  const me = users.find(
    (u) => normalizeUsername(u.login) === normalizeUsername(currentUsername ?? ""),
  );
  const myEmployeeId = resolveSessionEmployeeId(
    me?.employeeId,
    employees,
    currentUsername,
  );

  const needsEmployeeLink = !isAdmin && !myEmployeeId;

  const visibleOpen = useMemo(() => {
    if (needsEmployeeLink) return [];
    if (isAdmin) return openTasks;
    return openTasks.filter((t) => t.employeeId === myEmployeeId);
  }, [openTasks, isAdmin, myEmployeeId, needsEmployeeLink]);

  const visibleCompleted = useMemo(() => {
    if (needsEmployeeLink) return [];
    if (isAdmin) return completedTasks;
    return completedTasks.filter((t) => t.employeeId === myEmployeeId);
  }, [completedTasks, isAdmin, myEmployeeId, needsEmployeeLink]);

  const grouped = useMemo(() => {
    const now = new Date();
    const overdue: PanelTask[] = [];
    const today: PanelTask[] = [];
    const upcoming: PanelTask[] = [];
    for (const t of visibleOpen) {
      const b = taskBucket(t, now);
      if (b === "overdue") overdue.push(t);
      else if (b === "today") today.push(t);
      else upcoming.push(t);
    }
    return { overdue, today, upcoming };
  }, [visibleOpen]);

  function employeeLabel(id: string | undefined): string {
    if (!id) return "Без ответственного";
    const e = employees.find((x) => x.id === id);
    return e ? abbreviateFio(e.fullName) : "—";
  }

  function contractorLabel(task: PanelTask): string {
    if (task.kind === "delivery_notify") {
      const id = task.href.replace(/^\/deliveries\//, "").split("?")[0];
      const d = deliveries.find((x) => x.id === id);
      if (d) {
        const c = contractors.find((x) => x.id === d.contractorId);
        return c?.contactPerson?.trim() || c?.name || "—";
      }
    }
    if (task.integrationId) {
      const i = integrations.find((x) => x.id === task.integrationId);
      if (i) {
        const c = contractors.find((x) => x.id === i.contractorId);
        return c?.contactPerson?.trim() || c?.name || "—";
      }
    }
    return "—";
  }

  const hasAny =
    !needsEmployeeLink &&
    grouped.overdue.length +
      grouped.today.length +
      grouped.upcoming.length +
      visibleCompleted.length >
      0;

  return (
    <div className="w-full min-w-0 max-w-full space-y-4">
      <div className={crmPageHeaderRowClass}>
        <h1 className={crmPageTitleClass}>Задачи</h1>
      </div>

      {needsEmployeeLink ? (
        <p className="border border-dashed border-app-fg/15 px-4 py-12 text-center text-sm text-app-fg/55">
          Привяжите сотрудника к логину
        </p>
      ) : !hasAny ? (
        <p className="border border-dashed border-app-fg/15 px-4 py-12 text-center text-sm text-app-fg/55">
          Нет задач
        </p>
      ) : (
        <div className={`${dashboardPanelClass} overflow-hidden`}>
          <TaskSection
            title="⚠ ПРОСРОЧЕНО"
            count={grouped.overdue.length}
            tasks={grouped.overdue}
            showAssignee={isAdmin}
            employeeLabel={employeeLabel}
            onSelect={setSelectedTask}
            onDone={completeTaskKey}
            overdueTone
          />
          <TaskSection
            title="◉ СЕГОДНЯ"
            count={grouped.today.length}
            tasks={grouped.today}
            showAssignee={isAdmin}
            employeeLabel={employeeLabel}
            onSelect={setSelectedTask}
            onDone={completeTaskKey}
          />
          <TaskSection
            title="○ ПРЕДСТОЯЩИЕ"
            count={grouped.upcoming.length}
            tasks={grouped.upcoming}
            showAssignee={isAdmin}
            employeeLabel={employeeLabel}
            onSelect={setSelectedTask}
            onDone={completeTaskKey}
          />

          {visibleCompleted.length > 0 ? (
            <section>
              <button
                type="button"
                onClick={() => setShowCompleted((v) => !v)}
                className="flex w-full items-center justify-between bg-app-bg px-5 py-3 text-left text-[10px] font-semibold uppercase tracking-[0.18em] text-app-fg/45 sm:px-6"
              >
                <span>✓ ВЫПОЛНЕНО ({visibleCompleted.length})</span>
                <span className="text-app-fg/35">{showCompleted ? "скрыть" : "показать"}</span>
              </button>
              {showCompleted ? (
                <ul className={`${listDivideClass} opacity-70`}>
                  {visibleCompleted.map((t) => (
                    <TaskRow
                      key={t.key}
                      task={t}
                      showAssignee={isAdmin}
                      assigneeLabel={employeeLabel(t.employeeId)}
                      onSelect={() => setSelectedTask(t)}
                      completed
                    />
                  ))}
                </ul>
              ) : null}
            </section>
          ) : null}
        </div>
      )}

      <SlideOver
        open={selectedTask != null}
        onClose={() => setSelectedTask(null)}
        title="Задача"
        widthClass="sm:max-w-md"
      >
        {selectedTask ? (
          <TaskDetailDrawer
            task={selectedTask}
            contractorName={contractorLabel(selectedTask)}
            onClose={() => setSelectedTask(null)}
          />
        ) : null}
      </SlideOver>
    </div>
  );
}

function TaskSection({
  title,
  count,
  tasks,
  showAssignee,
  employeeLabel,
  onSelect,
  onDone,
  overdueTone,
}: {
  title: string;
  count: number;
  tasks: PanelTask[];
  showAssignee: boolean;
  employeeLabel: (id: string | undefined) => string;
  onSelect: (t: PanelTask) => void;
  onDone: (key: string) => void;
  overdueTone?: boolean;
}) {
  if (count === 0) return null;
  return (
    <section>
      <h3 className="bg-app-bg px-5 py-3 text-[10px] font-semibold uppercase tracking-[0.18em] text-app-fg/55 sm:px-6">
        {title} ({count})
      </h3>
      <ul className={listDivideClass}>
        {tasks.map((t) => (
          <TaskRow
            key={t.key}
            task={t}
            showAssignee={showAssignee}
            assigneeLabel={employeeLabel(t.employeeId)}
            onSelect={() => onSelect(t)}
            onDone={
              t.kind === "delivery_notify" || t.kind === "integration_release_verify"
                ? () => onDone(t.key)
                : undefined
            }
            overdueTone={overdueTone}
          />
        ))}
      </ul>
    </section>
  );
}

function TaskDetailDrawer({
  task,
  contractorName,
  onClose,
}: {
  task: PanelTask;
  contractorName: string;
  onClose: () => void;
}) {
  const integrationHref = task.integrationId
    ? `/integrations/${task.integrationId}`
    : null;
  const deliveryHref =
    task.kind === "delivery_notify"
      ? `/deliveries?id=${task.href.replace(/^\/deliveries\//, "")}`
      : null;

  return (
    <div className="space-y-4 px-4 py-4 sm:px-5 sm:py-5">
      <p className="text-sm font-medium text-app-fg">{task.title}</p>
      <p className="text-xs text-app-fg/55">{task.detail}</p>
      <dl className="space-y-2 text-xs">
        <div className="flex justify-between gap-3">
          <dt className="text-app-fg/45">Контрагент</dt>
          <dd className="text-right text-app-fg">{contractorName}</dd>
        </div>
        <div className="flex justify-between gap-3">
          <dt className="text-app-fg/45">Дедлайн</dt>
          <dd className="text-right tabular-nums text-app-fg">
            {formatDeadline(task.deadlineIso)}
          </dd>
        </div>
      </dl>
      <div className="flex flex-col gap-2 border-t border-app-fg/10 pt-4">
        {integrationHref ? (
          <Link
            href={integrationHref}
            onClick={onClose}
            className="text-xs font-semibold uppercase tracking-wide text-app-accent hover:underline"
          >
            Открыть интеграцию
          </Link>
        ) : null}
        {deliveryHref ? (
          <Link
            href={deliveryHref}
            onClick={onClose}
            className="text-xs font-semibold uppercase tracking-wide text-app-accent hover:underline"
          >
            Открыть доставку
          </Link>
        ) : null}
      </div>
    </div>
  );
}

function TaskDetailParagraph({ task }: { task: PanelTask }) {
  if (task.kind === "integration_release_verify" && task.integrationId) {
    const sepIdx = task.detail.indexOf(INTEGRATION_DETAIL_PLAN_SEP);
    if (sepIdx > 0) {
      const lead = task.detail.slice(0, sepIdx);
      const tail = task.detail.slice(sepIdx);
      return (
        <p className="mt-1 text-xs text-app-fg/55">
          <span className="font-medium text-app-fg/80">{lead}</span>
          <span>{tail}</span>
        </p>
      );
    }
  }
  return <p className="mt-1 text-xs text-app-fg/55">{task.detail}</p>;
}

function TaskRow({
  task,
  showAssignee,
  assigneeLabel,
  onSelect,
  onDone,
  overdueTone,
  completed,
}: {
  task: PanelTask;
  showAssignee: boolean;
  assigneeLabel: string;
  onSelect: () => void;
  onDone?: () => void;
  overdueTone?: boolean;
  completed?: boolean;
}) {
  const isOverdue = overdueTone || task.isOverdue;

  return (
    <li className="px-5 sm:px-6">
      <div className="flex gap-3 py-3.5">
        {onDone && !completed ? (
          <button
            type="button"
            title="Отметить выполненной"
            onClick={(e) => {
              e.stopPropagation();
              onDone();
            }}
            className="mt-0.5 shrink-0 self-start border border-app-fg/20 p-1.5 text-app-fg/55 transition hover:border-app-accent/50"
          >
            <Check className="h-4 w-4" strokeWidth={1.75} />
          </button>
        ) : (
          <span className="mt-0.5 inline-block h-[30px] w-[30px] shrink-0" aria-hidden />
        )}
        <button
          type="button"
          onClick={onSelect}
          className="min-w-0 flex-1 text-left"
        >
          <span
            className={`block text-sm font-medium leading-snug ${
              isOverdue && !completed ? "text-red-400" : "text-app-fg"
            }`}
          >
            {task.title}
          </span>
          <TaskDetailParagraph task={task} />
          {showAssignee ? (
            <p className="mt-1 text-[10px] uppercase tracking-wider text-app-fg/40">
              {assigneeLabel}
            </p>
          ) : null}
          <p
            className={`mt-1.5 text-[11px] tabular-nums ${
              isOverdue && !completed ? "text-red-400/80" : "text-app-fg/45"
            }`}
          >
            До {formatDeadline(task.deadlineIso)}
            {isOverdue && !completed ? " · просрочено" : ""}
          </p>
        </button>
      </div>
    </li>
  );
}
