"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useCallback, useEffect, useMemo, useState, type FormEvent } from "react";
import { Plus, Search, ChevronDown, X } from "lucide-react";
import { IntegrationDetailScreen } from "@/screens/IntegrationDetailScreen";
import { FilterChips, SlideOver, StatusBadgeDropdown } from "@/components/ui";
import { useAuth } from "@/context/AuthContext";
import { usePanelData } from "@/context/PanelDataContext";
import { abbreviateFio, findEmployeeIdByPanelSession } from "@/lib/employee-utils";
import { ContractorListModal } from "@/components/ContractorListModal";
import {
  CHANNEL_BADGE_CLASS,
  CONTRACTOR_SIZE_CATEGORIES,
  CONTRACTOR_SIZE_CATEGORY_LABELS,
  INTEGRATION_COOPERATION_LABELS,
  INTEGRATION_COOPERATION_TYPES,
  INTEGRATION_STATUSES,
  INTEGRATION_STATUS_LABELS,
  STATUS_BADGE_CLASS,
  type Integration,
  type IntegrationCooperationType,
  type IntegrationStatus,
} from "@/types/panel-data";
import { CrmPill } from "@/components/CrmPill";
import { SortableTh } from "@/components/SortableTh";
import {
  formatIntegrationReleaseDateTable,
  formatIntegrationReleaseLine,
  formatRuDate,
  formatRuMoney,
  formatRuTime,
} from "@/lib/format-ru";
import { normalizeIntegrationPublicLink } from "@/lib/integration-link";
import { parseBudgetReachField } from "@/lib/integration-metrics";
import { useTableSort } from "@/hooks/useTableSort";
import { localReleaseDateTimeMs } from "@/lib/panel-tasks";
import {
  crmPageHeaderRowClass,
  crmPageTitleClass,
  primaryActionButtonClass,
  selectNativeChevronPad,
  tableBodyRowBorderClass,
  tableHeadRowBorderClass,
} from "@/screens/dashboard-shared";
import { compareNumbers, compareStringsRu, parseTimeMs } from "@/lib/table-sort";
import { nicheChoiceCaption } from "@/lib/niche-display";
import { parseYmdLocal } from "@/lib/task-deadline";
import { currentYearMonth, shiftYearMonth, monthTitleRu, formatYearMonthString } from "@/lib/dashboard-metrics";

const fieldClass =
  "w-full min-w-0 border border-app-fg/15 bg-app-bg px-3 py-2.5 text-sm text-app-fg outline-none ring-app-accent/35 focus:ring-2";

/** Фильтры над таблицей — подписи в капсе (как в макете) */
const filterSelectClass = `${fieldClass} min-h-[44px] ${selectNativeChevronPad} uppercase tracking-[0.08em] text-[11px]`;

function integrationTitleKey(title: string): string {
  return title.trim().toLowerCase().replace(/\s+/g, " ");
}

type PanelSortKey =
  | "status"
  | "platform"
  | "title"
  | "created"
  | "contractor"
  | "niche"
  | "sizeCategory"
  | "cooperation"
  | "employee"
  | "release";

function panelReleaseSortMs(row: Integration): number {
  const full = localReleaseDateTimeMs(row.releaseDate, row.releaseTime);
  if (full != null) return full;
  const d = row.releaseDate?.trim();
  if (!d) return 0;
  const p = parseYmdLocal(d);
  return p ? p.getTime() : 0;
}

