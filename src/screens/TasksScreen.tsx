"use client";

import Link from "next/link";
import { useMemo } from "react";
import { Check } from "lucide-react";
import { useAuth } from "@/context/AuthContext";
import { usePanelData } from "@/context/PanelDataContext";
import { abbreviateFio, findEmployeeIdByPanelSession } from "@/lib/employee-utils";
import { buildOpenTasks, type PanelTask } from "@/lib/panel-tasks";
import {
  dashboardPageTitleClass,
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

export function TasksScreen() {
  const { currentUsername } = useAuth();
  const {
    deliveries,
    integrations,
    contractors,
    employees,
    completedTaskKeys,
    completeTaskKey,
  } = usePanelData();

  const completed = useMemo(
    () => new Set(completedTaskKeys),
    [completedTaskKeys],
  );

  const tasks = useMemo(
    () =>
      buildOpenTasks({
        deliveries,
        integrations,
        contractors,
        completedKeys: completed,
      }),
    [deliveries, integrations, contractors, completed],
  );

  const myEmployeeId = findEmployeeIdByPanelSession(employees, currentUsername);

  const { myTasks, otherTasks } = useMemo(() => {
    if (!myEmployeeId) {
      return { myTasks: [] as PanelTask[], otherTasks: tasks };
    }
    const my: PanelTask[] = [];
    const other: PanelTask[] = [];
    for (const t of tasks) {
      if (t.employeeId === myEmployeeId) my.push(t);
      else other.push(t);
    }
    return { myTasks: my, otherTasks: other };
  }, [tasks, myEmployeeId]);

  function employeeLabel(id: string | undefined): string {
    if (!id) return "Без ответственного";
    const e = employees.find((x) => x.id === id);
    return e ? abbreviateFio(e.fullName) : "—";
  }

  return (
    <div className="space-y-8">
      <div>
        <p className="mb-1 text-[10px] font-semibold uppercase tracking-[0.2em] text-app-fg/45">
          Панель
        </p>
        <h1 className={dashboardPageTitleClass}>Задачи</h1>
      </div>

      {tasks.length === 0 ? (
        <p className="border border-dashed border-app-fg/15 px-4 py-12 text-center text-sm text-app-fg/55">
          Нет открытых задач
        </p>
      ) : (
        <div className={`${dashboardPanelClass} overflow-hidden`}>
          <div className="px-5 py-4 sm:px-6">
            <h2 className="text-[11px] font-semibold uppercase tracking-[0.18em] text-app-fg/55">
              Активные
            </h2>
          </div>
          <div>
            {myEmployeeId && myTasks.length > 0 ? (
              <section>
                <h3 className="bg-app-bg px-5 py-3 text-[10px] font-semibold uppercase tracking-[0.18em] text-app-accent sm:px-6">
                  Мои задачи
                </h3>
                <ul className={listDivideClass}>
                  {myTasks.map((t) => (
                    <TaskRow
                      key={t.key}
                      task={t}
                      showAssignee={false}
                      assigneeLabel=""
                      onDone={
                        t.kind === "delivery_notify" || t.kind === "integration_release_verify"
                          ? () => completeTaskKey(t.key)
                          : undefined
                      }
                    />
                  ))}
                </ul>
              </section>
            ) : null}

            {(myEmployeeId ? otherTasks.length > 0 : tasks.length > 0) ? (
              <section>
                <h3 className="bg-app-bg px-5 py-3 text-[10px] font-semibold uppercase tracking-[0.18em] text-app-fg/45 sm:px-6">
                  {myEmployeeId ? "Все сотрудники" : "Задачи"}
                </h3>
                <ul className={listDivideClass}>
                  {(myEmployeeId ? otherTasks : tasks).map((t) => (
                    <TaskRow
                      key={t.key}
                      task={t}
                      showAssignee
                      assigneeLabel={employeeLabel(t.employeeId)}
                      onDone={
                        t.kind === "delivery_notify" || t.kind === "integration_release_verify"
                          ? () => completeTaskKey(t.key)
                          : undefined
                      }
                    />
                  ))}
                </ul>
              </section>
            ) : null}
          </div>
        </div>
      )}
    </div>
  );
}

const INTEGRATION_DETAIL_PLAN_SEP = " · план:";

function TaskDetailParagraph({ task }: { task: PanelTask }) {
  if (task.kind === "integration_release_verify" && task.integrationId) {
    const sepIdx = task.detail.indexOf(INTEGRATION_DETAIL_PLAN_SEP);
    if (sepIdx > 0) {
      const lead = task.detail.slice(0, sepIdx);
      const tail = task.detail.slice(sepIdx);
      return (
        <p className="mt-1 text-xs text-app-fg/55">
          <Link
            href={`/panel/${task.integrationId}`}
            className="font-medium text-app-fg/80 transition hover:text-app-fg hover:underline"
          >
            {lead}
          </Link>
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
  onDone,
}: {
  task: PanelTask;
  showAssignee: boolean;
  assigneeLabel: string;
  onDone?: () => void;
}) {
  const titleHref = task.integrationId ? `/panel/${task.integrationId}` : task.href;

  return (
    <li className="px-5 sm:px-6">
      <div className="flex gap-3 py-3.5">
        <div className="min-w-0 flex-1">
          <Link
            href={titleHref}
            className="block text-sm font-medium leading-snug text-app-fg transition hover:underline"
          >
            {task.title}
          </Link>
          <TaskDetailParagraph task={task} />
          {showAssignee ? (
            <p className="mt-1 text-[10px] uppercase tracking-wider text-app-fg/40">
              {assigneeLabel}
            </p>
          ) : null}
          <p
            className={`mt-1.5 text-[11px] tabular-nums ${
              task.isOverdue ? "text-amber-400" : "text-app-fg/45"
            }`}
          >
            До {formatDeadline(task.deadlineIso)}
            {task.isOverdue ? " · просрочено" : ""}
          </p>
        </div>
        {onDone ? (
          <button
            type="button"
            title="Отметить выполненной"
            onClick={(e) => {
              e.preventDefault();
              e.stopPropagation();
              onDone();
            }}
            className="shrink-0 self-start border border-app-fg/20 p-1.5 text-app-fg/55 transition hover:border-app-accent/50"
          >
            <Check className="h-4 w-4" strokeWidth={1.75} />
          </button>
        ) : null}
      </div>
    </li>
  );
}
