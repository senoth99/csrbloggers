"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useMemo, useState } from "react";
import { ArrowLeft, Pencil, Plus, Save, Trash2, X } from "lucide-react";
import { usePanelData } from "@/context/PanelDataContext";
import { ContractorListModal } from "@/components/ContractorListModal";
import { CrmPill } from "@/components/CrmPill";
import {
  CHANNEL_BADGE_CLASS,
  CONTRACTOR_SIZE_CATEGORY_LABELS,
  INTEGRATION_COOPERATION_LABELS,
  INTEGRATION_COOPERATION_TYPES,
  INTEGRATION_STATUSES,
  INTEGRATION_STATUS_LABELS,
  STATUS_BADGE_CLASS,
  type Integration,
  type IntegrationCooperationType,
  type IntegrationPosition,
  type IntegrationStatus,
} from "@/types/panel-data";
import {
  formatCalendarDate,
  formatIntegrationReleaseLine,
  formatRuCpm,
  formatRuDate,
  formatRuMoney,
  formatRuTime,
} from "@/lib/format-ru";
import { integrationPublicLinkHref } from "@/lib/integration-link";
import { computeContractorRating10 } from "@/lib/contractor-rating";
import { ContractorRatingBadge } from "@/components/ContractorRatingBadge";
import { computeCpmRub, parseBudgetReachField } from "@/lib/integration-metrics";
import { abbreviateFio } from "@/lib/employee-utils";
import { nicheChoiceCaption } from "@/lib/niche-display";
import { selectNativeChevronPad } from "@/screens/dashboard-shared";

const nfReach = new Intl.NumberFormat("ru-RU", {
  maximumFractionDigits: 0,
});

const selectClass = `w-full min-w-0 border border-app-fg/15 bg-app-bg px-3 py-2.5 text-sm text-app-fg outline-none ring-app-accent/35 focus:ring-2 ${selectNativeChevronPad}`;

const textareaClass = `${selectClass} min-h-[120px] resize-y leading-relaxed`;

const overlayClass =
  "fixed inset-0 z-50 flex items-center justify-center bg-black/70 px-4 py-8 backdrop-blur-[2px]";

const modalShellClass =
  "flex max-h-[min(92vh,880px)] w-full max-w-lg flex-col border border-app-fg/20 bg-app-bg shadow-[0_0_40px_-12px_rgba(0,0,0,0.45)]";

function integrationTitleKey(title: string): string {
  return title.trim().toLowerCase().replace(/\s+/g, " ");
}

/** При открытом редактировании подставляем черновик, чтобы бюджет, охваты и CPM обновлялись сразу */
function draftOrSaved(
  isEditOpen: boolean,
  draft: string,
  saved: number | undefined,
): number | undefined {
  if (!isEditOpen) return saved;
  const t = draft.trim();
  if (t === "") return saved;
  return parseBudgetReachField(draft) ?? saved;
}

function InfoBlock({
  label,
  children,
  className = "",
}: {
  label: string;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div
      className={`rounded-sm border border-app-fg/10 bg-app-fg/[0.03] px-3.5 py-3 sm:px-4 ${className}`}
    >
      <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-app-fg/45">{label}</p>
      <div className="mt-1.5 min-w-0 text-sm leading-snug text-app-fg">{children}</div>
    </div>
  );
}