function escapeCsvCell(value: string): string {
  if (/[",\n\r]/.test(value)) return `"${value.replace(/"/g, '""')}"`;
  return value;
}

export function IntegrationsScreen() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const selectedId = searchParams.get("id");
  const { sort, toggleSort, sortKey, sortDir } = useTableSort<PanelSortKey>();
  const { currentUsername } = useAuth();
  const {
    contractors,
    integrations,
    socialOptions,
    nicheOptions,
    employees,
    isAdmin,
    addIntegration,
    updateIntegration,
  } = usePanelData();

  const [isAddOpen, setIsAddOpen] = useState(false);
  const [isContractorPickerOpen, setIsContractorPickerOpen] = useState(false);
  const [title, setTitle] = useState("");
  const [contractorId, setContractorId] = useState("");
  const [socialNetworkId, setSocialNetworkId] = useState("");
  const [status, setStatus] = useState<IntegrationStatus>("draft");
  const [releaseDate, setReleaseDate] = useState("");
  const [releaseTime, setReleaseTime] = useState("");
  const [budgetInput, setBudgetInput] = useState("");
  const [reachInput, setReachInput] = useState("");
  const [linkInput, setLinkInput] = useState("");
  const [cooperationType, setCooperationType] = useState<IntegrationCooperationType | "">("");
  const [addFormError, setAddFormError] = useState<string | null>(null);
  const [tableSearch, setTableSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<IntegrationStatus | "all">("all");
  const [platformFilter, setPlatformFilter] = useState<string>("all");
  /** all | __empty__ | название города */
  const [cityFilter, setCityFilter] = useState<string>("all");
  /** all | employee id | без закреплённого сотрудника */
  const [employeeFilter, setEmployeeFilter] = useState<string>("all");
  /** all | niche option id | __no_niche__ */
  const [nicheFilter, setNicheFilter] = useState<string>("all");
  /** all | ContractorSizeCategory | __no_size__ */
  const [sizeCategoryFilter, setSizeCategoryFilter] = useState<string>("all");
  /** all | IntegrationCooperationType | __no_coop__ */
  const [cooperationFilter, setCooperationFilter] = useState<string>("all");
  const [mobileFiltersOpen, setMobileFiltersOpen] = useState(false);
  const [extraFiltersOpen, setExtraFiltersOpen] = useState(false);
  const [contractorFilter, setContractorFilter] = useState<string>("all");
  const [formEmployeeId, setFormEmployeeId] = useState<string>("");
  const [monthFilter, setMonthFilter] = useState<string>("all");
  const [highlightId, setHighlightId] = useState<string | null>(null);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(() => new Set());
  const [tableHovered, setTableHovered] = useState(false);
  const [bulkStatusOpen, setBulkStatusOpen] = useState(false);

  const byContractor = useMemo(() => {
    const m = new Map<string, string>();
    contractors.forEach((c) => m.set(c.id, c.name));
    return m;
  }, [contractors]);

  const byEmployee = useMemo(() => {
    const m = new Map<string, (typeof employees)[number]>();
    employees.forEach((e) => m.set(e.id, e));
    return m;
  }, [employees]);

  const contractorById = useMemo(() => {
    const m = new Map<string, (typeof contractors)[number]>();
    contractors.forEach((c) => m.set(c.id, c));
    return m;
  }, [contractors]);

  const cityOptions = useMemo(() => {
    const set = new Set<string>();
    for (const c of contractors) {
      const t = c.city?.trim();
      if (t) set.add(t);
    }
    return Array.from(set).sort((a, b) => a.localeCompare(b, "ru"));
  }, [contractors]);

  const showEmptyCityFilter = useMemo(
    () =>
      integrations.some((row) => {
        const c = contractorById.get(row.contractorId);
        return c && !c.city?.trim();
      }),
    [integrations, contractorById],
  );

  const showEmptyNicheFilter = useMemo(
    () =>
      integrations.some((row) => {
        const c = contractorById.get(row.contractorId);
        return c && !c.nicheId?.trim();
      }),
    [integrations, contractorById],
  );

  const showEmptySizeCategoryFilter = useMemo(
    () =>
      integrations.some((row) => {
        const c = contractorById.get(row.contractorId);
        return c && !c.sizeCategory;
      }),
    [integrations, contractorById],
  );

  const showEmptyCooperationFilter = useMemo(
    () => integrations.some((row) => !row.cooperationType),
    [integrations],
  );

  const monthOptions = useMemo(() => {
    const ym = currentYearMonth();
    return Array.from({ length: 12 }, (_, i) => {
      const m = shiftYearMonth(ym, -i);
      return { value: formatYearMonthString(m), label: monthTitleRu(m) };
    });
  }, []);

  useEffect(() => {
    const mq = window.matchMedia("(min-width: 768px)");
    const sync = () => {
      if (mq.matches) setMobileFiltersOpen(false);
    };
    sync();
    mq.addEventListener("change", sync);
    return () => mq.removeEventListener("change", sync);
  }, []);

  useEffect(() => {
    if (!isAddOpen) return;
    setContractorId((prev) => prev || contractors[0]?.id || "");
    setSocialNetworkId((prev) => prev || socialOptions[0]?.id || "");
  }, [isAddOpen, contractors, socialOptions]);

  function openAddModal() {
    setTitle("");
    setContractorId(contractors[0]?.id ?? "");
    setSocialNetworkId(socialOptions[0]?.id ?? "");
    setStatus("draft");
    setReleaseDate("");
    setReleaseTime("");
    setBudgetInput("");
    setReachInput("");
    setLinkInput("");
    setCooperationType("");
    setFormEmployeeId(findEmployeeIdByPanelSession(employees, currentUsername) ?? "");
    setAddFormError(null);
    setIsAddOpen(true);
  }

  function closeAddModal() {
    setIsAddOpen(false);
    setAddFormError(null);
  }

  function handleAddSubmit(e: FormEvent) {
    e.preventDefault();
    setAddFormError(null);
    const titleTrim = title.trim();
    if (!contractorId.trim() || !socialNetworkId.trim()) return;
    if (!titleTrim) {
      setAddFormError("Укажите заголовок.");
      return;
    }
    if (
      integrations.some(
        (i) => integrationTitleKey(i.title ?? "") === integrationTitleKey(titleTrim),
      )
    ) {
      setAddFormError("Такой заголовок уже используется.");
      return;
    }

    const budget = parseBudgetReachField(budgetInput);
    const reach = parseBudgetReachField(reachInput);

    const assignedEmployeeId = formEmployeeId.trim() || undefined;
    const publicLink = normalizeIntegrationPublicLink(linkInput);
    const id = addIntegration({
      contractorId,
      socialNetworkId,
      title: titleTrim,
      status,
      releaseDate: releaseDate.trim() || undefined,
      releaseTime: releaseTime.trim() || undefined,
      ...(budget !== undefined ? { budget } : {}),
      ...(reach !== undefined ? { reach } : {}),
      ...(publicLink ? { publicLink } : {}),
      ...(assignedEmployeeId ? { assignedEmployeeId } : {}),
      ...(cooperationType === "barter" || cooperationType === "commercial"
        ? { cooperationType }
        : {}),
    });
    if (id) {
      closeAddModal();
      setHighlightId(id);
      router.push(`/integrations?id=${encodeURIComponent(id)}`);
    } else {
      setAddFormError("Не удалось создать интеграцию (заголовок занят или нет данных).");
    }
  }

  useEffect(() => {
    if (!highlightId) return;
    const t = window.setTimeout(() => setHighlightId(null), 2000);
    return () => window.clearTimeout(t);
  }, [highlightId]);

  const closeDetail = useCallback(() => {
    router.push("/integrations");
  }, [router]);

  function openRow(id: string) {
    router.push(`/integrations?id=${encodeURIComponent(id)}`);
  }

  const showBulkColumn = tableHovered || selectedIds.size > 0;

  const filterChips = useMemo(() => {
    const chips: { id: string; label: string; onRemove: () => void }[] = [];
    if (statusFilter !== "all") {
      chips.push({
        id: "status",
        label: INTEGRATION_STATUS_LABELS[statusFilter],
        onRemove: () => setStatusFilter("all"),
      });
    }
    if (monthFilter !== "all") {
      const label = monthOptions.find((o) => o.value === monthFilter)?.label ?? monthFilter;
      chips.push({ id: "month", label, onRemove: () => setMonthFilter("all") });
    }
    if (contractorFilter !== "all") {
      const name = byContractor.get(contractorFilter) ?? contractorFilter;
      chips.push({
        id: "contractor",
        label: name,
        onRemove: () => setContractorFilter("all"),
      });
    }
    if (platformFilter !== "all") {
      const label =
        socialOptions.find((o) => o.id === platformFilter)?.label ?? platformFilter;
      chips.push({ id: "platform", label, onRemove: () => setPlatformFilter("all") });
    }
    if (cityFilter !== "all") {
      const label =
        cityFilter === "__empty__" ? "Без города" : cityFilter;
      chips.push({ id: "city", label, onRemove: () => setCityFilter("all") });
    }
    if (employeeFilter !== "all") {
      const label =
        employeeFilter === "unassigned"
          ? "Не назначен"
          : abbreviateFio(byEmployee.get(employeeFilter)?.fullName ?? "");
      chips.push({ id: "employee", label, onRemove: () => setEmployeeFilter("all") });
    }
    if (nicheFilter !== "all") {
      const label =
        nicheFilter === "__no_niche__"
          ? "Без ниши"
          : nicheChoiceCaption(
              nicheOptions.find((o) => o.id === nicheFilter)?.label ?? nicheFilter,
            );
      chips.push({ id: "niche", label, onRemove: () => setNicheFilter("all") });
    }
    if (sizeCategoryFilter !== "all") {
      const label =
        sizeCategoryFilter === "__no_size__"
          ? "Без категории"
          : CONTRACTOR_SIZE_CATEGORY_LABELS[
              sizeCategoryFilter as keyof typeof CONTRACTOR_SIZE_CATEGORY_LABELS
            ];
      chips.push({ id: "size", label, onRemove: () => setSizeCategoryFilter("all") });
    }
    if (cooperationFilter !== "all") {
      const label =
        cooperationFilter === "__no_coop__"
          ? "Не указано"
          : INTEGRATION_COOPERATION_LABELS[
              cooperationFilter as IntegrationCooperationType
            ];
      chips.push({ id: "coop", label, onRemove: () => setCooperationFilter("all") });
    }
    return chips;
  }, [
    statusFilter,
    monthFilter,
    contractorFilter,
    platformFilter,
    cityFilter,
    employeeFilter,
    nicheFilter,
    sizeCategoryFilter,
    cooperationFilter,
    monthOptions,
    byContractor,
    socialOptions,
    byEmployee,
    nicheOptions,
  ]);

  function toggleSelected(id: string) {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function handleBulkStatus(status: IntegrationStatus) {
    for (const id of Array.from(selectedIds)) {
      updateIntegration(id, { status });
    }
    setBulkStatusOpen(false);
    setSelectedIds(new Set());
  }

  function handleExportSelected() {
    const rows = integrations.filter((i) => selectedIds.has(i.id));
    const header = [
      "ID",
      "Заголовок",
      "Статус",
      "Контрагент",
      "Площадка",
      "Дата выхода",
      "Бюджет",
      "Охваты",
    ];
    const lines = [
      header.join(","),
      ...rows.map((i) =>
        [
          i.id,
          i.title ?? "",
          INTEGRATION_STATUS_LABELS[i.status],
          byContractor.get(i.contractorId) ?? "",
          socialOptions.find((o) => o.id === i.socialNetworkId)?.label ?? "",
          i.releaseDate ?? "",
          i.budget != null ? String(i.budget) : "",
          i.reach != null ? String(i.reach) : "",
        ]
          .map(escapeCsvCell)
          .join(","),
      ),
    ];
    const blob = new Blob(["\uFEFF" + lines.join("\n")], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `integrations-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }

  const canAdd = isAdmin && contractors.length > 0 && socialOptions.length > 0;

  const filteredIntegrations = useMemo(() => {
    return integrations.filter((row) => {
      if (statusFilter !== "all" && row.status !== statusFilter) return false;
      if (platformFilter !== "all" && row.socialNetworkId !== platformFilter) return false;
      if (cityFilter !== "all") {
        const co = contractorById.get(row.contractorId);
        const city = (co?.city ?? "").trim();
        if (cityFilter === "__empty__") {
          if (city) return false;
        } else if (city !== cityFilter) {
          return false;
        }
      }
      if (employeeFilter === "unassigned") {
        if (row.assignedEmployeeId?.trim()) return false;
      } else if (employeeFilter !== "all") {
        if (row.assignedEmployeeId !== employeeFilter) return false;
      }
      const coForDims = contractorById.get(row.contractorId);
      if (nicheFilter !== "all") {
        const nid = coForDims?.nicheId?.trim() ?? "";
        if (nicheFilter === "__no_niche__") {
          if (nid) return false;
        } else if (nid !== nicheFilter) {
          return false;
        }
      }
      if (sizeCategoryFilter !== "all") {
        const sc = coForDims?.sizeCategory;
        if (sizeCategoryFilter === "__no_size__") {
          if (sc) return false;
        } else if (sc !== sizeCategoryFilter) {
          return false;
        }
      }
      if (cooperationFilter !== "all") {
        const ct = row.cooperationType;
        if (cooperationFilter === "__no_coop__") {
          if (ct) return false;
        } else if (ct !== cooperationFilter) {
          return false;
        }
      }
      if (contractorFilter !== "all" && row.contractorId !== contractorFilter) return false;
      if (monthFilter !== "all" && !row.releaseDate?.startsWith(monthFilter)) return false;
      const q = tableSearch.trim().toLowerCase();
      if (!q) return true;
      const contractorName = byContractor.get(row.contractorId) ?? "";
      const co = contractorById.get(row.contractorId);
      const contractorCity = (co?.city ?? "").trim();
      const nicheRaw = co?.nicheId
        ? nicheOptions.find((n) => n.id === co.nicheId)?.label ?? ""
        : "";
      const nicheLab = nicheRaw
        ? `${nicheRaw} ${nicheChoiceCaption(nicheRaw)}`.toLowerCase()
        : "";
      const sizeLab = co?.sizeCategory
        ? CONTRACTOR_SIZE_CATEGORY_LABELS[co.sizeCategory].toLowerCase()
        : "";
      const coopLab = row.cooperationType
        ? INTEGRATION_COOPERATION_LABELS[row.cooperationType].toLowerCase()
        : "";
      const social = socialOptions.find((o) => o.id === row.socialNetworkId);
      const socialLabel = (social?.label ?? row.socialNetworkId ?? "").toLowerCase();
        const emp = row.assignedEmployeeId
          ? byEmployee.get(row.assignedEmployeeId)
          : undefined;
        const empBlob = emp ? abbreviateFio(emp.fullName) : "";
        const blob = [
        row.title ?? "",
        contractorName,
        contractorCity,
        nicheLab,
        sizeLab,
        coopLab,
        INTEGRATION_STATUS_LABELS[row.status],
        socialLabel,
        empBlob,
        formatRuDate(row.createdAt ?? ""),
        formatRuTime(row.createdAt ?? ""),
        formatIntegrationReleaseLine(row.releaseDate, row.releaseTime),
        row.publicLink ?? "",
      ]
        .join(" ")
        .toLowerCase();
      return blob.includes(q);
    });
  }, [
    integrations,
    tableSearch,
    statusFilter,
    platformFilter,
    cityFilter,
    employeeFilter,
    nicheFilter,
    sizeCategoryFilter,
    cooperationFilter,
    monthFilter,
    contractorFilter,
    byContractor,
    contractorById,
    socialOptions,
    nicheOptions,
    byEmployee,
  ]);

  const sortedIntegrations = useMemo(() => {
    const rows = [...filteredIntegrations];
    if (!sort) return rows;
    const m = sort.dir === "asc" ? 1 : -1;
    const statusIx = (s: IntegrationStatus) => INTEGRATION_STATUSES.indexOf(s);
    rows.sort((a, b) => {
      let cmp = 0;
      switch (sort.key) {
        case "status":
          cmp = statusIx(a.status) - statusIx(b.status);
          break;
        case "platform": {
          const la =
            socialOptions.find((o) => o.id === a.socialNetworkId)?.label ??
            a.socialNetworkId;
          const lb =
            socialOptions.find((o) => o.id === b.socialNetworkId)?.label ??
            b.socialNetworkId;
          cmp = compareStringsRu(la, lb);
          break;
        }
        case "title":
          cmp = compareStringsRu(a.title ?? "", b.title ?? "");
          break;
        case "created":
          cmp = compareNumbers(parseTimeMs(a.createdAt), parseTimeMs(b.createdAt));
          break;
        case "contractor":
          cmp = compareStringsRu(
            byContractor.get(a.contractorId) ?? "",
            byContractor.get(b.contractorId) ?? "",
          );
          break;
        case "niche": {
          const ca = contractorById.get(a.contractorId);
          const cb = contractorById.get(b.contractorId);
          const la = nicheChoiceCaption(
            ca?.nicheId ? nicheOptions.find((n) => n.id === ca.nicheId)?.label ?? "" : "",
          );
          const lb = nicheChoiceCaption(
            cb?.nicheId ? nicheOptions.find((n) => n.id === cb.nicheId)?.label ?? "" : "",
          );
          cmp = compareStringsRu(la, lb);
          break;
        }
        case "sizeCategory": {
          const ca = contractorById.get(a.contractorId);
          const cb = contractorById.get(b.contractorId);
          const la = ca?.sizeCategory
            ? CONTRACTOR_SIZE_CATEGORY_LABELS[ca.sizeCategory]
            : "";
          const lb = cb?.sizeCategory
            ? CONTRACTOR_SIZE_CATEGORY_LABELS[cb.sizeCategory]
            : "";
          cmp = compareStringsRu(la, lb);
          break;
        }
        case "cooperation": {
          const la = a.cooperationType
            ? INTEGRATION_COOPERATION_LABELS[a.cooperationType]
            : "";
          const lb = b.cooperationType
            ? INTEGRATION_COOPERATION_LABELS[b.cooperationType]
            : "";
          cmp = compareStringsRu(la, lb);
          break;
        }
        case "employee": {
          const na = a.assignedEmployeeId
            ? abbreviateFio(byEmployee.get(a.assignedEmployeeId)?.fullName ?? "")
            : "";
          const nb = b.assignedEmployeeId
            ? abbreviateFio(byEmployee.get(b.assignedEmployeeId)?.fullName ?? "")
            : "";
          cmp = compareStringsRu(na, nb);
          break;
        }
        case "release":
          cmp = compareNumbers(panelReleaseSortMs(a), panelReleaseSortMs(b));
          break;
        default:
          break;
      }
      if (cmp !== 0) return m * cmp;
      return compareStringsRu(a.id, b.id);
    });
    return rows;
  }, [
    filteredIntegrations,
    sort,
    socialOptions,
    nicheOptions,
    byContractor,
    contractorById,
    byEmployee,
  ]);

  const onPanelSort = (key: string) => toggleSort(key as PanelSortKey);

  return (
    <div className="w-full min-w-0 max-w-full space-y-4">
      <div className={crmPageHeaderRowClass}>
        <h1 className={crmPageTitleClass}>Интеграции</h1>
        {isAdmin && (
          <button
            type="button"
            onClick={openAddModal}
            className={`${primaryActionButtonClass} max-md:hidden w-full shrink-0 sm:w-auto`}
          >
            <Plus className="h-4 w-4" strokeWidth={1.5} />
            Добавить интеграцию
          </button>
        )}
      </div>

      {integrations.length > 0 && (
        <div className="flex flex-col gap-2">
          <label className="relative min-w-0">
            <Search
              className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-app-fg/35"
              aria-hidden
            />
            <input
              value={tableSearch}
              onChange={(e) => setTableSearch(e.target.value)}
              placeholder="Поиск по таблице…"
              title="Название, контрагент, город, ниша, категория, бартер или коммерция, сотрудник"
              className="w-full min-w-0 border border-app-fg/15 bg-app-bg py-2.5 pl-9 pr-3 text-sm text-app-fg outline-none ring-app-accent/35 focus:ring-2"
              type="search"
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
          <div className="hidden flex-col gap-2 md:flex">
            <div className="grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-4">
              <select
                value={statusFilter}
                onChange={(e) =>
                  setStatusFilter(
                    e.target.value === "all" ? "all" : (e.target.value as IntegrationStatus),
                  )
                }
                aria-label="Фильтр по статусу"
                className={filterSelectClass}
              >
                <option value="all">Все статусы</option>
                {INTEGRATION_STATUSES.map((s) => (
                  <option key={s} value={s}>
                    {INTEGRATION_STATUS_LABELS[s]}
                  </option>
                ))}
              </select>
              <select
                value={monthFilter}
                onChange={(e) => setMonthFilter(e.target.value)}
                aria-label="Фильтр по месяцу"
                className={filterSelectClass}
              >
                <option value="all">Все месяцы</option>
                {monthOptions.map((o) => (
                  <option key={o.value} value={o.value}>
                    {o.label}
                  </option>
                ))}
              </select>
              <select
                value={contractorFilter}
                onChange={(e) => setContractorFilter(e.target.value)}
                aria-label="Фильтр по блогеру"
                className={filterSelectClass}
              >
                <option value="all">Все блогеры</option>
                {[...contractors]
                  .sort((a, b) => a.name.localeCompare(b.name, "ru"))
                  .map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.name}
                    </option>
                  ))}
              </select>
              <button
                type="button"
                onClick={() => setExtraFiltersOpen((o) => !o)}
                aria-expanded={extraFiltersOpen}
                className={`${filterSelectClass} text-left`}
              >
                Ещё фильтры
              </button>
            </div>
            {extraFiltersOpen ? (
              <div className="grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-3">
            <select
              value={platformFilter}
              onChange={(e) => setPlatformFilter(e.target.value)}
              aria-label="Фильтр по площадке"
              className={filterSelectClass}
            >
              <option value="all">Все площадки</option>
              {socialOptions.map((o) => (
                <option key={o.id} value={o.id}>
                  {o.label}
                </option>
              ))}
            </select>
            <select
              value={cityFilter}
              onChange={(e) => setCityFilter(e.target.value)}
              aria-label="Фильтр по городу контрагента"
              className={filterSelectClass}
            >
              <option value="all">Все города</option>
              {showEmptyCityFilter ? (
                <option value="__empty__">Без города</option>
              ) : null}
              {cityOptions.map((city) => (
                <option key={city} value={city}>
                  {city}
                </option>
              ))}
            </select>
            <select
              value={employeeFilter}
              onChange={(e) => setEmployeeFilter(e.target.value)}
              aria-label="Фильтр по сотруднику"
              className={filterSelectClass}
            >
              <option value="all">Все сотрудники</option>
              <option value="unassigned">Не назначен</option>
              {[...employees]
                .sort((a, b) => a.fullName.localeCompare(b.fullName, "ru"))
                .map((em) => (
                  <option key={em.id} value={em.id}>
                    {abbreviateFio(em.fullName)}
                  </option>
                ))}
            </select>
            <select
              value={nicheFilter}
              onChange={(e) => setNicheFilter(e.target.value)}
              aria-label="Фильтр по нише контрагента"
              className={filterSelectClass}
            >
              <option value="all">Все ниши</option>
              {showEmptyNicheFilter ? (
                <option value="__no_niche__">Без ниши</option>
              ) : null}
              {nicheOptions.map((o) => (
                <option key={o.id} value={o.id}>
                  {nicheChoiceCaption(o.label)}
                </option>
              ))}
            </select>
            <select
              value={sizeCategoryFilter}
              onChange={(e) => setSizeCategoryFilter(e.target.value)}
              aria-label="Фильтр по категории контрагента"
              className={filterSelectClass}
            >
              <option value="all">Все категории</option>
              {showEmptySizeCategoryFilter ? (
                <option value="__no_size__">Без категории</option>
              ) : null}
              {CONTRACTOR_SIZE_CATEGORIES.map((k) => (
                <option key={k} value={k}>
                  {CONTRACTOR_SIZE_CATEGORY_LABELS[k]}
                </option>
              ))}
            </select>
            <select
              value={cooperationFilter}
              onChange={(e) => setCooperationFilter(e.target.value)}
              aria-label="Фильтр по условиям интеграции"
              className={filterSelectClass}
            >
              <option value="all">Все условия</option>
              {showEmptyCooperationFilter ? (
                <option value="__no_coop__">Не указано</option>
              ) : null}
              {INTEGRATION_COOPERATION_TYPES.map((t) => (
                <option key={t} value={t}>
                  {INTEGRATION_COOPERATION_LABELS[t]}
                </option>
              ))}
            </select>
              </div>
            ) : null}
          </div>
          <FilterChips chips={filterChips} />
        </div>
      )}

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
                  {INTEGRATION_STATUSES.map((s) => (
                    <li key={s}>
                      <button
                        type="button"
                        className="w-full px-3 py-2 text-left text-[11px] font-semibold uppercase tracking-wide text-app-fg/80 hover:bg-app-fg/[0.06]"
                        onClick={() => handleBulkStatus(s)}
                      >
                        {INTEGRATION_STATUS_LABELS[s]}
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

      {mobileFiltersOpen && integrations.length > 0 ? (
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
              onChange={(e) =>
                setStatusFilter(
                  e.target.value === "all" ? "all" : (e.target.value as IntegrationStatus),
                )
              }
              aria-label="Фильтр по статусу"
              className={filterSelectClass}
            >
              <option value="all">Все статусы</option>
              {INTEGRATION_STATUSES.map((s) => (
                <option key={s} value={s}>
                  {INTEGRATION_STATUS_LABELS[s]}
                </option>
              ))}
            </select>
            <select
              value={monthFilter}
              onChange={(e) => setMonthFilter(e.target.value)}
              aria-label="Фильтр по месяцу"
              className={filterSelectClass}
            >
              <option value="all">Все месяцы</option>
              {monthOptions.map((o) => (
                <option key={o.value} value={o.value}>
                  {o.label}
                </option>
              ))}
            </select>
            <select
              value={contractorFilter}
              onChange={(e) => setContractorFilter(e.target.value)}
              aria-label="Фильтр по блогеру"
              className={filterSelectClass}
            >
              <option value="all">Все блогеры</option>
              {[...contractors]
                .sort((a, b) => a.name.localeCompare(b.name, "ru"))
                .map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
            </select>
            <select
              value={platformFilter}
              onChange={(e) => setPlatformFilter(e.target.value)}
              aria-label="Фильтр по площадке"
              className={filterSelectClass}
            >
              <option value="all">Все площадки</option>
              {socialOptions.map((o) => (
                <option key={o.id} value={o.id}>
                  {o.label}
                </option>
              ))}
            </select>
            <select
              value={cityFilter}
              onChange={(e) => setCityFilter(e.target.value)}
              aria-label="Фильтр по городу контрагента"
              className={filterSelectClass}
            >
              <option value="all">Все города</option>
              {showEmptyCityFilter ? <option value="__empty__">Без города</option> : null}
              {cityOptions.map((city) => (
                <option key={city} value={city}>
                  {city}
                </option>
              ))}
            </select>
            <select
              value={employeeFilter}
              onChange={(e) => setEmployeeFilter(e.target.value)}
              aria-label="Фильтр по сотруднику"
              className={filterSelectClass}
            >
              <option value="all">Все сотрудники</option>
              <option value="unassigned">Не назначен</option>
              {[...employees]
                .sort((a, b) => a.fullName.localeCompare(b.fullName, "ru"))
                .map((em) => (
                  <option key={em.id} value={em.id}>
                    {abbreviateFio(em.fullName)}
                  </option>
                ))}
            </select>
            <select
              value={nicheFilter}
              onChange={(e) => setNicheFilter(e.target.value)}
              aria-label="Фильтр по нише контрагента"
              className={filterSelectClass}
            >
              <option value="all">Все ниши</option>
              {showEmptyNicheFilter ? <option value="__no_niche__">Без ниши</option> : null}
              {nicheOptions.map((o) => (
                <option key={o.id} value={o.id}>
                  {nicheChoiceCaption(o.label)}
                </option>
              ))}
            </select>
            <select
              value={sizeCategoryFilter}
              onChange={(e) => setSizeCategoryFilter(e.target.value)}
              aria-label="Фильтр по категории контрагента"
              className={filterSelectClass}
            >
              <option value="all">Все категории</option>
              {showEmptySizeCategoryFilter ? (
                <option value="__no_size__">Без категории</option>
              ) : null}
              {CONTRACTOR_SIZE_CATEGORIES.map((k) => (
                <option key={k} value={k}>
                  {CONTRACTOR_SIZE_CATEGORY_LABELS[k]}
                </option>
              ))}
            </select>
            <select
              value={cooperationFilter}
              onChange={(e) => setCooperationFilter(e.target.value)}
              aria-label="Фильтр по условиям интеграции"
              className={filterSelectClass}
            >
              <option value="all">Все условия</option>
              {showEmptyCooperationFilter ? <option value="__no_coop__">Не указано</option> : null}
              {INTEGRATION_COOPERATION_TYPES.map((t) => (
                <option key={t} value={t}>
                  {INTEGRATION_COOPERATION_LABELS[t]}
                </option>
              ))}
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

      {integrations.length > 0 && filteredIntegrations.length === 0 && (
        <p className="border border-dashed border-app-fg/15 px-4 py-8 text-center text-sm text-app-fg/55">
          Нет строк по текущему фильтру. Измените поиск или сбросьте фильтры.
        </p>
      )}

      {integrations.length > 0 && filteredIntegrations.length > 0 && (
        <div
          className="min-w-0 max-w-full overflow-x-auto rounded-md border border-app-fg/10 bg-app-bg px-2.5 [-webkit-overflow-scrolling:touch] sm:px-3 md:px-0"
          onMouseEnter={() => setTableHovered(true)}
          onMouseLeave={() => setTableHovered(false)}
        >
          <table className="w-full min-w-0 max-w-full table-auto border-separate border-spacing-0 text-left text-[10px] leading-tight text-app-fg max-md:table-fixed sm:text-xs md:min-w-[960px]">
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
                  onSort={onPanelSort}
                  className="min-w-0 px-2 py-2.5 align-middle max-md:w-[26%] max-md:whitespace-nowrap"
                >
                  Статус
                </SortableTh>
                <SortableTh
                  columnKey="platform"
                  sortKey={sortKey}
                  sortDir={sortDir}
                  onSort={onPanelSort}
                  align="center"
                  className="min-w-0 px-2 py-2.5 align-middle max-md:w-[20%] max-md:whitespace-nowrap"
                >
                  Площадка
                </SortableTh>
                <SortableTh
                  columnKey="title"
                  sortKey={sortKey}
                  sortDir={sortDir}
                  onSort={onPanelSort}
                  className="min-w-0 px-2 py-2.5 align-middle max-md:w-[36%]"
                >
                  Интеграция
                </SortableTh>
                <SortableTh
                  columnKey="created"
                  sortKey={sortKey}
                  sortDir={sortDir}
                  onSort={onPanelSort}
                  align="right"
                  className="hidden min-w-0 whitespace-nowrap py-2.5 px-2 align-middle tabular-nums md:table-cell"
                >
                  Дата
                </SortableTh>
                <SortableTh
                  columnKey="created"
                  sortKey={sortKey}
                  sortDir={sortDir}
                  onSort={onPanelSort}
                  align="right"
                  className="hidden min-w-0 whitespace-nowrap py-2.5 pl-2 pr-2 align-middle tabular-nums md:table-cell"
                >
                  Время
                </SortableTh>
                <SortableTh
                  columnKey="contractor"
                  sortKey={sortKey}
                  sortDir={sortDir}
                  onSort={onPanelSort}
                  className="hidden min-w-0 py-2.5 px-2 align-middle md:table-cell"
                >
                  Контрагент
                </SortableTh>
                <SortableTh
                  columnKey="niche"
                  sortKey={sortKey}
                  sortDir={sortDir}
                  onSort={onPanelSort}
                  className="hidden min-w-0 py-2.5 px-2 align-middle md:table-cell"
                >
                  Ниша
                </SortableTh>
                <SortableTh
                  columnKey="sizeCategory"
                  sortKey={sortKey}
                  sortDir={sortDir}
                  onSort={onPanelSort}
                  className="hidden min-w-0 py-2.5 px-2 align-middle md:table-cell"
                >
                  Категория
                </SortableTh>
                <SortableTh
                  columnKey="cooperation"
                  sortKey={sortKey}
                  sortDir={sortDir}
                  onSort={onPanelSort}
                  className="hidden min-w-0 py-2.5 px-2 align-middle md:table-cell"
                >
                  Условия
                </SortableTh>
                <SortableTh
                  columnKey="employee"
                  sortKey={sortKey}
                  sortDir={sortDir}
                  onSort={onPanelSort}
                  className="hidden min-w-0 py-2.5 px-2 align-middle md:table-cell"
                >
                  Сотрудник
                </SortableTh>
                <SortableTh
                  columnKey="release"
                  sortKey={sortKey}
                  sortDir={sortDir}
                  onSort={onPanelSort}
                  align="right"
                  className="min-w-0 px-2 py-2.5 align-middle tabular-nums leading-tight max-md:w-[18%] max-md:whitespace-nowrap max-md:[&>button]:justify-start max-md:[&>button]:text-left"
                >
                  <span className="block whitespace-nowrap max-md:text-left md:text-right">
                    Дата выхода
                  </span>
                </SortableTh>
                <th className="hidden min-w-0 py-2.5 px-2 text-right align-middle md:table-cell">Бюджет, ₽</th>
              </tr>
            </thead>
            <tbody>
              {sortedIntegrations.map((row) => {
                const contractorName = byContractor.get(row.contractorId) ?? "—";
                const co = contractorById.get(row.contractorId);
                const nicheCell = co?.nicheId
                  ? nicheChoiceCaption(
                      nicheOptions.find((n) => n.id === co.nicheId)?.label ?? "—",
                    )
                  : "—";
                const sizeCell = co?.sizeCategory
                  ? CONTRACTOR_SIZE_CATEGORY_LABELS[co.sizeCategory]
                  : "—";
                const coopCell = row.cooperationType
                  ? INTEGRATION_COOPERATION_LABELS[row.cooperationType]
                  : "—";
                const social = socialOptions.find((o) => o.id === row.socialNetworkId);
                const created = row.createdAt ?? "";
                const assignee = row.assignedEmployeeId
                  ? byEmployee.get(row.assignedEmployeeId)
                  : undefined;
                const isHighlighted = highlightId === row.id;
                const isSelected = selectedIds.has(row.id);
                return (
                  <tr
                    key={row.id}
                    role="button"
                    tabIndex={0}
                    onClick={() => openRow(row.id)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter" || e.key === " ") {
                        e.preventDefault();
                        openRow(row.id);
                      }
                    }}
                    className={`cursor-pointer transition hover:bg-app-fg/[0.04] ${tableBodyRowBorderClass} ${
                      isHighlighted ? "bg-app-accent/10" : ""
                    } ${isSelected ? "bg-app-fg/[0.06]" : ""} ${
                      selectedId === row.id ? "ring-1 ring-inset ring-app-accent/40" : ""
                    }`}
                  >
                    {showBulkColumn ? (
                      <td
                        className="w-8 px-1 py-2.5 align-middle"
                        onClick={(e) => e.stopPropagation()}
                      >
                        <input
                          type="checkbox"
                          checked={isSelected}
                          onChange={() => toggleSelected(row.id)}
                          aria-label={`Выбрать ${row.title ?? row.id}`}
                          className="h-3.5 w-3.5 accent-app-accent"
                        />
                      </td>
                    ) : null}
                    <td
                      className="min-w-0 px-2 py-2.5 align-middle max-md:w-[26%] max-md:whitespace-nowrap"
                      onClick={(e) => e.stopPropagation()}
                    >
                      {isAdmin ? (
                        <StatusBadgeDropdown
                          value={row.status}
                          options={INTEGRATION_STATUSES.map((s) => ({
                            value: s,
                            label: INTEGRATION_STATUS_LABELS[s],
                          }))}
                          badgeClass={STATUS_BADGE_CLASS[row.status]}
                          onChange={(s) =>
                            updateIntegration(row.id, {
                              status: s as IntegrationStatus,
                            })
                          }
                        />
                      ) : (
                        <CrmPill className={STATUS_BADGE_CLASS[row.status]}>
                          {INTEGRATION_STATUS_LABELS[row.status]}
                        </CrmPill>
                      )}
                    </td>
                    <td className="min-w-0 px-2 py-2.5 text-center align-middle max-md:w-[20%] max-md:whitespace-nowrap">
                      <CrmPill className={CHANNEL_BADGE_CLASS}>
                        {social?.label ?? row.socialNetworkId}
                      </CrmPill>
                    </td>
                    <td className="min-w-0 truncate px-2 py-2.5 align-middle max-md:w-[36%]">
                      <span
                        className="block min-w-0 truncate font-medium text-app-fg"
                        title={row.title ?? undefined}
                      >
                        {row.title}
                      </span>
                    </td>
                    <td className="hidden min-w-0 whitespace-nowrap px-2 py-2.5 text-right align-middle tabular-nums text-app-fg/55 md:table-cell">
                      {formatRuDate(created)}
                    </td>
                    <td className="hidden min-w-0 whitespace-nowrap px-2 py-2.5 text-right align-middle tabular-nums text-app-fg/55 md:table-cell">
                      {formatRuTime(created)}
                    </td>
                    <td className="hidden min-w-0 truncate px-2 py-2.5 align-middle font-semibold text-app-fg md:table-cell">
                      {contractorName}
                    </td>
                    <td className="hidden min-w-0 truncate px-2 py-2.5 align-middle text-app-fg/80 md:table-cell">
                      {nicheCell}
                    </td>
                    <td className="hidden min-w-0 truncate px-2 py-2.5 align-middle text-app-fg/80 md:table-cell">
                      {sizeCell}
                    </td>
                    <td className="hidden min-w-0 truncate px-2 py-2.5 align-middle text-app-fg/80 md:table-cell">
                      {coopCell}
                    </td>
                    <td className="hidden min-w-0 truncate px-2 py-2.5 align-middle text-[10px] text-app-fg/75 sm:text-xs md:table-cell">
                      {assignee ? abbreviateFio(assignee.fullName) : "—"}
                    </td>
                    <td
                      className="min-w-0 truncate px-2 py-2.5 align-middle text-[10px] tabular-nums text-app-fg/70 max-md:w-[18%] max-md:text-left max-md:whitespace-nowrap md:text-right sm:text-xs"
                      title={
                        row.releaseDate?.trim() || row.releaseTime?.trim()
                          ? formatIntegrationReleaseLine(row.releaseDate, row.releaseTime)
                          : undefined
                      }
                    >
                      {formatIntegrationReleaseDateTable(row.releaseDate)}
                    </td>
                    <td className="hidden min-w-0 px-2 py-2 text-right tabular-nums text-app-fg/80 md:table-cell">
                      {(() => {
                        const positions = row.positions ?? [];
                        if (positions.length > 0) {
                          const sum = positions.reduce((s, p) => s + (p.budget ?? 0), 0);
                          return sum > 0 ? formatRuMoney(sum) : "—";
                        }
                        return row.budget != null ? formatRuMoney(row.budget) : "—";
                      })()}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {integrations.length === 0 && (
        <div className="flex flex-col items-center gap-4 border border-dashed border-app-fg/15 px-4 py-12 text-center">
          <p className="text-sm text-app-fg/55">Интеграций пока нет.</p>
          {isAdmin && canAdd ? (
            <button type="button" onClick={openAddModal} className={primaryActionButtonClass}>
              <Plus className="h-4 w-4" strokeWidth={1.5} />
              Создать первую интеграцию
            </button>
          ) : isAdmin && contractors.length === 0 ? (
            <Link href="/contractors" className={primaryActionButtonClass}>
              <Plus className="h-4 w-4" strokeWidth={1.5} />
              Создать первого контрагента
            </Link>
          ) : !isAdmin ? (
            <p className="text-xs text-app-fg/45">Попросите администратора создать интеграцию.</p>
          ) : null}
        </div>
      )}

      {isAdmin ? (
        <button
          type="button"
          onClick={openAddModal}
          className="fixed bottom-[4.5rem] right-4 z-40 flex h-14 w-14 items-center justify-center rounded-full bg-app-accent text-app-fg shadow-lg transition hover:brightness-125 md:hidden"
          aria-label="Добавить интеграцию"
        >
          <Plus className="h-6 w-6" strokeWidth={1.5} />
        </button>
      ) : null}

      <SlideOver
        open={Boolean(isAdmin && isAddOpen)}
        onClose={closeAddModal}
        title="Новая интеграция"
        footer={
          canAdd ? (
            <div className="flex gap-2">
              <button
                type="button"
                onClick={closeAddModal}
                className="inline-flex flex-1 items-center justify-center border border-app-fg/15 px-4 py-2.5 text-xs font-semibold uppercase tracking-wide text-app-fg/80 transition hover:border-app-fg/40"
              >
                Отмена
              </button>
              <button
                type="submit"
                form="add-integration-form"
                className={`${primaryActionButtonClass} flex-1`}
              >
                Создать
              </button>
            </div>
          ) : undefined
        }
      >
            {!canAdd ? (
              <p className="p-4 text-sm text-app-fg/55">
                Добавьте контрагентов и проверьте список площадок в данных панели.
              </p>
            ) : (
              <form id="add-integration-form" onSubmit={handleAddSubmit} className="space-y-4">
                {addFormError ? (
                  <p className="border border-app-fg/20 bg-app-fg/5 px-3 py-2 text-xs text-app-fg/90">
                    {addFormError}
                  </p>
                ) : null}

                <label className="block text-xs uppercase tracking-wider text-app-fg/55">
                  Заголовок в списке
                  <input
                    value={title}
                    onChange={(e) => setTitle(e.target.value)}
                    required
                    placeholder="Уникальное название"
                    className={`${fieldClass} mt-1`}
                  />
                </label>

                <div>
                  <p className="mb-2 text-xs uppercase tracking-wider text-app-fg/55">Контрагент</p>
                  <button
                    type="button"
                    onClick={() => setIsContractorPickerOpen(true)}
                    className="w-full border border-app-fg/15 bg-app-bg px-3 py-2.5 text-left text-sm text-app-fg outline-none ring-app-accent/35 transition hover:border-app-fg/40"
                  >
                    {contractorId
                      ? (() => {
                          const selected = contractors.find((c) => c.id === contractorId);
                          if (!selected) return "Выбрать контрагента";
                          return `${(selected.contactPerson?.trim() || selected.name).toUpperCase()} · ${selected.name}`;
                        })()
                      : "Выбрать контрагента"}
                  </button>
                </div>

                <div className="grid gap-3 sm:grid-cols-2">
                  <label className="text-xs uppercase tracking-wider text-app-fg/55">
                    Соцсеть / площадка
                    <select
                      value={socialNetworkId}
                      onChange={(e) => setSocialNetworkId(e.target.value)}
                      required
                      className={`${fieldClass} mt-1 ${selectNativeChevronPad}`}
                    >
                      {socialOptions.map((o) => (
                        <option key={o.id} value={o.id}>
                          {o.label}
                        </option>
                      ))}
                    </select>
                  </label>
                  <label className="text-xs uppercase tracking-wider text-app-fg/55">
                    Статус
                    <select
                      value={status}
                      onChange={(e) => setStatus(e.target.value as IntegrationStatus)}
                      className={`${fieldClass} mt-1 ${selectNativeChevronPad}`}
                    >
                      {INTEGRATION_STATUSES.map((s) => (
                        <option key={s} value={s}>
                          {INTEGRATION_STATUS_LABELS[s]}
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
                      value={releaseDate}
                      onChange={(e) => setReleaseDate(e.target.value)}
                      className={`${fieldClass} mt-1`}
                    />
                  </label>
                  <label className="block text-xs uppercase tracking-wider text-app-fg/55">
                    Время выхода
                    <input
                      type="time"
                      value={releaseTime}
                      onChange={(e) => setReleaseTime(e.target.value)}
                      className={`${fieldClass} mt-1`}
                    />
                  </label>
                </div>

                <details className="border border-app-fg/10">
                  <summary className="cursor-pointer list-none px-3 py-2.5 text-xs font-semibold uppercase tracking-wide text-app-fg/70 [&::-webkit-details-marker]:hidden">
                    ▸ Дополнительно
                  </summary>
                  <div className="space-y-4 border-t border-app-fg/10 px-3 py-3">
                    <label className="block text-xs uppercase tracking-wider text-app-fg/55">
                      Условия сотрудничества
                      <select
                        value={cooperationType}
                        onChange={(e) =>
                          setCooperationType(
                            (e.target.value as IntegrationCooperationType | "") || "",
                          )
                        }
                        className={`${fieldClass} mt-1 ${selectNativeChevronPad}`}
                      >
                        <option value="">Не указано</option>
                        <option value="barter">Бартер</option>
                        <option value="commercial">Коммерция</option>
                      </select>
                    </label>

                    <div className="grid gap-3 sm:grid-cols-2">
                      <label className="block text-xs uppercase tracking-wider text-app-fg/55">
                        Бюджет, ₽
                        <input
                          type="text"
                          inputMode="decimal"
                          autoComplete="off"
                          value={budgetInput}
                          onChange={(e) => setBudgetInput(e.target.value)}
                          placeholder="необязательно"
                          className={`${fieldClass} mt-1 tabular-nums`}
                        />
                      </label>
                      <label className="block text-xs uppercase tracking-wider text-app-fg/55">
                        Охваты, шт.
                        <input
                          type="text"
                          inputMode="decimal"
                          autoComplete="off"
                          value={reachInput}
                          onChange={(e) => setReachInput(e.target.value)}
                          placeholder="необязательно"
                          className={`${fieldClass} mt-1 tabular-nums`}
                        />
                      </label>
                      <label className="block text-xs uppercase tracking-wider text-app-fg/55 sm:col-span-2">
                        Ссылка на интеграцию
                        <input
                          type="url"
                          inputMode="url"
                          autoComplete="url"
                          value={linkInput}
                          onChange={(e) => setLinkInput(e.target.value)}
                          placeholder="https://… пост, ролик, сторис"
                          className={`${fieldClass} mt-1 font-mono text-[13px]`}
                        />
                      </label>
                    </div>

                    <div>
                      <label className="block text-xs uppercase tracking-wider text-app-fg/55">
                        Сотрудник
                      </label>
                      <select
                        value={formEmployeeId}
                        onChange={(e) => setFormEmployeeId(e.target.value)}
                        className={`${fieldClass} mt-1 ${selectNativeChevronPad}`}
                      >
                        <option value="">Без сотрудника</option>
                        {employees.map((e) => (
                          <option key={e.id} value={e.id}>
                            {e.fullName}
                          </option>
                        ))}
                      </select>
                    </div>
                  </div>
                </details>

              </form>
            )}
      </SlideOver>

      <SlideOver
        open={Boolean(selectedId)}
        onClose={closeDetail}
        widthClass="md:max-w-2xl"
        hideHeader
      >
        {selectedId ? (
          <IntegrationDetailScreen
            integrationId={selectedId}
            variant="drawer"
            onClose={closeDetail}
          />
        ) : null}
      </SlideOver>

      <ContractorListModal
        open={isContractorPickerOpen && isAddOpen}
        onClose={() => setIsContractorPickerOpen(false)}
        contractors={contractors}
        onPick={setContractorId}
      />
    </div>
  );
}
