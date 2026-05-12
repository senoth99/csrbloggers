"use client";

import { useRouter } from "next/navigation";
import { useMemo, useState, type FormEvent } from "react";
import { Plus, Search, X } from "lucide-react";
import { usePanelData } from "@/context/PanelDataContext";
import { ContractorRatingBadge } from "@/components/ContractorRatingBadge";
import { SortableTh } from "@/components/SortableTh";
import { computeContractorRating10 } from "@/lib/contractor-rating";
import { useTableSort } from "@/hooks/useTableSort";
import { nicheChoiceCaption } from "@/lib/niche-display";
import { compareNumbers, compareStringsRu } from "@/lib/table-sort";
import {
  CONTRACTOR_SIZE_CATEGORY_LABELS,
  CONTRACTOR_SIZE_CATEGORIES,
  CONTRACTOR_STATUS_LABELS,
} from "@/types/panel-data";
import {
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

export function ContractorsScreen() {
  const router = useRouter();
  const { sort, toggleSort, sortKey, sortDir } = useTableSort<ContractorSortKey>();
  const {
    contractors,
    integrations,
    contractorItems,
    nicheOptions,
    isAdmin,
    addContractor,
  } = usePanelData();
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [fullName, setFullName] = useState("");
  const [nickname, setNickname] = useState("");
  const [cityInput, setCityInput] = useState("");
  const [promoCodeInput, setPromoCodeInput] = useState("");
  const [viralityInput, setViralityInput] = useState("");
  const [nicheIdInput, setNicheIdInput] = useState("");
  const [sizeCategoryInput, setSizeCategoryInput] = useState<string>("");
  const [tableSearch, setTableSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<"all" | "active" | "paused">("all");

  const integrationCountByContractor = useMemo(() => {
    const map = new Map<string, number>();
    for (const row of integrations) {
      map.set(row.contractorId, (map.get(row.contractorId) ?? 0) + 1);
    }
    return map;
  }, [integrations]);

  const rating10ByContractorId = useMemo(() => {
    const map = new Map<string, number>();
    for (const c of contractors) {
      const ints = integrations.filter((i) => i.contractorId === c.id);
      const nItems = contractorItems.filter((it) => it.contractorId === c.id).length;
      map.set(c.id, computeContractorRating10(ints, nItems));
    }
    return map;
  }, [contractors, integrations, contractorItems]);

  function handleAdd(e: FormEvent) {
    e.preventDefault();
    if (!fullName.trim() || !nickname.trim()) return;
    const hasSize =
      sizeCategoryInput === "micro" ||
      sizeCategoryInput === "middle" ||
      sizeCategoryInput === "large";
    addContractor({
      name: nickname,
      contactPerson: fullName,
      ...(cityInput.trim() ? { city: cityInput.trim() } : {}),
      ...(promoCodeInput.trim() ? { promoCode: promoCodeInput.trim() } : {}),
      ...(viralityInput.trim() ? { virality: viralityInput.trim() } : {}),
      ...(nicheIdInput.trim() ? { nicheId: nicheIdInput.trim() } : {}),
      ...(hasSize ? { sizeCategory: sizeCategoryInput } : {}),
    });
    setFullName("");
    setNickname("");
    setCityInput("");
    setPromoCodeInput("");
    setViralityInput("");
    setNicheIdInput("");
    setSizeCategoryInput("");
    setIsCreateOpen(false);
  }

  function openRow(id: string) {
    router.push(`/contractors/${id}`);
  }

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

  const filterField = `min-h-[42px] w-full border border-app-fg/15 bg-app-bg px-3 py-2.5 text-sm text-app-fg outline-none ring-app-accent/35 focus:ring-2 ${selectNativeChevronPad}`;

  return (
    <div className="w-full max-w-full space-y-4">
      <div className="flex items-center justify-between gap-3">
        <h1 className="text-xl font-bold uppercase tracking-[0.12em] text-app-fg md:text-2xl">
          Контрагенты
        </h1>
        {isAdmin && (
          <button
            type="button"
            onClick={() => setIsCreateOpen(true)}
            className={primaryActionButtonClass}
          >
            <Plus className="h-4 w-4" strokeWidth={1.5} />
            Создать контрагента
          </button>
        )}
      </div>

      {contractors.length > 0 && (
        <div className="grid grid-cols-1 gap-2 sm:grid-cols-[minmax(0,1fr)_auto]">
          <label className="relative min-w-0 sm:col-span-1">
            <Search
              className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-app-fg/35"
              aria-hidden
            />
            <input
              type="search"
              value={tableSearch}
              onChange={(e) => setTableSearch(e.target.value)}
              placeholder="Поиск по ФИО, нику, вирусности, статусу, числу интеграций…"
              className="w-full border border-app-fg/15 bg-app-bg py-2.5 pl-9 pr-3 text-sm text-app-fg outline-none ring-app-accent/35 focus:ring-2"
              aria-label="Поиск в таблице"
            />
          </label>
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
      )}

      {contractors.length > 0 && filteredContractors.length === 0 && (
        <p className="border border-dashed border-app-fg/15 px-4 py-8 text-center text-sm text-app-fg/55">
          Нет строк по текущему фильтру.
        </p>
      )}

      {contractors.length > 0 && filteredContractors.length > 0 && (
        <div className="overflow-x-auto bg-app-bg">
          <table className="w-full min-w-[1100px] border-separate border-spacing-0 text-left text-[11px] leading-tight text-app-fg sm:text-xs">
            <thead>
              <tr
                className={`bg-app-bg text-[10px] font-semibold uppercase tracking-wide text-app-fg/50 ${tableHeadRowBorderClass}`}
              >
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
                  ФИО
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
                    className={`cursor-pointer transition hover:bg-app-fg/[0.04] ${tableBodyRowBorderClass}`}
                  >
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
        </div>
      )}

      {contractors.length === 0 && (
        <p className="border border-dashed border-app-fg/15 px-4 py-12 text-center text-sm text-app-fg/55">
          Контрагентов пока нет.
          {isAdmin ? " Создайте первого кнопкой справа сверху." : ""}
        </p>
      )}

      {isCreateOpen && isAdmin && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/65 px-4">
          <div className="w-full max-w-lg border border-app-fg/15 bg-app-bg p-5 shadow-accent-glow sm:p-6">
            <div className="mb-4 flex items-start justify-between gap-3">
              <h2 className="text-base font-semibold uppercase tracking-[0.1em] text-app-fg">
                Создать контрагента
              </h2>
              <button
                type="button"
                onClick={() => setIsCreateOpen(false)}
                className="border border-app-fg/15 p-1.5 text-app-fg/70 transition hover:border-app-fg/40"
                aria-label="Закрыть"
              >
                <X className="h-4 w-4" strokeWidth={1.5} />
              </button>
            </div>

            <form onSubmit={handleAdd} className="space-y-3">
              <label className="block text-xs uppercase tracking-wider text-app-fg/55">
                ФИО
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
                  placeholder="Необязательно, произвольный текст"
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

              <button
                type="submit"
                className={`${primaryActionButtonClass} w-full`}
              >
                <Plus className="h-4 w-4" strokeWidth={1.5} />
                Создать
              </button>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
