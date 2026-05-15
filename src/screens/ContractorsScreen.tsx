"use client";

import { Suspense, useCallback, useEffect, useMemo, useState, type FormEvent } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { ChevronDown, Plus, Search, Trash2, X } from "lucide-react";
import { usePanelData } from "@/context/PanelDataContext";
import { ContractorRatingBadge } from "@/components/ContractorRatingBadge";
import { SortableTh } from "@/components/SortableTh";
import { FilterChips, HorizontalScrollTable, SlideOver, type FilterChip } from "@/components/ui";
import { ContractorDetailScreen } from "@/screens/ContractorDetailScreen";
import { computeContractorRating10 } from "@/lib/contractor-rating";
import { useTableSort } from "@/hooks/useTableSort";
import { nicheChoiceCaption } from "@/lib/niche-display";
import { compareNumbers, compareStringsRu } from "@/lib/table-sort";
import { createPanelId } from "@/lib/id";
import {
  integrationPublicLinkHref,
  normalizeIntegrationPublicLink,
} from "@/lib/integration-link";
import { downloadUtf8Csv, rowsToCsv } from "@/lib/csv-export";
import {
  CONTRACTOR_SIZE_CATEGORY_LABELS,
  CONTRACTOR_SIZE_CATEGORIES,
  CONTRACTOR_STATUS_LABELS,
  type ContractorStatus,
  type Integration,
} from "@/types/panel-data";
import {
  crmPageHeaderRowClass,
  crmPageTitleClass,
  primaryActionButtonClass,
  selectNativeChevronPad,
  tableBodyRowBorderClass,
  tableHeadRowBorderClass,
} from "@/screens/dashboard-shared";

type ContractorSortKey =
  | "status"
  | "name"
  | "rating"
  | "integrations"
  | "virality"
  | "niche"
  | "sizeCategory";

type CreateLinkDraft = { rowId: string; socialNetworkId: string; url: string };

export function ContractorsScreen() {
  return (
    <Suspense
      fallback={
        <p className="px-4 py-8 text-sm text-app-fg/55">Загрузка контрагентов…</p>
      }
    >
      <ContractorsScreenInner />
    </Suspense>
  );
}