export function IntegrationDetailScreen({ integrationId }: { integrationId: string }) {
  const router = useRouter();
  const {
    contractors,
    integrations,
    contractorItems,
    socialOptions,
    nicheOptions,
    employees,
    isAdmin,
    updateIntegration,
    removeIntegration,
    addIntegrationPosition,
    removeIntegrationPosition,
  } = usePanelData();

  const [isEditOpen, setIsEditOpen] = useState(false);
  const [titleDraft, setTitleDraft] = useState("");
  const [titleError, setTitleError] = useState<string | null>(null);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [isContractorPickerOpen, setIsContractorPickerOpen] = useState(false);
  const [contractorDraft, setContractorDraft] = useState("");
  const [assignedDraft, setAssignedDraft] = useState("");
  const [statusDraft, setStatusDraft] = useState<IntegrationStatus>("draft");
  const [socialDraft, setSocialDraft] = useState("");
  const [releaseDateDraft, setReleaseDateDraft] = useState("");
  const [releaseTimeDraft, setReleaseTimeDraft] = useState("");
  const [budgetDraft, setBudgetDraft] = useState("");
  const [reachDraft, setReachDraft] = useState("");
  const [linkDraft, setLinkDraft] = useState("");
  const [commentDraft, setCommentDraft] = useState("");
  const [cooperationDraft, setCooperationDraft] = useState<IntegrationCooperationType | "">(
    "",
  );

  const [isAddPositionOpen, setIsAddPositionOpen] = useState(false);
  const [posTitleDraft, setPosTitleDraft] = useState("");
  const [posStatusDraft, setPosStatusDraft] = useState<IntegrationStatus>("draft");
  const [posSocialDraft, setPosSocialDraft] = useState("");
  const [posContractorDraft, setPosContractorDraft] = useState("");
  const [posCoopDraft, setPosCoopDraft] = useState<IntegrationCooperationType | "">("");
  const [posEmployeeDraft, setPosEmployeeDraft] = useState("");
  const [posDateDraft, setPosDateDraft] = useState("");
  const [posBudgetDraft, setPosBudgetDraft] = useState("");

  const row = integrations.find((i) => i.id === integrationId);
  const contractor = contractors.find((c) => c.id === row?.contractorId);
  const assignee = row?.assignedEmployeeId
    ? employees.find((e) => e.id === row.assignedEmployeeId)
    : undefined;
  const socialLabel = row
    ? socialOptions.find((o) => o.id === row.socialNetworkId)?.label ?? row.socialNetworkId
    : "—";

  const contractorNicheLabel = useMemo(() => {
    if (!contractor?.nicheId) return "";
    const raw = nicheOptions.find((o) => o.id === contractor.nicheId)?.label ?? "";
    return raw ? nicheChoiceCaption(raw) : "";
  }, [contractor?.nicheId, nicheOptions]);

  const contractorRating10 = useMemo(() => {
    if (!contractor) return 5;
    const theirs = integrations.filter((i) => i.contractorId === contractor.id);
    const nItems = contractorItems.filter((it) => it.contractorId === contractor.id).length;
    return computeContractorRating10(theirs, nItems);
  }, [contractor, integrations, contractorItems]);

  const applyRowToDrafts = useCallback(
    (source: Integration | undefined) => {
      if (!source) return;
      setTitleDraft(source.title ?? "");
      setTitleError(null);
      setSaveError(null);
      setContractorDraft(source.contractorId);
      setAssignedDraft(source.assignedEmployeeId ?? "");
      setStatusDraft(source.status);
      setSocialDraft(source.socialNetworkId);
      setReleaseDateDraft(source.releaseDate ?? "");
      setReleaseTimeDraft(source.releaseTime ?? "");
      setBudgetDraft(source.budget != null ? String(source.budget) : "");
      setReachDraft(source.reach != null ? String(source.reach) : "");
      setLinkDraft(source.publicLink ?? "");
      setCommentDraft(source.comment?.trim() || source.note?.trim() || "");
      setCooperationDraft(
        source.cooperationType === "barter" || source.cooperationType === "commercial"
          ? source.cooperationType
          : "",
      );
    },
    [],
  );

  useEffect(() => {
    if (!row || isEditOpen) return;
    applyRowToDrafts(row);
  }, [isEditOpen, applyRowToDrafts, row]);

  const closeEdit = useCallback(() => {
    applyRowToDrafts(row);
    setTitleError(null);
    setSaveError(null);
    setIsEditOpen(false);
  }, [row, applyRowToDrafts]);

  useEffect(() => {
    if (!isEditOpen) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") closeEdit();
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [isEditOpen, closeEdit]);

  if (!row) {
    return (
      <div className="space-y-4">
        <BackLink href="/integrations" />
        <p className="text-sm text-app-fg/55">Интеграция не найдена.</p>
      </div>
    );
  }

  function openEdit() {
    applyRowToDrafts(row);
    setTitleError(null);
    setSaveError(null);
    setIsEditOpen(true);
  }

  function handleDelete() {
    if (!isAdmin || !row) return;
    if (!window.confirm("Удалить эту интеграцию?")) return;
    removeIntegration(row.id);
    router.replace("/integrations");
  }

  function handleSave() {
    const target = integrations.find((i) => i.id === integrationId);
    if (!target || !row) return;

    const t = titleDraft.trim();
    if (!t) {
      setTitleError("Укажите заголовок.");
      return;
    }
    if (
      integrations.some(
        (i) =>
          i.id !== target.id &&
          integrationTitleKey(i.title ?? "") === integrationTitleKey(t),
      )
    ) {
      setTitleError("Такой заголовок уже используется.");
      return;
    }

    const budgetTrim = budgetDraft.trim();
    const budgetVal = parseBudgetReachField(budgetDraft);
    if (budgetTrim !== "" && budgetVal === undefined) {
      setSaveError("Проверьте формат бюджета.");
      return;
    }
    const reachTrim = reachDraft.trim();
    const reachVal = parseBudgetReachField(reachDraft);
    if (reachTrim !== "" && reachVal === undefined) {
      setSaveError("Проверьте формат охватов.");
      return;
    }
    if (!contractorDraft.trim() || !contractors.some((c) => c.id === contractorDraft)) {
      setSaveError("Выберите контрагента.");
      return;
    }
    const socialOk = socialOptions.some((o) => o.id === socialDraft);
    if (!socialOk) {
      setSaveError("Выберите площадку.");
      return;
    }

    setTitleError(null);
    setSaveError(null);

    updateIntegration(target.id, {
      title: t,
      contractorId: contractorDraft,
      assignedEmployeeId: assignedDraft.trim() || undefined,
      status: statusDraft,
      socialNetworkId: socialDraft,
      releaseDate: releaseDateDraft.trim() || undefined,
      releaseTime: releaseTimeDraft.trim() || undefined,
      budget: budgetVal,
      reach: reachVal,
      publicLink: linkDraft.trim() === "" ? "" : linkDraft,
      comment: commentDraft.trim() === "" ? "" : commentDraft.trim(),
      cooperationType:
        cooperationDraft === "barter" || cooperationDraft === "commercial"
          ? cooperationDraft
          : undefined,
    });
    setIsEditOpen(false);
  }

  function handleAddPosition(e: React.FormEvent) {
    e.preventDefault();
    const titleTrim = posTitleDraft.trim();
    if (!titleTrim || !row) return;
    const budget = parseBudgetReachField(posBudgetDraft);
    addIntegrationPosition(row.id, {
      title: titleTrim,
      status: posStatusDraft,
      ...(posSocialDraft ? { socialNetworkId: posSocialDraft } : {}),
      ...(posContractorDraft ? { contractorId: posContractorDraft } : {}),
      ...(posCoopDraft === "barter" || posCoopDraft === "commercial" ? { cooperationType: posCoopDraft } : {}),
      ...(posEmployeeDraft ? { assignedEmployeeId: posEmployeeDraft } : {}),
      ...(posDateDraft.trim() ? { releaseDate: posDateDraft.trim() } : {}),
      ...(budget !== undefined ? { budget } : {}),
    });
    setPosTitleDraft("");
    setPosStatusDraft("draft");
    setPosSocialDraft("");
    setPosContractorDraft("");
    setPosCoopDraft("");
    setPosEmployeeDraft("");
    setPosDateDraft("");
    setPosBudgetDraft("");
    setIsAddPositionOpen(false);
  }

  const budgetLive = draftOrSaved(isEditOpen, budgetDraft, row.budget);
  const reachLive = draftOrSaved(isEditOpen, reachDraft, row.reach);
  const cpmRub = computeCpmRub(budgetLive, reachLive);
  const publicHref = integrationPublicLinkHref(row.publicLink);

  return (
    <div className="mx-auto w-full max-w-3xl space-y-8 pb-10">
      <BackLink href="/integrations" />

      <header className="flex flex-col gap-4 border-b border-app-fg/10 pb-6 sm:flex-row sm:items-end sm:justify-between">
        <div className="min-w-0 space-y-2">
          <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-app-fg/50">
            Интеграция
          </p>
          <div className="flex min-w-0 flex-wrap items-center gap-3">
            <h1 className="min-w-0 flex-1 text-balance text-xl font-semibold tracking-tight text-app-fg sm:text-2xl">
              {row.title}
            </h1>
            <CrmPill className={`${STATUS_BADGE_CLASS[row.status]} shrink-0`}>
              {INTEGRATION_STATUS_LABELS[row.status]}
            </CrmPill>
          </div>
          <p className="text-xs text-app-fg/50">
            Создана {formatRuDate(row.createdAt ?? "")} · {formatRuTime(row.createdAt ?? "")}
          </p>
        </div>
        {isAdmin ? (
          <button
            type="button"
            onClick={openEdit}
            className="inline-flex shrink-0 items-center justify-center gap-2 border border-app-fg/20 bg-app-fg/[0.04] px-4 py-2.5 text-xs font-semibold uppercase tracking-[0.12em] text-app-fg transition hover:border-app-accent/50 hover:bg-app-accent/10"
          >
            <Pencil className="h-3.5 w-3.5" strokeWidth={1.75} />
            Редактировать
          </button>
        ) : null}
      </header>

      <section className="space-y-4">
        <h2 className="text-[11px] font-semibold uppercase tracking-[0.18em] text-app-fg/45">
          Данные интеграции
        </h2>
        <div className="grid gap-3 sm:grid-cols-2">
          <InfoBlock label="Площадка">
            <CrmPill className={CHANNEL_BADGE_CLASS}>{socialLabel}</CrmPill>
          </InfoBlock>
          <InfoBlock label="Дата и время выхода">
            {formatIntegrationReleaseLine(row.releaseDate, row.releaseTime)}
          </InfoBlock>
          <InfoBlock label="Контрагент">
            {contractor ? (
              <span className="inline-flex flex-wrap items-center gap-2">
                <Link
                  href={`/contractors/${contractor.id}`}
                  className="font-medium text-app-fg transition"
                >
                  {contractor.name}
                </Link>
                <ContractorRatingBadge value={contractorRating10} />
              </span>
            ) : (
              <span className="text-app-fg/50">Не указан</span>
            )}
          </InfoBlock>
          <InfoBlock label="Ниша">
            {contractorNicheLabel ? (
              <span className="text-app-fg">{contractorNicheLabel}</span>
            ) : (
              <span className="text-app-fg/50">Не задана</span>
            )}
          </InfoBlock>
          <InfoBlock label="Категория">
            {contractor?.sizeCategory ? (
              <span className="text-app-fg">
                {CONTRACTOR_SIZE_CATEGORY_LABELS[contractor.sizeCategory]}
              </span>
            ) : (
              <span className="text-app-fg/50">Не задана</span>
            )}
          </InfoBlock>
          <InfoBlock label="Условия сотрудничества">
            {row.cooperationType ? (
              <span className="text-app-fg">
                {INTEGRATION_COOPERATION_LABELS[row.cooperationType]}
              </span>
            ) : (
              <span className="text-app-fg/50">Не указано</span>
            )}
          </InfoBlock>
          <InfoBlock label="Бюджет">
            <span className="tabular-nums">
              {budgetLive != null ? `${formatRuMoney(budgetLive)} ₽` : "—"}
            </span>
          </InfoBlock>
          <InfoBlock label="Охваты">
            <span className="tabular-nums">
              {reachLive != null ? nfReach.format(reachLive) : "—"}
            </span>
          </InfoBlock>
          <div className="grid min-w-0 grid-cols-2 gap-3 sm:col-span-2">
            <InfoBlock label="CPM" className="min-w-0">
              <span className="tabular-nums">
                {cpmRub != null ? `${formatRuCpm(cpmRub)} ₽ за 1000 охватов` : "—"}
              </span>
            </InfoBlock>
            <InfoBlock label="Сотрудник" className="min-w-0">
              {assignee ? (
                <span>
                  <span className="font-medium">{abbreviateFio(assignee.fullName)}</span>
                </span>
              ) : (
                <span className="text-app-fg/50">Не назначен</span>
              )}
            </InfoBlock>
          </div>
          <InfoBlock label="Ссылка на материал" className="sm:col-span-2">
            {row.publicLink?.trim() ? (
              publicHref ? (
                <a
                  href={publicHref}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="break-all font-mono text-[13px] text-app-fg transition"
                >
                  {row.publicLink.trim()}
                </a>
              ) : (
                <span className="break-all font-mono text-[13px] text-app-fg/80">{row.publicLink.trim()}</span>
              )
            ) : (
              <span className="text-app-fg/50">Не указана</span>
            )}
          </InfoBlock>
          <InfoBlock label="Комментарий" className="sm:col-span-2">
            {row.comment?.trim() || row.note?.trim() ? (
              <span className="whitespace-pre-wrap text-sm leading-relaxed text-app-fg">
                {(row.comment ?? row.note ?? "").trim()}
              </span>
            ) : (
              <span className="text-app-fg/50">Нет комментария</span>
            )}
          </InfoBlock>
        </div>
      </section>

      <section className="space-y-4">
        <div className="flex items-center justify-between gap-3">
          <h2 className="text-[11px] font-semibold uppercase tracking-[0.18em] text-app-fg/45">
            Позиции
          </h2>
          {isAdmin && (
            <button
              type="button"
              onClick={() => setIsAddPositionOpen((v) => !v)}
              className="inline-flex items-center gap-1.5 border border-app-fg/20 px-3 py-1.5 text-[11px] font-semibold uppercase tracking-wide text-app-fg transition hover:border-app-accent/50 hover:bg-app-accent/10"
            >
              <Plus className="h-3.5 w-3.5" strokeWidth={2} />
              {isAddPositionOpen ? "Отмена" : "Добавить"}
            </button>
          )}
        </div>

        {(row.positions ?? []).length === 0 && !isAddPositionOpen ? (
          <p className="border border-dashed border-app-fg/15 px-4 py-6 text-center text-sm text-app-fg/40">
            Позиций нет
          </p>
        ) : (
          <div className="space-y-2">
            {(row.positions ?? []).length > 0 && (
              <div className="overflow-x-auto">
                <table className="w-full min-w-[600px] border-separate border-spacing-0 text-left text-[11px] text-app-fg">
                  <thead>
                    <tr className="text-[10px] font-semibold uppercase tracking-wide text-app-fg/50">
                      <th className="border-b border-app-fg/10 px-3 py-2">Название</th>
                      <th className="border-b border-app-fg/10 px-3 py-2">Статус</th>
                      <th className="border-b border-app-fg/10 px-3 py-2">Площадка</th>
                      <th className="border-b border-app-fg/10 px-3 py-2">Дата</th>
                      <th className="border-b border-app-fg/10 px-3 py-2 text-right">Бюджет, ₽</th>
                      {isAdmin && <th className="border-b border-app-fg/10 px-3 py-2" />}
                    </tr>
                  </thead>
                  <tbody>
                    {(row.positions ?? []).map((pos) => {
                      const posContractor = contractors.find((c) => c.id === pos.contractorId);
                      const posSocial = socialOptions.find((o) => o.id === pos.socialNetworkId);
                      return (
                        <tr key={pos.id} className="border-t border-app-fg/8 hover:bg-app-fg/[0.02]">
                          <td className="px-3 py-2 font-medium">{pos.title}</td>
                          <td className="px-3 py-2">
                            <CrmPill className={STATUS_BADGE_CLASS[pos.status]}>
                              {INTEGRATION_STATUS_LABELS[pos.status]}
                            </CrmPill>
                          </td>
                          <td className="px-3 py-2 text-app-fg/70">{posSocial?.label ?? "—"}</td>
                          <td className="px-3 py-2 text-app-fg/70">{pos.releaseDate ? formatCalendarDate(pos.releaseDate) : "—"}</td>
                          <td className="px-3 py-2 text-right tabular-nums">
                            {pos.budget != null ? formatRuMoney(pos.budget) : "—"}
                          </td>
                          {isAdmin && (
                            <td className="px-3 py-2">
                              <button
                                type="button"
                                onClick={() => {
                                  if (!window.confirm(`Удалить позицию «${pos.title}»?`)) return;
                                  removeIntegrationPosition(row.id, pos.id);
                                }}
                                className="text-app-fg/30 transition hover:text-red-400"
                                aria-label="Удалить позицию"
                              >
                                <Trash2 className="h-3.5 w-3.5" strokeWidth={1.75} />
                              </button>
                            </td>
                          )}
                        </tr>
                      );
                    })}
                  </tbody>
                  {(row.positions ?? []).some((p) => p.budget != null) && (
                    <tfoot>
                      <tr className="border-t border-app-fg/15 font-semibold">
                        <td className="px-3 py-2 text-[10px] uppercase tracking-wide text-app-fg/55" colSpan={4}>
                          Итого
                        </td>
                        <td className="px-3 py-2 text-right tabular-nums">
                          {formatRuMoney((row.positions ?? []).reduce((s, p) => s + (p.budget ?? 0), 0))}
                        </td>
                        {isAdmin && <td />}
                      </tr>
                    </tfoot>
                  )}
                </table>
              </div>
            )}

            {isAdmin && isAddPositionOpen && (
              <form onSubmit={handleAddPosition} className="space-y-3 border border-app-fg/15 p-4">
                <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-app-fg/45">Новая позиция</p>
                <div className="grid gap-3 sm:grid-cols-2">
                  <div>
                    <label className="block text-[10px] uppercase tracking-wider text-app-fg/55">Название *</label>
                    <input
                      required
                      value={posTitleDraft}
                      onChange={(e) => setPosTitleDraft(e.target.value)}
                      placeholder="Название позиции"
                      className="mt-1 w-full border border-app-fg/15 bg-app-bg px-3 py-2 text-sm text-app-fg outline-none ring-app-accent/35 focus:ring-2"
                    />
                  </div>
                  <div>
                    <label className="block text-[10px] uppercase tracking-wider text-app-fg/55">Статус</label>
                    <select
                      value={posStatusDraft}
                      onChange={(e) => setPosStatusDraft(e.target.value as IntegrationStatus)}
                      className="mt-1 w-full border border-app-fg/15 bg-app-bg px-3 py-2 text-sm text-app-fg outline-none ring-app-accent/35 focus:ring-2"
                    >
                      {INTEGRATION_STATUSES.map((s) => (
                        <option key={s} value={s}>{INTEGRATION_STATUS_LABELS[s]}</option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="block text-[10px] uppercase tracking-wider text-app-fg/55">Площадка</label>
                    <select
                      value={posSocialDraft}
                      onChange={(e) => setPosSocialDraft(e.target.value)}
                      className="mt-1 w-full border border-app-fg/15 bg-app-bg px-3 py-2 text-sm text-app-fg outline-none ring-app-accent/35 focus:ring-2"
                    >
                      <option value="">— любая —</option>
                      {socialOptions.map((o) => (
                        <option key={o.id} value={o.id}>{o.label}</option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="block text-[10px] uppercase tracking-wider text-app-fg/55">Контрагент</label>
                    <select
                      value={posContractorDraft}
                      onChange={(e) => setPosContractorDraft(e.target.value)}
                      className="mt-1 w-full border border-app-fg/15 bg-app-bg px-3 py-2 text-sm text-app-fg outline-none ring-app-accent/35 focus:ring-2"
                    >
                      <option value="">— из интеграции —</option>
                      {contractors.map((c) => (
                        <option key={c.id} value={c.id}>{c.contactPerson?.trim() || c.name}</option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="block text-[10px] uppercase tracking-wider text-app-fg/55">Условия</label>
                    <select
                      value={posCoopDraft}
                      onChange={(e) => setPosCoopDraft(e.target.value as IntegrationCooperationType | "")}
                      className="mt-1 w-full border border-app-fg/15 bg-app-bg px-3 py-2 text-sm text-app-fg outline-none ring-app-accent/35 focus:ring-2"
                    >
                      <option value="">— не указаны —</option>
                      {INTEGRATION_COOPERATION_TYPES.map((t) => (
                        <option key={t} value={t}>{INTEGRATION_COOPERATION_LABELS[t]}</option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="block text-[10px] uppercase tracking-wider text-app-fg/55">Сотрудник</label>
                    <select
                      value={posEmployeeDraft}
                      onChange={(e) => setPosEmployeeDraft(e.target.value)}
                      className="mt-1 w-full border border-app-fg/15 bg-app-bg px-3 py-2 text-sm text-app-fg outline-none ring-app-accent/35 focus:ring-2"
                    >
                      <option value="">— не назначен —</option>
                      {employees.map((e) => (
                        <option key={e.id} value={e.id}>{e.fullName}</option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="block text-[10px] uppercase tracking-wider text-app-fg/55">Дата (ГГГГ-ММ-ДД)</label>
                    <input
                      type="date"
                      value={posDateDraft}
                      onChange={(e) => setPosDateDraft(e.target.value)}
                      className="mt-1 w-full border border-app-fg/15 bg-app-bg px-3 py-2 text-sm text-app-fg outline-none ring-app-accent/35 focus:ring-2"
                    />
                  </div>
                  <div>
                    <label className="block text-[10px] uppercase tracking-wider text-app-fg/55">Бюджет, ₽</label>
                    <input
                      type="text"
                      value={posBudgetDraft}
                      onChange={(e) => setPosBudgetDraft(e.target.value)}
                      placeholder="0"
                      className="mt-1 w-full border border-app-fg/15 bg-app-bg px-3 py-2 text-sm text-app-fg outline-none ring-app-accent/35 focus:ring-2"
                    />
                  </div>
                </div>
                <div className="flex gap-2">
                  <button
                    type="submit"
                    className="border border-app-fg/20 bg-app-fg/[0.04] px-4 py-2 text-xs font-semibold uppercase tracking-wide text-app-fg transition hover:border-app-accent/50 hover:bg-app-accent/10"
                  >
                    Добавить
                  </button>
                  <button
                    type="button"
                    onClick={() => setIsAddPositionOpen(false)}
                    className="border border-app-fg/15 px-4 py-2 text-xs font-semibold uppercase tracking-wide text-app-fg/60 transition hover:border-app-fg/30"
                  >
                    Отмена
                  </button>
                </div>
              </form>
            )}
          </div>
        )}
      </section>

      {isAdmin && isEditOpen ? (
        <div className={overlayClass} role="presentation" onClick={closeEdit}>
          <div
            role="dialog"
            aria-modal="true"
            aria-labelledby="integration-edit-title"
            className={modalShellClass}
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex shrink-0 items-start justify-between gap-3 border-b border-app-fg/15 px-5 py-4 sm:px-6">
              <div>
                <p
                  id="integration-edit-title"
                  className="text-sm font-semibold uppercase tracking-[0.12em] text-app-fg"
                >
                  Редактирование
                </p>
                <p className="mt-1 max-w-[280px] text-xs leading-relaxed text-app-fg/50">
                  Изменения сохраняются в карточке после нажатия «Сохранить».
                </p>
              </div>
              <button
                type="button"
                onClick={closeEdit}
                className="border border-app-fg/15 p-2 text-app-fg/65 transition hover:border-app-fg/35"
                aria-label="Закрыть"
              >
                <X className="h-4 w-4" strokeWidth={1.5} />
              </button>
            </div>

            <div className="min-h-0 flex-1 overflow-y-auto px-5 py-5 sm:px-6">
              <div className="space-y-4">
                <div>
                  <label className="block text-xs uppercase tracking-wider text-app-fg/55">
                    Заголовок в списке
                    <input
                      value={titleDraft}
                      onChange={(e) => {
                        setTitleDraft(e.target.value);
                        setTitleError(null);
                        setSaveError(null);
                      }}
                      required
                      placeholder="Уникальное название"
                      className={`${selectClass} mt-1`}
                    />
                  </label>
                  {titleError ? (
                    <p className="mt-1.5 text-xs text-app-fg/80">{titleError}</p>
                  ) : null}
                </div>

                <div className="grid gap-3 sm:grid-cols-2">
                  <label className="text-xs uppercase tracking-wider text-app-fg/55">
                    Статус интеграции
                    <select
                      value={statusDraft}
                      onChange={(e) => {
                        setStatusDraft(e.target.value as IntegrationStatus);
                        setSaveError(null);
                      }}
                      className={`${selectClass} mt-1`}
                    >
                      {INTEGRATION_STATUSES.map((s) => (
                        <option key={s} value={s}>
                          {INTEGRATION_STATUS_LABELS[s]}
                        </option>
                      ))}
                    </select>
                  </label>
                  <label className="text-xs uppercase tracking-wider text-app-fg/55">
                    Соцсеть
                    <select
                      value={socialDraft}
                      onChange={(e) => {
                        setSocialDraft(e.target.value);
                        setSaveError(null);
                      }}
                      className={`${selectClass} mt-1`}
                    >
                      {socialOptions.map((o) => (
                        <option key={o.id} value={o.id}>
                          {o.label}
                        </option>
                      ))}
                    </select>
                  </label>
                </div>

                <div>
                  <p className="mb-2 text-xs uppercase tracking-wider text-app-fg/55">Контрагент</p>
                  <button
                    type="button"
                    onClick={() => setIsContractorPickerOpen(true)}
                    className="w-full border border-app-fg/15 bg-app-bg px-3 py-2.5 text-left text-sm text-app-fg outline-none ring-app-accent/35 transition hover:border-app-fg/40"
                  >
                    {(() => {
                      const selected = contractors.find((c) => c.id === contractorDraft);
                      if (!selected) return "Выбрать контрагента";
                      return `${(selected.contactPerson?.trim() || selected.name).toUpperCase()} · ${selected.name}`;
                    })()}
                  </button>
                </div>

                <label className="block text-xs uppercase tracking-wider text-app-fg/55">
                  Условия сотрудничества
                  <select
                    value={cooperationDraft}
                    onChange={(e) => {
                      setCooperationDraft(
                        (e.target.value as IntegrationCooperationType | "") || "",
                      );
                      setSaveError(null);
                    }}
                    className={`${selectClass} mt-1`}
                  >
                    <option value="">Не указано</option>
                    <option value="barter">Бартер</option>
                    <option value="commercial">Коммерция</option>
                  </select>
                </label>

                <div>
                  <label className="text-xs uppercase tracking-wider text-app-fg/55">
                    Закреплённый сотрудник
                    <select
                      value={assignedDraft}
                      onChange={(e) => {
                        setAssignedDraft(e.target.value.trim());
                        setSaveError(null);
                      }}
                      className={`${selectClass} mt-1`}
                    >
                      <option value="">Не назначен</option>
                      {employees.map((em) => (
                        <option key={em.id} value={em.id}>
                          {abbreviateFio(em.fullName)}
                        </option>
                      ))}
                    </select>
                  </label>
                </div>

                <div className="grid gap-3 sm:grid-cols-2">
                  <label className="block text-xs uppercase tracking-wider text-app-fg/55">
                    Дата выхода
                    <input
                      type="date"
                      value={releaseDateDraft}
                      onChange={(e) => {
                        setReleaseDateDraft(e.target.value);
                        setSaveError(null);
                      }}
                      className={`${selectClass} mt-1`}
                    />
                  </label>
                  <label className="block text-xs uppercase tracking-wider text-app-fg/55">
                    Время выхода
                    <input
                      type="time"
                      value={releaseTimeDraft}
                      onChange={(e) => {
                        setReleaseTimeDraft(e.target.value);
                        setSaveError(null);
                      }}
                      className={`${selectClass} mt-1`}
                    />
                  </label>
                </div>
                <p className="text-xs leading-relaxed text-app-fg/45">
                  Если заданы дата и время выхода и закреплённый сотрудник, после наступления этого
                  момента ему появится задача проверить публикацию (раздел «Задачи»).
                </p>

                <div className="grid gap-3 sm:grid-cols-2">
                  <label className="block text-xs uppercase tracking-wider text-app-fg/55">
                    Бюджет, ₽
                    <input
                      type="text"
                      inputMode="decimal"
                      autoComplete="off"
                      value={budgetDraft}
                      onChange={(e) => {
                        setBudgetDraft(e.target.value);
                        setSaveError(null);
                      }}
                      placeholder="0"
                      className={`${selectClass} mt-1 tabular-nums`}
                    />
                  </label>
                  <label className="block text-xs uppercase tracking-wider text-app-fg/55">
                    Охваты
                    <input
                      type="text"
                      inputMode="decimal"
                      autoComplete="off"
                      value={reachDraft}
                      onChange={(e) => {
                        setReachDraft(e.target.value);
                        setSaveError(null);
                      }}
                      placeholder="0"
                      className={`${selectClass} mt-1 tabular-nums`}
                    />
                  </label>
                  <label className="block text-xs uppercase tracking-wider text-app-fg/55 sm:col-span-2">
                    Ссылка на интеграцию
                    <input
                      type="url"
                      inputMode="url"
                      autoComplete="url"
                      value={linkDraft}
                      onChange={(e) => {
                        setLinkDraft(e.target.value);
                        setSaveError(null);
                      }}
                      placeholder="https://… или youtube.com/…"
                      className={`${selectClass} mt-1 font-mono text-[13px]`}
                    />
                  </label>
                  <label className="block text-xs uppercase tracking-wider text-app-fg/55 sm:col-span-2">
                    Комментарий
                    <textarea
                      value={commentDraft}
                      onChange={(e) => {
                        setCommentDraft(e.target.value);
                        setSaveError(null);
                      }}
                      placeholder="Внутренние пометки по интеграции…"
                      rows={5}
                      className={`${textareaClass} mt-1`}
                    />
                  </label>
                </div>

                {saveError ? (
                  <p className="border border-app-fg/20 bg-app-fg/5 px-3 py-2 text-xs text-app-fg/90">
                    {saveError}
                  </p>
                ) : null}
              </div>
            </div>

            <div className="flex shrink-0 flex-col gap-2 border-t border-app-fg/15 bg-app-fg/[0.02] px-5 py-4 sm:flex-row sm:items-center sm:justify-between sm:px-6">
              <button
                type="button"
                onClick={handleDelete}
                className="inline-flex items-center justify-center gap-2 border border-app-fg/15 px-4 py-2.5 text-xs font-medium text-app-fg/75 transition hover:border-red-500/40 hover:bg-red-500/5 sm:order-2"
              >
                <Trash2 className="h-3.5 w-3.5" strokeWidth={1.5} />
                Удалить
              </button>
              <div className="flex flex-col gap-2 sm:flex-row sm:gap-3">
                <button
                  type="button"
                  onClick={closeEdit}
                  className="inline-flex items-center justify-center border border-app-fg/20 px-4 py-2.5 text-xs font-semibold uppercase tracking-wide text-app-fg/80 transition hover:border-app-fg/40"
                >
                  Отмена
                </button>
                <button
                  type="button"
                  onClick={handleSave}
                  className="inline-flex items-center justify-center gap-2 bg-app-accent px-5 py-2.5 text-xs font-semibold uppercase tracking-wide text-app-fg transition hover:brightness-125"
                >
                  <Save className="h-3.5 w-3.5" strokeWidth={1.75} />
                  Сохранить
                </button>
              </div>
            </div>
          </div>
        </div>
      ) : null}

      <ContractorListModal
        open={isContractorPickerOpen}
        onClose={() => setIsContractorPickerOpen(false)}
        contractors={contractors}
        zIndexClass="z-[70]"
        onPick={(id) => {
          setContractorDraft(id);
          setSaveError(null);
        }}
      />
    </div>
  );
}

function BackLink({ href }: { href: string }) {
  return (
    <Link
      href={href}
      className="inline-flex items-center gap-2 text-sm text-app-fg/55 transition"
    >
      <ArrowLeft className="h-4 w-4 shrink-0" strokeWidth={1.5} />
      Назад к списку
    </Link>
  );
}
