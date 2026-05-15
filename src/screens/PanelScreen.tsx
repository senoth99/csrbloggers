"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState, type FormEvent } from "react";
import { Plus, Search, ChevronDown, X } from "lucide-react";
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

export function PanelScreen() {
  const router = useRouter();
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
  const [formEmployeeId, setFormEmployeeId] = useState<string>("");
  const [monthFilter, setMonthFilter] = useState<string>("all");

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
      router.push(`/integrations/${id}`);
    } else {
      setAddFormError("Не удалось создать интеграцию (заголовок занят или нет данных).");
    }
  }

  function openRow(id: string) {
    router.push(`/integrations/${id}`);
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
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <h1 className="text-lg font-bold uppercase tracking-[0.12em] text-app-fg min-[400px]:text-xl md:text-2xl">
          Интеграции
        </h1>
        {isAdmin && (
          <button
            type="button"
            onClick={openAddModal}
            className={`${primaryActionButtonClass} w-full shrink-0 sm:w-auto`}
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
            onClick={() => setMobileFiltersOpen((o) => !o)}
            aria-expanded={mobileFiltersOpen}
            className="flex w-full min-h-[44px] items-center justify-between gap-2 border border-app-fg/15 bg-app-bg px-3 py-2.5 text-left text-xs font-semibold uppercase tracking-wide text-app-fg transition hover:border-app-fg/30 md:hidden"
          >
            <span>Фильтры</span>
            <ChevronDown
              className={`h-4 w-4 shrink-0 text-app-fg/50 transition-transform ${mobileFiltersOpen ? "rotate-180" : ""}`}
              strokeWidth={2}
              aria-hidden
            />
          </button>
          <div
            className={`grid grid-cols-1 gap-2 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 ${mobileFiltersOpen ? "" : "max-md:hidden"}`}
          >
            <select
              value={statusFilter}
              onChange={(e) =>
                setStatusFilter(e.target.value === "all" ? "all" : (e.target.value as IntegrationStatus))
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
            <select
              value={monthFilter}
              onChange={(e) => setMonthFilter(e.target.value)}
              aria-label="Фильтр по месяцу"
              className={filterSelectClass}
            >
              <option value="all">Все месяцы</option>
              {monthOptions.map((o) => (
                <option key={o.value} value={o.value}>{o.label}</option>
              ))}
            </select>
          </div>
        </div>
      )}

      {integrations.length > 0 && filteredIntegrations.length === 0 && (
        <p className="border border-dashed border-app-fg/15 px-4 py-8 text-center text-sm text-app-fg/55">
          Нет строк по текущему фильтру. Измените поиск или сбросьте фильтры.
        </p>
      )}

      {integrations.length > 0 && filteredIntegrations.length > 0 && (
        <div className="min-w-0 max-w-full overflow-x-auto rounded-md border border-app-fg/10 bg-app-bg px-2.5 [-webkit-overflow-scrolling:touch] sm:px-3 md:px-0">
          <table className="w-full min-w-0 max-w-full table-auto border-separate border-spacing-0 text-left text-[10px] leading-tight text-app-fg max-md:table-fixed sm:text-xs md:min-w-[960px]">
            <thead>
              <tr
                className={`bg-app-bg text-[10px] font-semibold uppercase tracking-wide text-app-fg/50 ${tableHeadRowBorderClass}`}
              >
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
                    className={`cursor-pointer transition hover:bg-app-fg/[0.04] ${tableBodyRowBorderClass}`}
                  >
                    <td className="min-w-0 px-2 py-2.5 align-middle max-md:w-[26%] max-md:whitespace-nowrap">
                      <CrmPill className={STATUS_BADGE_CLASS[row.status]}>
                        {INTEGRATION_STATUS_LABELS[row.status]}
                      </CrmPill>
                    </td>
                    <td className="min-w-0 px-2 py-2.5 text-center align-middle max-md:w-[20%] max-md:whitespace-nowrap">
                      <CrmPill className={CHANNEL_BADGE_CLASS}>
                        {social?.label ?? row.socialNetworkId}
                      </CrmPill>
                    </td>
                    <td className="min-w-0 truncate px-2 py-2.5 align-middle max-md:w-[36%]">
                      <Link
                        href={`/integrations/${row.id}`}
                        className="block min-w-0 truncate font-medium text-app-fg"
                        title={row.title ?? undefined}
                        onClick={(e) => e.stopPropagation()}
                      >
                        {row.title}
                      </Link>
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

      {integrations.length === 0 && contractors.length > 0 && (
        <p className="border border-dashed border-app-fg/15 px-4 py-12 text-center text-sm text-app-fg/55">
          Интеграций пока нет.
          {isAdmin ? " Нажмите «Добавить интеграцию»." : ""}
        </p>
      )}

      {isAdmin && isAddOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/65 px-4">
          <div
            role="dialog"
            aria-modal="true"
            aria-labelledby="add-integration-title"
            className="w-full max-w-lg border border-app-fg/15 bg-app-bg p-5 shadow-accent-glow sm:p-6"
          >
            <div className="mb-4 flex items-start justify-between gap-3">
              <h2
                id="add-integration-title"
                className="text-sm font-semibold uppercase tracking-[0.1em] text-app-fg"
              >
                Новая интеграция
              </h2>
              <button
                type="button"
                onClick={closeAddModal}
                className="border border-app-fg/15 p-1.5 text-app-fg/70 transition hover:border-app-fg/40"
                aria-label="Закрыть"
              >
                <X className="h-4 w-4" strokeWidth={1.5} />
              </button>
            </div>

            {!canAdd ? (
              <p className="text-sm text-app-fg/55">
                Добавьте контрагентов и проверьте список площадок в данных панели.
              </p>
            ) : (
              <form onSubmit={handleAddSubmit} className="space-y-4">
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

                <label className="block text-xs uppercase tracking-wider text-app-fg/55">
                  Условия сотрудничества
                  <select
                    value={cooperationType}
                    onChange={(e) =>
                      setCooperationType((e.target.value as IntegrationCooperationType | "") || "")
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
                  <label className="block text-xs uppercase tracking-wider text-app-fg/55">Сотрудник</label>
                  <select
                    value={formEmployeeId}
                    onChange={(e) => setFormEmployeeId(e.target.value)}
                    className={`${fieldClass} mt-1 ${selectNativeChevronPad}`}
                  >
                    <option value="">Без сотрудника</option>
                    {employees.map((e) => (
                      <option key={e.id} value={e.id}>{e.fullName}</option>
                    ))}
                  </select>
                </div>

                <div className="flex flex-wrap gap-2 pt-1">
                  <button
                    type="submit"
                    className={`${primaryActionButtonClass} flex-1 sm:flex-none`}
                  >
                    Создать
                  </button>
                  <button
                    type="button"
                    onClick={closeAddModal}
                    className="inline-flex flex-1 items-center justify-center border border-app-fg/15 px-4 py-2.5 text-xs font-semibold uppercase tracking-wide text-app-fg/80 transition hover:border-app-fg/40 sm:flex-none"
                  >
                    Отмена
                  </button>
                </div>
              </form>
            )}
          </div>
        </div>
      )}

      <ContractorListModal
        open={isContractorPickerOpen && isAddOpen}
        onClose={() => setIsContractorPickerOpen(false)}
        contractors={contractors}
        onPick={setContractorId}
      />
    </div>
  );
}