function ContractorsScreenInner() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const selectedId = searchParams.get("id");
  const { sort, toggleSort, sortKey, sortDir } = useTableSort<ContractorSortKey>();
  const {
    contractors,
    integrations,
    contractorItems,
    nicheOptions,
    socialOptions,
    isAdmin,
    canWriteCore,
    addContractor,
    updateContractor,
  } = usePanelData();
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [highlightId, setHighlightId] = useState<string | null>(null);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(() => new Set());
  const [tableHovered, setTableHovered] = useState(false);
  const [bulkStatusOpen, setBulkStatusOpen] = useState(false);
  const [fullName, setFullName] = useState("");
  const [nickname, setNickname] = useState("");
  const [cityInput, setCityInput] = useState("");
  const [promoCodeInput, setPromoCodeInput] = useState("");
  const [viralityInput, setViralityInput] = useState("");
  const [nicheIdInput, setNicheIdInput] = useState("");
  const [sizeCategoryInput, setSizeCategoryInput] = useState<string>("");
  const [linkDrafts, setLinkDrafts] = useState<CreateLinkDraft[]>([]);
  const [tableSearch, setTableSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<"all" | "active" | "paused">("all");
  const [mobileFiltersOpen, setMobileFiltersOpen] = useState(false);

  const integrationCountByContractor = useMemo(() => {
    const map = new Map<string, number>();
    for (const row of integrations) {
      map.set(row.contractorId, (map.get(row.contractorId) ?? 0) + 1);
    }
    return map;
  }, [integrations]);

  const rating10ByContractorId = useMemo(() => {
    const intsByContractor = new Map<string, Integration[]>();
    for (const i of integrations) {
      const arr = intsByContractor.get(i.contractorId) ?? [];
      arr.push(i);
      intsByContractor.set(i.contractorId, arr);
    }
    const nItemsByContractor = new Map<string, number>();
    for (const it of contractorItems) {
      nItemsByContractor.set(it.contractorId, (nItemsByContractor.get(it.contractorId) ?? 0) + 1);
    }
    const map = new Map<string, number>();
    for (const c of contractors) {
      const ints = intsByContractor.get(c.id) ?? [];
      const nItems = nItemsByContractor.get(c.id) ?? 0;
      map.set(c.id, computeContractorRating10(ints, nItems));
    }
    return map;
  }, [contractors, integrations, contractorItems]);

  function openCreateModal() {
    setLinkDrafts(
      socialOptions.length > 0
        ? [
            {
              rowId: createPanelId(),
              socialNetworkId: socialOptions[0].id,
              url: "",
            },
          ]
        : [],
    );
    setIsCreateOpen(true);
  }

  function addLinkDraftRow() {
    const first = socialOptions[0]?.id ?? "";
    setLinkDrafts((prev) => [
      ...prev,
      { rowId: createPanelId(), socialNetworkId: first, url: "" },
    ]);
  }

  function removeLinkDraftRow(rowId: string) {
    setLinkDrafts((prev) => prev.filter((r) => r.rowId !== rowId));
  }

  function updateLinkDraft(rowId: string, patch: Partial<Pick<CreateLinkDraft, "socialNetworkId" | "url">>) {
    setLinkDrafts((prev) =>
      prev.map((r) => (r.rowId === rowId ? { ...r, ...patch } : r)),
    );
  }

  function handleAdd(e: FormEvent) {
    e.preventDefault();
    if (!fullName.trim() || !nickname.trim()) return;
    const hasSize =
      sizeCategoryInput === "micro" ||
      sizeCategoryInput === "middle" ||
      sizeCategoryInput === "large";
    const initialLinks = linkDrafts
      .map((row) => {
        const label =
          socialOptions.find((o) => o.id === row.socialNetworkId)?.label?.trim() || "Ссылка";
        const raw = normalizeIntegrationPublicLink(row.url);
        if (!raw || !integrationPublicLinkHref(raw)) return null;
        return { title: label, url: raw };
      })
      .filter((x): x is { title: string; url: string } => x !== null);
    const id = addContractor({
      name: nickname,
      contactPerson: fullName,
      ...(cityInput.trim() ? { city: cityInput.trim() } : {}),
      ...(promoCodeInput.trim() ? { promoCode: promoCodeInput.trim() } : {}),
      ...(viralityInput.trim() ? { virality: viralityInput.trim() } : {}),
      ...(nicheIdInput.trim() ? { nicheId: nicheIdInput.trim() } : {}),
      ...(hasSize ? { sizeCategory: sizeCategoryInput } : {}),
      ...(initialLinks.length > 0 ? { initialLinks } : {}),
    });
    setFullName("");
    setNickname("");
    setCityInput("");
    setPromoCodeInput("");
    setViralityInput("");
    setNicheIdInput("");
    setSizeCategoryInput("");
    setLinkDrafts([]);
    setIsCreateOpen(false);
    if (id) setHighlightId(id);
  }

  useEffect(() => {
    if (!highlightId) return;
    const t = window.setTimeout(() => setHighlightId(null), 2000);
    return () => window.clearTimeout(t);
  }, [highlightId]);

  const closeDetail = useCallback(() => {
    const next = new URLSearchParams(searchParams.toString());
    next.delete("id");
    const q = next.toString();
    router.push(q ? `/contractors?${q}` : "/contractors", { scroll: false });
  }, [router, searchParams]);

  function openRow(id: string) {
    const next = new URLSearchParams(searchParams.toString());
    next.set("id", id);
    router.push(`/contractors?${next.toString()}`, { scroll: false });
  }

  const showBulkColumn = tableHovered || selectedIds.size > 0;

  function toggleSelected(id: string) {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function handleBulkStatus(status: ContractorStatus) {
    for (const id of Array.from(selectedIds)) {
      updateContractor(id, { status });
    }
    setBulkStatusOpen(false);
    setSelectedIds(new Set());
  }

  function handleExportSelected() {
    const rows = contractors.filter((c) => selectedIds.has(c.id));
    const header = [
      "ID",
      "Статус",
      "Контактное лицо",
      "Никнейм",
      "Город",
      "Вирусность",
      "Ниша",
      "Категория",
      "Интеграций",
    ];
    const body = rows.map((c) => {
      const contractorStatus: ContractorStatus = c.status === "paused" ? "paused" : "active";
      const nicheLabel = c.nicheId
        ? nicheChoiceCaption(nicheOptions.find((n) => n.id === c.nicheId)?.label ?? "")
        : "";
      return [
        c.id,
        CONTRACTOR_STATUS_LABELS[contractorStatus],
        c.contactPerson?.trim() || "",
        c.name ?? "",
        c.city?.trim() ?? "",
        c.virality?.trim() ?? "",
        nicheLabel,
        c.sizeCategory ? CONTRACTOR_SIZE_CATEGORY_LABELS[c.sizeCategory] : "",
        String(integrationCountByContractor.get(c.id) ?? 0),
      ];
    });
    downloadUtf8Csv(
      `contractors-${new Date().toISOString().slice(0, 10)}.csv`,
      rowsToCsv(header, body),
    );
  }

  const filterChips = useMemo((): FilterChip[] => {
    const chips: FilterChip[] = [];
    const q = tableSearch.trim();
    if (q) {
      chips.push({
        id: "search",
        label: `Поиск: ${q}`,
        onRemove: () => setTableSearch(""),
      });
    }
    if (statusFilter !== "all") {
      chips.push({
        id: "status",
        label: CONTRACTOR_STATUS_LABELS[statusFilter],
        onRemove: () => setStatusFilter("all"),
      });
    }
    return chips;
  }, [tableSearch, statusFilter]);

  const filteredContractors = useMemo(() => {
    return contractors.filter((c) => {
      const contractorStatus = c.status === "paused" ? "paused" : "active";
      if (statusFilter !== "all" && contractorStatus !== statusFilter) return false;
      const q = tableSearch.trim().toLowerCase();
      if (!q) return true;
      const hay = [
        c.name ?? "",
        c.contactPerson ?? "",
        c.city ?? "",
        c.virality ?? "",
        c.nicheId
          ? (() => {
              const raw = nicheOptions.find((n) => n.id === c.nicheId)?.label ?? "";
              return raw ? `${raw} ${nicheChoiceCaption(raw)}` : "";
            })()
          : "",
        c.sizeCategory ? CONTRACTOR_SIZE_CATEGORY_LABELS[c.sizeCategory] : "",
        CONTRACTOR_STATUS_LABELS[contractorStatus],
        String(integrationCountByContractor.get(c.id) ?? 0),
      ]
        .join(" ")
        .toLowerCase();
      return hay.includes(q);
    });
  }, [contractors, tableSearch, statusFilter, integrationCountByContractor, nicheOptions]);

  const sortedContractors = useMemo(() => {
    const rows = [...filteredContractors];
    if (!sort) return rows;
    const m = sort.dir === "asc" ? 1 : -1;
    rows.sort((a, b) => {
      let cmp = 0;
      const sa = a.status === "paused" ? "paused" : "active";
      const sb = b.status === "paused" ? "paused" : "active";
      switch (sort.key) {
        case "status":
          cmp = compareStringsRu(
            CONTRACTOR_STATUS_LABELS[sa],
            CONTRACTOR_STATUS_LABELS[sb],
          );
          break;
        case "name":
          cmp = compareStringsRu(
            a.contactPerson?.trim() || a.name,
            b.contactPerson?.trim() || b.name,
          );
          break;
        case "rating": {
          const ra = rating10ByContractorId.get(a.id) ?? 5;
          const rb = rating10ByContractorId.get(b.id) ?? 5;
          cmp = compareNumbers(ra, rb);
          break;
        }
        case "integrations":
          cmp = compareNumbers(
            integrationCountByContractor.get(a.id) ?? 0,
            integrationCountByContractor.get(b.id) ?? 0,
          );
          break;
        case "virality":
          cmp = compareStringsRu(a.virality?.trim() ?? "", b.virality?.trim() ?? "");
          break;
        case "niche": {
          const la = nicheChoiceCaption(
            nicheOptions.find((n) => n.id === a.nicheId)?.label ?? "",
          );
          const lb = nicheChoiceCaption(
            nicheOptions.find((n) => n.id === b.nicheId)?.label ?? "",
          );
          cmp = compareStringsRu(la, lb);
          break;
        }
        case "sizeCategory": {
          const la = a.sizeCategory ? CONTRACTOR_SIZE_CATEGORY_LABELS[a.sizeCategory] : "";
          const lb = b.sizeCategory ? CONTRACTOR_SIZE_CATEGORY_LABELS[b.sizeCategory] : "";
          cmp = compareStringsRu(la, lb);
          break;
        }
        default:
          break;
      }
      if (cmp !== 0) return m * cmp;
      return compareStringsRu(a.id, b.id);
    });
    return rows;
  }, [
    filteredContractors,
    sort,
    rating10ByContractorId,
    integrationCountByContractor,
    nicheOptions,
  ]);

  const onContractorSort = (key: string) => toggleSort(key as ContractorSortKey);

  const filterField = `min-h-[42px] w-full border border-app-fg/15 bg-app-bg px-3 py-2.5 text-[11px] text-app-fg outline-none ring-app-accent/35 focus:ring-2 ${selectNativeChevronPad}`;

  return (
    <div className="w-full max-w-full space-y-4">
      <div className={crmPageHeaderRowClass}>
        <h1 className={crmPageTitleClass}>Контрагенты</h1>
        {canWriteCore && (
          <button
            type="button"
            onClick={openCreateModal}
            className={`${primaryActionButtonClass} max-md:hidden`}
          >
            <Plus className="h-4 w-4" strokeWidth={1.5} />
            Создать контрагента
          </button>
        )}
      </div>

      {contractors.length > 0 && (
        <div className="flex flex-col gap-2">
          <label className="relative min-w-0">
            <Search
              className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-app-fg/35"
              aria-hidden
            />
            <input
              type="search"
              value={tableSearch}
              onChange={(e) => setTableSearch(e.target.value)}
              placeholder="Поиск по контактному лицу, нику, вирусности, статусу, числу интеграций…"
              className="w-full border border-app-fg/15 bg-app-bg py-2.5 pl-9 pr-3 text-xs text-app-fg outline-none ring-app-accent/35 focus:ring-2"
              aria-label="Поиск в таблице"
            />
          </label>
          <button
            type="button"
            onClick={() => setMobileFiltersOpen(true)}
            className="flex w-full min-h-[44px] items-center justify-between gap-2 border border-app-fg/15 bg-app-bg px-3 py-2.5 text-left text-xs font-semibold uppercase tracking-wide text-app-fg transition hover:border-app-fg/30 md:hidden"
          >
            <span>Фильтры</span>
            <ChevronDown className="h-4 w-4 shrink-0 text-app-fg/50" strokeWidth={2} aria-hidden />
          </button>
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value as "all" | "active" | "paused")}
            aria-label="Фильтр по статусу"
            className={`${filterField} hidden md:block`}
          >
            <option value="all">Все статусы</option>
            <option value="active">{CONTRACTOR_STATUS_LABELS.active}</option>
            <option value="paused">{CONTRACTOR_STATUS_LABELS.paused}</option>
          </select>
        </div>
      )}

      {mobileFiltersOpen && contractors.length > 0 ? (
        <div
          className="fixed inset-0 z-40 flex flex-col bg-app-bg md:hidden"
          role="dialog"
          aria-modal="true"
          aria-label="Фильтры"
        >
          <div className="flex items-center justify-between border-b border-app-fg/10 px-4 py-3">
            <h2 className="text-sm font-semibold uppercase tracking-wide text-app-fg">Фильтры</h2>
            <button
              type="button"
              onClick={() => setMobileFiltersOpen(false)}
              className="inline-flex min-h-[44px] min-w-[44px] items-center justify-center text-app-fg/60 transition hover:text-app-fg"
              aria-label="Закрыть"
            >
              <X className="h-5 w-5" strokeWidth={1.5} />
            </button>
          </div>
          <div className="flex flex-1 flex-col gap-2 overflow-y-auto p-4">
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value as "all" | "active" | "paused")}
              aria-label="Фильтр по статусу"
              className={filterField}
            >
              <option value="all">Все статусы</option>
              <option value="active">{CONTRACTOR_STATUS_LABELS.active}</option>
              <option value="paused">{CONTRACTOR_STATUS_LABELS.paused}</option>
            </select>
          </div>
          <div className="border-t border-app-fg/10 p-4 pb-safe">
            <button
              type="button"
              onClick={() => setMobileFiltersOpen(false)}
              className="w-full min-h-[48px] bg-app-accent text-xs font-semibold uppercase tracking-wide text-app-fg transition hover:brightness-125"
            >
              Применить
            </button>
          </div>
        </div>
      ) : null}

      <FilterChips chips={filterChips} />

      {selectedIds.size > 0 ? (
        <div className="flex flex-wrap items-center gap-2 border border-app-fg/15 bg-app-fg/[0.03] px-3 py-2">
          <span className="text-xs font-semibold uppercase tracking-wide text-app-fg/70">
            Выбрано: {selectedIds.size}
          </span>
          {isAdmin ? (
            <div className="relative">
              <button
                type="button"
                onClick={() => setBulkStatusOpen((o) => !o)}
                className="border border-app-fg/15 px-3 py-1.5 text-[11px] font-semibold uppercase tracking-wide text-app-fg transition hover:border-app-fg/35"
              >
                Изменить статус
              </button>
              {bulkStatusOpen ? (
                <ul className="absolute left-0 top-full z-20 mt-1 min-w-[10rem] border border-app-fg/15 bg-app-bg py-1 shadow-lg">
                  {(["active", "paused"] as const).map((s) => (
                    <li key={s}>
                      <button
                        type="button"
                        className="w-full px-3 py-2 text-left text-[11px] font-semibold uppercase tracking-wide text-app-fg/80 hover:bg-app-fg/[0.06]"
                        onClick={() => handleBulkStatus(s)}
                      >
                        {CONTRACTOR_STATUS_LABELS[s]}
                      </button>
                    </li>
                  ))}
                </ul>
              ) : null}
            </div>
          ) : null}
          <button
            type="button"
            onClick={handleExportSelected}
            className="border border-app-fg/15 px-3 py-1.5 text-[11px] font-semibold uppercase tracking-wide text-app-fg transition hover:border-app-fg/35"
          >
            Экспорт CSV
          </button>
        </div>
      ) : null}

      {contractors.length > 0 && filteredContractors.length === 0 && (
        <p className="border border-dashed border-app-fg/15 px-4 py-8 text-center text-sm text-app-fg/55">
          Нет строк по текущему фильтру.
        </p>
      )}

      {contractors.length > 0 && filteredContractors.length > 0 && (
        <HorizontalScrollTable
          scrollProps={{
            onMouseEnter: () => setTableHovered(true),
            onMouseLeave: () => setTableHovered(false),
          }}
        >
          <table className="w-full min-w-[1100px] border-separate border-spacing-0 text-left text-[11px] leading-tight text-app-fg sm:text-xs">
            <thead>
              <tr
                className={`bg-app-bg text-[10px] font-semibold uppercase tracking-wide text-app-fg/50 ${tableHeadRowBorderClass}`}
              >
                {showBulkColumn ? (
                  <th className="w-8 px-1 py-2.5 align-middle" aria-label="Выбор" />
                ) : null}
                <SortableTh
                  columnKey="status"
                  sortKey={sortKey}
                  sortDir={sortDir}
                  onSort={onContractorSort}
                  className="w-[130px] px-4 py-2.5"
                >
                  Статус
                </SortableTh>
                <SortableTh
                  columnKey="name"
                  sortKey={sortKey}
                  sortDir={sortDir}
                  onSort={onContractorSort}
                  className="min-w-[200px] px-4 py-2.5"
                >
                  Контактное лицо
                </SortableTh>
                <SortableTh
                  columnKey="rating"
                  sortKey={sortKey}
                  sortDir={sortDir}
                  onSort={onContractorSort}
                  className="w-[110px] px-4 py-2.5"
                >
                  Рейтинг
                </SortableTh>
                <SortableTh
                  columnKey="virality"
                  sortKey={sortKey}
                  sortDir={sortDir}
                  onSort={onContractorSort}
                  className="min-w-[140px] px-4 py-2.5"
                >
                  Вирусность
                </SortableTh>
                <SortableTh
                  columnKey="niche"
                  sortKey={sortKey}
                  sortDir={sortDir}
                  onSort={onContractorSort}
                  className="min-w-[120px] px-4 py-2.5"
                >
                  Ниша
                </SortableTh>
                <SortableTh
                  columnKey="sizeCategory"
                  sortKey={sortKey}
                  sortDir={sortDir}
                  onSort={onContractorSort}
                  className="w-[100px] px-4 py-2.5"
                >
                  Категория
                </SortableTh>
                <SortableTh
                  columnKey="integrations"
                  sortKey={sortKey}
                  sortDir={sortDir}
                  onSort={onContractorSort}
                  align="right"
                  className="w-[120px] px-4 py-2.5 tabular-nums"
                >
                  Интеграций
                </SortableTh>
              </tr>
            </thead>
            <tbody>
              {sortedContractors.map((c) => {
                const contractorStatus = c.status === "paused" ? "paused" : "active";
                const rating10 = rating10ByContractorId.get(c.id) ?? 5;
                const isSelected = selectedIds.has(c.id);
                const isHighlighted = highlightId === c.id;
                return (
                  <tr
                    key={c.id}
                    role="button"
                    tabIndex={0}
                    onClick={() => openRow(c.id)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter" || e.key === " ") {
                        e.preventDefault();
                        openRow(c.id);
                      }
                    }}
                    className={`cursor-pointer transition hover:bg-app-fg/[0.04] ${tableBodyRowBorderClass} ${
                      isHighlighted ? "bg-app-accent/10" : ""
                    } ${isSelected ? "bg-app-fg/[0.06]" : ""}`}
                  >
                    {showBulkColumn ? (
                      <td
                        className="w-8 px-1 py-2.5 align-middle"
                        onClick={(e) => e.stopPropagation()}
                      >
                        <input
                          type="checkbox"
                          checked={isSelected}
                          onChange={() => toggleSelected(c.id)}
                          aria-label={`Выбрать ${c.contactPerson?.trim() || c.name}`}
                          className="h-3.5 w-3.5 accent-app-accent"
                        />
                      </td>
                    ) : null}
                    <td className="px-4 py-2.5 align-middle">
                      <span
                        className={
                          contractorStatus === "active"
                            ? "inline-flex border border-transparent bg-app-accent px-2 py-1 text-[10px] font-semibold uppercase tracking-wide text-app-fg"
                            : "inline-flex border border-transparent bg-app-fg/[0.1] px-2 py-1 text-[10px] font-semibold uppercase tracking-wide text-app-fg/72"
                        }
                      >
                        {CONTRACTOR_STATUS_LABELS[contractorStatus]}
                      </span>
                    </td>
                    <td className="px-4 py-2.5 align-middle font-medium text-app-fg">
                      {c.contactPerson?.trim() || c.name}
                    </td>
                    <td className="px-4 py-2.5 align-middle">
                      <ContractorRatingBadge value={rating10} />
                    </td>
                    <td className="px-4 py-2.5 align-middle text-app-fg/85">
                      {c.virality?.trim() ? (
                        <span className="line-clamp-2">{c.virality.trim()}</span>
                      ) : (
                        <span className="text-app-fg/40">—</span>
                      )}
                    </td>
                    <td className="px-4 py-2.5 align-middle text-app-fg/85">
                      {c.nicheId ? (
                        <span className="line-clamp-2">
                          {nicheChoiceCaption(
                            nicheOptions.find((n) => n.id === c.nicheId)?.label ?? "—",
                          )}
                        </span>
                      ) : (
                        <span className="text-app-fg/40">—</span>
                      )}
                    </td>
                    <td className="px-4 py-2.5 align-middle text-app-fg/85">
                      {c.sizeCategory ? (
                        CONTRACTOR_SIZE_CATEGORY_LABELS[c.sizeCategory]
                      ) : (
                        <span className="text-app-fg/40">—</span>
                      )}
                    </td>
                    <td className="px-4 py-2.5 text-right align-middle tabular-nums text-app-fg">
                      {integrationCountByContractor.get(c.id) ?? 0}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </HorizontalScrollTable>
      )}

      {contractors.length === 0 && (
        <div className="flex flex-col items-center gap-4 border border-dashed border-app-fg/15 px-4 py-12 text-center">
          <p className="text-sm text-app-fg/55">Контрагентов пока нет.</p>
          {canWriteCore ? (
            <button type="button" onClick={openCreateModal} className={primaryActionButtonClass}>
              <Plus className="h-4 w-4" strokeWidth={1.5} />
              Создать первого контрагента
            </button>
          ) : null}
        </div>
      )}

      {canWriteCore ? (
        <button
          type="button"
          onClick={openCreateModal}
          className="fixed bottom-[4.5rem] right-4 z-40 flex h-14 w-14 items-center justify-center rounded-full bg-app-accent text-app-fg shadow-lg transition hover:brightness-125 md:hidden"
          aria-label="Создать контрагента"
        >
          <Plus className="h-6 w-6" strokeWidth={1.5} />
        </button>
      ) : null}

      <SlideOver
        open={Boolean(selectedId)}
        onClose={closeDetail}
        widthClass="sm:max-w-2xl"
      >
        {selectedId ? (
          <ContractorDetailScreen
            contractorId={selectedId}
            variant="drawer"
            onClose={closeDetail}
          />
        ) : null}
      </SlideOver>

      <SlideOver
        open={isCreateOpen && canWriteCore}
        onClose={() => setIsCreateOpen(false)}
        title="Создать контрагента"
        widthClass="sm:max-w-lg"
        footer={
          <div className="flex gap-2">
            <button
              type="button"
              onClick={() => setIsCreateOpen(false)}
              className="inline-flex flex-1 items-center justify-center border border-app-fg/15 px-4 py-2.5 text-xs font-semibold uppercase tracking-wide text-app-fg/80 transition hover:border-app-fg/40"
            >
              Отмена
            </button>
            <button
              type="submit"
              form="create-contractor-form"
              className={`${primaryActionButtonClass} flex-1`}
            >
              Создать
            </button>
          </div>
        }
      >
        {isCreateOpen && canWriteCore ? (
          <form id="create-contractor-form" onSubmit={handleAdd} className="space-y-4">
              <label className="block text-xs uppercase tracking-wider text-app-fg/55">
                Контактное лицо
                <input
                  value={fullName}
                  onChange={(e) => setFullName(e.target.value)}
                  required
                  className="mt-1 w-full border border-app-fg/15 bg-app-bg px-3 py-2.5 text-sm text-app-fg outline-none ring-app-accent/35 focus:ring-2"
                />
              </label>

              <label className="block text-xs uppercase tracking-wider text-app-fg/55">
                Никнейм
                <input
                  value={nickname}
                  onChange={(e) => setNickname(e.target.value)}
                  required
                  className="mt-1 w-full border border-app-fg/15 bg-app-bg px-3 py-2.5 text-sm text-app-fg outline-none ring-app-accent/35 focus:ring-2"
                />
              </label>

              <details className="border border-app-fg/10">
                <summary className="cursor-pointer list-none px-3 py-2.5 text-xs font-semibold uppercase tracking-wide text-app-fg/70 [&::-webkit-details-marker]:hidden">
                  ▸ Дополнительно
                </summary>
                <div className="space-y-3 border-t border-app-fg/10 px-3 py-3">
              {socialOptions.length > 0 ? (
                <div className="space-y-2 border border-app-fg/10 bg-app-fg/[0.02] p-3">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <span className="text-xs uppercase tracking-wider text-app-fg/55">
                      Соцсети
                    </span>
                    <button
                      type="button"
                      onClick={addLinkDraftRow}
                      className="inline-flex items-center gap-1 border border-app-fg/20 px-2 py-1 text-[10px] font-semibold uppercase tracking-wide text-app-fg/80 transition hover:border-app-accent/40"
                    >
                      <Plus className="h-3 w-3" strokeWidth={2} />
                      Ещё площадка
                    </button>
                  </div>
                  {linkDrafts.length === 0 ? (
                    <button
                      type="button"
                      onClick={addLinkDraftRow}
                      className="w-full border border-dashed border-app-fg/20 py-2 text-xs text-app-fg/55 transition hover:border-app-fg/35 hover:text-app-fg/75"
                    >
                      + Добавить ссылку
                    </button>
                  ) : (
                    <ul className="space-y-3">
                      {linkDrafts.map((row) => (
                        <li
                          key={row.rowId}
                          className="flex flex-col gap-2 sm:flex-row sm:items-end sm:gap-2"
                        >
                          <label className="block min-w-0 flex-1 text-[10px] font-semibold uppercase tracking-wider text-app-fg/50">
                            Площадка
                            <select
                              value={row.socialNetworkId}
                              onChange={(e) =>
                                updateLinkDraft(row.rowId, { socialNetworkId: e.target.value })
                              }
                              className={`mt-1 w-full border border-app-fg/15 bg-app-bg px-3 py-2 text-sm text-app-fg outline-none ring-app-accent/35 focus:ring-2 ${selectNativeChevronPad}`}
                            >
                              {socialOptions.map((o) => (
                                <option key={o.id} value={o.id}>
                                  {o.label}
                                </option>
                              ))}
                            </select>
                          </label>
                          <label className="block min-w-0 flex-[2] text-[10px] font-semibold uppercase tracking-wider text-app-fg/50">
                            Ссылка
                            <input
                              value={row.url}
                              onChange={(e) => updateLinkDraft(row.rowId, { url: e.target.value })}
                              placeholder="instagram.com/…"
                              className="mt-1 w-full border border-app-fg/15 bg-app-bg px-3 py-2 text-sm text-app-fg outline-none ring-app-accent/35 focus:ring-2"
                              autoComplete="off"
                              spellCheck={false}
                            />
                          </label>
                          <button
                            type="button"
                            onClick={() => removeLinkDraftRow(row.rowId)}
                            className="inline-flex shrink-0 items-center justify-center gap-1 self-end border border-app-fg/15 px-2.5 py-2 text-app-fg/55 transition hover:border-red-400/40 hover:text-red-300 sm:self-auto"
                            aria-label="Удалить строку"
                          >
                            <Trash2 className="h-4 w-4" strokeWidth={1.5} />
                          </button>
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
              ) : null}

              <label className="block text-xs uppercase tracking-wider text-app-fg/55">
                Город
                <input
                  value={cityInput}
                  onChange={(e) => setCityInput(e.target.value)}
                  placeholder="Необязательно"
                  className="mt-1 w-full border border-app-fg/15 bg-app-bg px-3 py-2.5 text-sm text-app-fg outline-none ring-app-accent/35 focus:ring-2"
                  autoComplete="address-level2"
                />
              </label>

              <label className="block text-xs uppercase tracking-wider text-app-fg/55">
                Промокод
                <input
                  value={promoCodeInput}
                  onChange={(e) => setPromoCodeInput(e.target.value)}
                  placeholder="Необязательно"
                  className="mt-1 w-full border border-app-fg/15 bg-app-bg px-3 py-2.5 text-sm text-app-fg outline-none ring-app-accent/35 focus:ring-2"
                  autoComplete="off"
                  spellCheck={false}
                />
              </label>

              <label className="block text-xs uppercase tracking-wider text-app-fg/55">
                Вирусность
                <input
                  value={viralityInput}
                  onChange={(e) => setViralityInput(e.target.value)}
                  placeholder="Необязательно"
                  className="mt-1 w-full border border-app-fg/15 bg-app-bg px-3 py-2.5 text-sm text-app-fg outline-none ring-app-accent/35 focus:ring-2"
                  autoComplete="off"
                />
              </label>

              <label className="block text-xs uppercase tracking-wider text-app-fg/55">
                Ниша
                <select
                  value={nicheIdInput}
                  onChange={(e) => setNicheIdInput(e.target.value)}
                  className={`mt-1 w-full border border-app-fg/15 bg-app-bg px-3 py-2.5 text-sm text-app-fg outline-none ring-app-accent/35 focus:ring-2 ${selectNativeChevronPad}`}
                >
                  <option value="">Не выбрана</option>
                  {nicheOptions.map((o) => (
                    <option key={o.id} value={o.id}>
                      {nicheChoiceCaption(o.label)}
                    </option>
                  ))}
                </select>
              </label>

              <label className="block text-xs uppercase tracking-wider text-app-fg/55">
                Категория
                <select
                  value={sizeCategoryInput}
                  onChange={(e) => setSizeCategoryInput(e.target.value)}
                  className={`mt-1 w-full border border-app-fg/15 bg-app-bg px-3 py-2.5 text-sm text-app-fg outline-none ring-app-accent/35 focus:ring-2 ${selectNativeChevronPad}`}
                >
                  <option value="">Не указана</option>
                  {CONTRACTOR_SIZE_CATEGORIES.map((k) => (
                    <option key={k} value={k}>
                      {CONTRACTOR_SIZE_CATEGORY_LABELS[k]}
                    </option>
                  ))}
                </select>
              </label>
                </div>
              </details>
            </form>
        ) : null}
      </SlideOver>
    </div>
  );
}
