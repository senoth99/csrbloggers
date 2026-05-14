"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useRef, useState, type FormEvent } from "react";
import { ChevronDown, Plus, Search, X } from "lucide-react";
import { useAuth } from "@/context/AuthContext";
import { usePanelData } from "@/context/PanelDataContext";
import { abbreviateFio, findEmployeeIdByPanelSession } from "@/lib/employee-utils";
import { SortableTh } from "@/components/SortableTh";
import { useTableSort } from "@/hooks/useTableSort";
import { compareNumbers, compareStringsRu } from "@/lib/table-sort";
import {
  DELIVERY_STATUS_LABELS,
  type Delivery,
  type DeliveryStatus,
} from "@/types/panel-data";
import {
  primaryActionButtonClass,
  selectNativeChevronPad,
  tableBodyRowBorderClass,
  tableHeadRowBorderClass,
} from "@/screens/dashboard-shared";

const STATUS_ORDER: DeliveryStatus[] = [
  "created",
  "in_transit",
  "in_pickup",
  "delivered",
  "returned",
];

type DeliverySortKey = "status" | "order" | "track" | "contractor" | "employee" | "items";

function deliveryStatusIndex(s: DeliveryStatus): number {
  const i = STATUS_ORDER.indexOf(s);
  return i >= 0 ? i : 0;
}
const PRODUCTS_API_URL = "/api/casher-products";
const API_ORIGIN = "https://api.cashercollection.com";

const CDEK_REFRESH_INTERVAL_MS = 30 * 60 * 1000;

function statusClass(status: DeliveryStatus): string {
  if (status === "delivered") return "border border-transparent bg-app-accent text-app-fg";
  if (status === "returned") return "border border-transparent bg-amber-950/40 text-amber-100";
  if (status === "in_transit") return "border border-transparent bg-app-accent/85 text-app-fg";
  if (status === "in_pickup") return "border border-transparent bg-app-fg/[0.1] text-app-fg";
  return "border border-transparent bg-app-fg/[0.08] text-app-fg/75";
}

function buildImageUrl(raw?: string): string {
  if (!raw) return "";
  if (raw.startsWith("http://") || raw.startsWith("https://")) return raw;
  return `${API_ORIGIN}${raw.startsWith("/") ? raw : `/${raw}`}`;
}

export function DeliveriesScreen() {
  const { sort, toggleSort, sortKey, sortDir } = useTableSort<DeliverySortKey>();
  const { currentUsername } = useAuth();
  const {
    contractors,
    deliveries,
    employees,
    isAdmin,
    addDelivery,
    updateDeliveryStatus,
  } = usePanelData();

  const [isAddOpen, setIsAddOpen] = useState(false);
  const [contractorId, setContractorId] = useState("");
  const [orderNumber, setOrderNumber] = useState("");
  const [trackNumber, setTrackNumber] = useState("");
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<DeliveryStatus | "all">("all");
  const [contractorFilter, setContractorFilter] = useState<string>("all");
  const [isStatusListOpen, setIsStatusListOpen] = useState(false);
  const [isContractorPickerOpen, setIsContractorPickerOpen] = useState(false);
  const [contractorSearch, setContractorSearch] = useState("");
  const [isItemPickerOpen, setIsItemPickerOpen] = useState(false);
  const [itemSearch, setItemSearch] = useState("");
  const [selectedItems, setSelectedItems] = useState<
    Array<{ productId: string; productName: string; size: string; imageUrl?: string }>
  >([]);
  const [selectedProductId, setSelectedProductId] = useState("");
  const [selectedSize, setSelectedSize] = useState("");
  const [cdekBanner, setCdekBanner] = useState<{
    kind: "error" | "info";
    text: string;
  } | null>(null);
  const [products, setProducts] = useState<
    Array<{
      id?: string | number;
      name?: string;
      images?: string[];
      isDeleted?: boolean;
      popularityRank?: number;
      sizes?: Array<{ size?: string; isVisible?: boolean }>;
    }>
  >([]);

  const deliveriesRef = useRef(deliveries);
  deliveriesRef.current = deliveries;

  const byEmployee = useMemo(() => {
    const m = new Map<string, (typeof employees)[number]>();
    employees.forEach((e) => m.set(e.id, e));
    return m;
  }, [employees]);

  const filteredDeliveries = useMemo(() => {
    const q = search.trim().toLowerCase();
    return deliveries.filter((delivery) => {
      if (contractorFilter !== "all" && delivery.contractorId !== contractorFilter) {
        return false;
      }
      if (statusFilter !== "all" && delivery.status !== statusFilter) return false;
      if (!q) return true;
      const contractor = contractors.find((c) => c.id === delivery.contractorId);
      const name = `${contractor?.name ?? ""} ${contractor?.contactPerson ?? ""}`.toLowerCase();
      const assignee = delivery.assignedEmployeeId
        ? byEmployee.get(delivery.assignedEmployeeId)
        : undefined;
      const empQ = assignee ? abbreviateFio(assignee.fullName).toLowerCase() : "";
      return (
        delivery.orderNumber?.toLowerCase().includes(q) ||
        delivery.trackNumber.toLowerCase().includes(q) ||
        name.includes(q) ||
        empQ.includes(q) ||
        DELIVERY_STATUS_LABELS[delivery.status].toLowerCase().includes(q)
      );
    });
  }, [deliveries, statusFilter, search, contractors, contractorFilter, byEmployee]);

  const sortedDeliveries = useMemo(() => {
    const rows = [...filteredDeliveries];
    if (!sort) return rows;
    const m = sort.dir === "asc" ? 1 : -1;
    rows.sort((a, b) => {
      let cmp = 0;
      switch (sort.key) {
        case "status":
          cmp =
            deliveryStatusIndex(a.status) - deliveryStatusIndex(b.status);
          break;
        case "order":
          cmp = compareStringsRu(a.orderNumber?.trim() ?? "", b.orderNumber?.trim() ?? "");
          break;
        case "track":
          cmp = compareStringsRu(a.trackNumber, b.trackNumber);
          break;
        case "contractor": {
          const ca = contractors.find((c) => c.id === a.contractorId);
          const cb = contractors.find((c) => c.id === b.contractorId);
          cmp = compareStringsRu(
            ca?.contactPerson?.trim() || ca?.name || "",
            cb?.contactPerson?.trim() || cb?.name || "",
          );
          break;
        }
        case "employee": {
          const ea = a.assignedEmployeeId
            ? abbreviateFio(byEmployee.get(a.assignedEmployeeId)?.fullName ?? "")
            : "";
          const eb = b.assignedEmployeeId
            ? abbreviateFio(byEmployee.get(b.assignedEmployeeId)?.fullName ?? "")
            : "";
          cmp = compareStringsRu(ea, eb);
          break;
        }
        case "items":
          cmp = compareNumbers(
            a.items?.length ?? a.itemIds?.length ?? 0,
            b.items?.length ?? b.itemIds?.length ?? 0,
          );
          break;
        default:
          break;
      }
      if (cmp !== 0) return m * cmp;
      return compareStringsRu(a.id, b.id);
    });
    return rows;
  }, [filteredDeliveries, sort, contractors, byEmployee]);

  const onDeliverySort = (key: string) => toggleSort(key as DeliverySortKey);

  const filteredContractors = useMemo(() => {
    const q = contractorSearch.trim().toLowerCase();
    if (!q) return contractors;
    return contractors.filter((contractor) => {
      const fio = (contractor.contactPerson ?? "").toLowerCase();
      const nick = (contractor.name ?? "").toLowerCase();
      return fio.includes(q) || nick.includes(q);
    });
  }, [contractors, contractorSearch]);

  const filteredProducts = useMemo(() => {
    const q = itemSearch.trim().toLowerCase();
    const base = q
      ? products.filter((product) => (product.name ?? "").toLowerCase().includes(q))
      : products.filter((product) => product.isDeleted !== true);
    return [...base].sort(
      (a, b) =>
        (a.popularityRank ?? Number.POSITIVE_INFINITY) -
        (b.popularityRank ?? Number.POSITIVE_INFINITY),
    );
  }, [products, itemSearch]);

  const selectedProduct = useMemo(
    () => filteredProducts.find((p) => String(p.id ?? "") === selectedProductId),
    [filteredProducts, selectedProductId],
  );

  const sizeOptions = useMemo(() => {
    if (!selectedProduct) return [];
    return (selectedProduct.sizes ?? [])
      .filter((s) => s.isVisible === true)
      .map((s) => (s.size ?? "").trim().toUpperCase())
      .filter(Boolean);
  }, [selectedProduct]);

  const refreshStatuses = useCallback(
    async (rows: Delivery[], options?: { silent?: boolean }) => {
      if (rows.length === 0) return;
      const silent = options?.silent === true;
      if (!silent) setCdekBanner(null);
      const errors = new Set<string>();
      const infos = new Set<string>();
      await Promise.all(
        rows.map(async (row) => {
          try {
            const params = new URLSearchParams();
            params.set("track", row.trackNumber);
            const orderNum = row.orderNumber?.trim();
            if (orderNum) params.set("orderNumber", orderNum);
            const res = await fetch(`/api/cdek/status?${params.toString()}`, {
              cache: "no-store",
            });
            const payload = (await res.json()) as {
              status?: DeliveryStatus;
              error?: string;
              message?: string;
            };
            if (!res.ok) {
              errors.add(payload.error?.trim() || `Ошибка запроса (${res.status}).`);
              return;
            }
            if (payload.status) {
              updateDeliveryStatus(row.id, payload.status);
            }
            if (payload.message?.trim()) {
              infos.add(payload.message.trim());
            }
          } catch {
            errors.add("Не удалось выполнить запрос к серверу.");
          }
        }),
      );
      if (!silent) {
        if (errors.size > 0) {
          setCdekBanner({ kind: "error", text: Array.from(errors).join(" ") });
        } else if (infos.size > 0) {
          setCdekBanner({ kind: "info", text: Array.from(infos).join(" ") });
        }
      }
    },
    [updateDeliveryStatus],
  );

  useEffect(() => {
    if (cdekBanner) {
      const t = window.setTimeout(() => setCdekBanner(null), 14000);
      return () => window.clearTimeout(t);
    }
  }, [cdekBanner]);

  useEffect(() => {
    const run = () => {
      void refreshStatuses(deliveriesRef.current, { silent: true });
    };
    run();
    const intervalId = window.setInterval(run, CDEK_REFRESH_INTERVAL_MS);
    return () => window.clearInterval(intervalId);
  }, [refreshStatuses]);

  useEffect(() => {
    let active = true;
    async function loadProducts() {
      try {
        const response = await fetch(PRODUCTS_API_URL, { cache: "no-store" });
        if (!response.ok) return;
        const payload = (await response.json()) as unknown;
        if (!active || !Array.isArray(payload)) return;
        setProducts(
          payload as Array<{
            id?: string | number;
            name?: string;
            images?: string[];
            isDeleted?: boolean;
            popularityRank?: number;
            sizes?: Array<{ size?: string; isVisible?: boolean }>;
          }>,
        );
      } catch {
        // ignore temporary API failures
      }
    }
    void loadProducts();
    return () => {
      active = false;
    };
  }, []);

  function removeSelectedItem(productId: string, size: string) {
    setSelectedItems((prev) =>
      prev.filter((item) => !(item.productId === productId && item.size === size)),
    );
  }

  function addSelectedItem() {
    if (!selectedProduct || !selectedSize) return;
    const productId = String(selectedProduct.id ?? "").trim();
    const productName = (selectedProduct.name ?? "").trim();
    if (!productId || !productName) return;
    setSelectedItems((prev) => {
      const exists = prev.some(
        (item) => item.productId === productId && item.size === selectedSize,
      );
      if (exists) return prev;
      return [
        ...prev,
        {
          productId,
          productName,
          size: selectedSize,
          imageUrl: buildImageUrl(selectedProduct.images?.[0]),
        },
      ];
    });
    setSelectedProductId("");
    setSelectedSize("");
  }

  function resetForm() {
    setContractorId("");
    setOrderNumber("");
    setTrackNumber("");
    setSelectedItems([]);
    setContractorSearch("");
    setItemSearch("");
    setIsItemPickerOpen(false);
    setSelectedProductId("");
    setSelectedSize("");
  }

  function handleAddTrack(e: FormEvent) {
    e.preventDefault();
    if (!contractorId || !trackNumber.trim()) return;
    const assignedEmployeeId =
      findEmployeeIdByPanelSession(employees, currentUsername) ?? undefined;
    addDelivery({
      contractorId,
      orderNumber: orderNumber.trim(),
      trackNumber: trackNumber.trim(),
      items: selectedItems,
      ...(assignedEmployeeId ? { assignedEmployeeId } : {}),
    });
    resetForm();
    setIsAddOpen(false);
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-xl font-bold uppercase tracking-[0.12em] text-app-fg md:text-2xl">
          Доставки
        </h1>
        <div className="flex flex-wrap items-center gap-2">
          {isAdmin && (
            <button
              type="button"
              onClick={() => setIsAddOpen(true)}
              className={primaryActionButtonClass}
            >
              <Plus className="h-4 w-4" strokeWidth={1.5} />
              Добавить трек
            </button>
          )}
        </div>
      </div>

      {cdekBanner && (
        <div
          className={`flex flex-wrap items-start justify-between gap-3 border px-3 py-2.5 text-sm ${
            cdekBanner.kind === "error"
              ? "border-red-500/45 bg-red-950/40 text-red-100"
              : "border-app-accent/35 bg-app-fg/[0.06] text-app-fg/90"
          }`}
          role="status"
        >
          <p className="min-w-0 flex-1 leading-snug">{cdekBanner.text}</p>
          <button
            type="button"
            onClick={() => setCdekBanner(null)}
            className="shrink-0 border border-current/25 px-2 py-1 text-[11px] font-semibold uppercase tracking-wide transition hover:border-current/50"
          >
            Закрыть
          </button>
        </div>
      )}

      <div className="grid grid-cols-1 gap-2 lg:grid-cols-12 lg:items-stretch">
        <label className="relative lg:col-span-5">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-app-fg/35" />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Поиск по треку, контрагенту, статусу…"
            className="w-full border border-app-fg/15 bg-app-bg py-2.5 pl-9 pr-3 text-sm text-app-fg outline-none ring-app-accent/35 focus:ring-2"
            type="search"
            aria-label="Поиск в списке доставок"
          />
        </label>
        <select
          value={contractorFilter}
          onChange={(e) => setContractorFilter(e.target.value)}
          aria-label="Фильтр по контрагенту"
          className={`min-h-[42px] border border-app-fg/15 bg-app-bg px-3 py-2.5 text-xs font-semibold uppercase tracking-wide text-app-fg outline-none ring-app-accent/35 focus:ring-2 lg:col-span-3 ${selectNativeChevronPad}`}
        >
          <option value="all">Все контрагенты</option>
          {contractors.map((c) => (
            <option key={c.id} value={c.id}>
              {(c.contactPerson?.trim() || c.name).toUpperCase()} · {c.name}
            </option>
          ))}
        </select>
        <div className="relative lg:col-span-4">
          <button
            type="button"
            onClick={() => setIsStatusListOpen((v) => !v)}
            className="inline-flex min-h-[42px] w-full min-w-0 items-center justify-between gap-2 border border-app-fg/15 bg-app-bg py-2.5 pl-3 pr-10 text-xs font-semibold uppercase tracking-wide text-app-fg transition hover:border-app-fg/45"
          >
            <span className="min-w-0 truncate text-left">
              {statusFilter === "all"
                ? "ВСЕ СТАТУСЫ"
                : DELIVERY_STATUS_LABELS[statusFilter].toUpperCase()}
            </span>
            <ChevronDown
              className="h-4 w-4 shrink-0 text-app-fg/70"
              strokeWidth={1.5}
              aria-hidden
            />
          </button>

          {isStatusListOpen && (
            <div className="absolute right-0 z-20 mt-1 w-full border border-app-fg/15 bg-app-bg shadow-accent-glow">
              <button
                type="button"
                onClick={() => {
                  setStatusFilter("all");
                  setIsStatusListOpen(false);
                }}
                className="block w-full px-3 py-2 text-left text-xs font-semibold uppercase tracking-wide text-app-fg/80 transition hover:bg-app-fg/[0.04]"
              >
                ВСЕ СТАТУСЫ
              </button>
              {STATUS_ORDER.map((status) => (
                <button
                  key={status}
                  type="button"
                  onClick={() => {
                    setStatusFilter(status);
                    setIsStatusListOpen(false);
                  }}
                  className="block w-full px-3 py-2 text-left text-xs font-semibold uppercase tracking-wide text-app-fg/80 transition hover:bg-app-fg/[0.04]"
                >
                  {DELIVERY_STATUS_LABELS[status].toUpperCase()}
                </button>
              ))}
            </div>
          )}
        </div>
      </div>

      {deliveries.length === 0 ? (
        <p className="border border-dashed border-app-fg/15 px-4 py-8 text-sm text-app-fg/55">
          Доставок пока нет.
        </p>
      ) : filteredDeliveries.length === 0 ? (
        <p className="border border-dashed border-app-fg/15 px-4 py-8 text-sm text-app-fg/55">
          Нет строк по текущему фильтру. Измените поиск, контрагента или статус.
        </p>
      ) : (
        <div className="overflow-x-auto bg-app-bg">
          <table className="w-full min-w-[760px] border-separate border-spacing-0 text-left text-xs text-app-fg">
            <thead>
              <tr
                className={`text-[10px] font-semibold uppercase tracking-wide text-app-fg/50 ${tableHeadRowBorderClass}`}
              >
                <SortableTh
                  columnKey="status"
                  sortKey={sortKey}
                  sortDir={sortDir}
                  onSort={onDeliverySort}
                  className="px-4 py-2.5"
                >
                  Статус
                </SortableTh>
                <SortableTh
                  columnKey="order"
                  sortKey={sortKey}
                  sortDir={sortDir}
                  onSort={onDeliverySort}
                  className="px-4 py-2.5"
                >
                  Заказ
                </SortableTh>
                <SortableTh
                  columnKey="track"
                  sortKey={sortKey}
                  sortDir={sortDir}
                  onSort={onDeliverySort}
                  className="min-w-[140px] px-4 py-2.5"
                >
                  Трек
                </SortableTh>
                <SortableTh
                  columnKey="contractor"
                  sortKey={sortKey}
                  sortDir={sortDir}
                  onSort={onDeliverySort}
                  className="min-w-[160px] px-4 py-2.5"
                >
                  Контрагент
                </SortableTh>
                <SortableTh
                  columnKey="employee"
                  sortKey={sortKey}
                  sortDir={sortDir}
                  onSort={onDeliverySort}
                  className="min-w-[120px] px-4 py-2.5"
                >
                  Сотрудник
                </SortableTh>
                <SortableTh
                  columnKey="items"
                  sortKey={sortKey}
                  sortDir={sortDir}
                  onSort={onDeliverySort}
                  align="right"
                  className="w-[72px] px-4 py-2.5 tabular-nums"
                >
                  Вещей
                </SortableTh>
              </tr>
            </thead>
            <tbody>
              {sortedDeliveries.map((delivery) => {
                const contractor = contractors.find((c) => c.id === delivery.contractorId);
                const assignee = delivery.assignedEmployeeId
                  ? byEmployee.get(delivery.assignedEmployeeId)
                  : undefined;
                return (
                  <tr
                    key={delivery.id}
                    role="button"
                    tabIndex={0}
                    onClick={() => {
                      window.location.href = `/deliveries/${delivery.id}`;
                    }}
                    onKeyDown={(e) => {
                      if (e.key === "Enter" || e.key === " ") {
                        e.preventDefault();
                        window.location.href = `/deliveries/${delivery.id}`;
                      }
                    }}
                    className={`cursor-pointer transition hover:bg-app-fg/[0.04] ${tableBodyRowBorderClass}`}
                  >
                    <td className="px-4 py-2.5 align-middle">
                      <span
                        className={`inline-flex px-2 py-1 text-[10px] font-semibold uppercase tracking-wide ${statusClass(delivery.status)}`}
                      >
                        {DELIVERY_STATUS_LABELS[delivery.status]}
                      </span>
                    </td>
                    <td className="px-4 py-2.5 align-middle font-medium text-app-fg/85">
                      {delivery.orderNumber?.trim() || "—"}
                    </td>
                    <td className="px-4 py-2.5 align-middle font-medium text-app-fg">
                      {delivery.trackNumber}
                    </td>
                    <td className="max-w-[220px] truncate px-4 py-2.5 align-middle text-app-fg/80">
                      {contractor?.contactPerson?.trim() || contractor?.name || "—"}
                    </td>
                    <td className="max-w-[160px] truncate px-4 py-2.5 align-middle text-app-fg/75">
                      {assignee ? abbreviateFio(assignee.fullName) : "—"}
                    </td>
                    <td className="px-4 py-2.5 text-right align-middle tabular-nums text-app-fg/80">
                      {delivery.items?.length ?? delivery.itemIds?.length ?? 0}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {isAddOpen && isAdmin && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/65 px-4">
          <div className="w-full max-w-3xl border border-app-fg/15 bg-app-bg p-5 shadow-accent-glow sm:p-6">
            <div className="mb-4 flex items-start justify-between gap-3">
              <h2 className="text-base font-semibold uppercase tracking-[0.1em] text-app-fg">
                Добавить трек
              </h2>
              <button
                type="button"
                onClick={() => {
                  setIsAddOpen(false);
                  resetForm();
                }}
                className="border border-app-fg/15 p-1.5 text-app-fg/70 transition hover:border-app-fg/40"
                aria-label="Закрыть"
              >
                <X className="h-4 w-4" strokeWidth={1.5} />
              </button>
            </div>

            <form onSubmit={handleAddTrack} className="space-y-4">
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

              <label className="block text-xs uppercase tracking-wider text-app-fg/55">
                Заказ
                <input
                  value={orderNumber}
                  onChange={(e) => setOrderNumber(e.target.value)}
                  className="mt-1 w-full border border-app-fg/15 bg-app-bg px-3 py-2.5 text-sm text-app-fg outline-none ring-app-accent/35 focus:ring-2"
                />
              </label>

              <label className="block text-xs uppercase tracking-wider text-app-fg/55">
                Трек-номер
                <input
                  value={trackNumber}
                  onChange={(e) => setTrackNumber(e.target.value)}
                  required
                  className="mt-1 w-full border border-app-fg/15 bg-app-bg px-3 py-2.5 text-sm text-app-fg outline-none ring-app-accent/35 focus:ring-2"
                />
              </label>

              <div>
                <p className="mb-2 text-xs uppercase tracking-wider text-app-fg/55">
                  Вещи в этой доставке
                </p>
                {!contractorId ? (
                  <p className="border border-dashed border-app-fg/15 px-3 py-4 text-sm text-app-fg/55">
                    Сначала выберите контрагента.
                  </p>
                ) : (
                  <div className="space-y-4">
                    <button
                      type="button"
                      onClick={() => setIsItemPickerOpen(true)}
                      className="inline-flex w-full items-center justify-center gap-2 border border-app-fg/15 py-2.5 text-xs font-semibold uppercase tracking-wide text-app-fg/85 transition hover:border-app-fg/45"
                    >
                      <Plus className="h-3.5 w-3.5" strokeWidth={1.5} />
                      Добавить вещь
                    </button>
                    {selectedItems.length > 0 ? (
                      <div className="grid grid-cols-3 gap-2 sm:grid-cols-4 lg:grid-cols-6">
                        {selectedItems.map((item) => {
                          return (
                            <article
                              key={`${item.productId}-${item.size}`}
                              className="overflow-hidden border border-app-fg/15 bg-app-bg"
                            >
                              <div className="aspect-square w-full bg-app-fg/5">
                                {item.imageUrl ? (
                                  <img
                                    src={item.imageUrl}
                                    alt={item.productName}
                                    className="h-full w-full object-cover"
                                    loading="lazy"
                                  />
                                ) : (
                                  <div className="flex h-full w-full items-center justify-center text-[9px] text-app-fg/40">
                                    НЕТ ФОТО
                                  </div>
                                )}
                              </div>
                              <div className="space-y-1 p-1.5">
                                <p className="line-clamp-2 text-[11px] font-medium text-app-fg">
                                  {item.productName}
                                </p>
                                <div className="flex items-center justify-between gap-2">
                                  <p className="text-[10px] uppercase text-app-fg/55">{item.size}</p>
                                  <button
                                    type="button"
                                    onClick={() => removeSelectedItem(item.productId, item.size)}
                                    className="text-[10px] uppercase text-app-fg/55 transition"
                                  >
                                    Удалить
                                  </button>
                                </div>
                              </div>
                            </article>
                          );
                        })}
                      </div>
                    ) : (
                      <p className="text-xs text-app-fg/55">Вещи пока не выбраны.</p>
                    )}
                  </div>
                )}
              </div>

              <button
                type="submit"
                className={`${primaryActionButtonClass} w-full`}
              >
                <Plus className="h-4 w-4" strokeWidth={1.5} />
                Добавить трек
              </button>
            </form>
          </div>
        </div>
      )}

      {isItemPickerOpen && isAddOpen && (
        <div className="fixed inset-0 z-[65] flex items-center justify-center bg-black/75 px-4">
          <div className="w-full max-w-4xl border border-app-fg/15 bg-app-bg p-5 shadow-accent-glow sm:p-6">
            <div className="mb-4 flex items-start justify-between gap-3">
              <h3 className="text-sm font-semibold uppercase tracking-[0.1em] text-app-fg">
                Выбор вещи
              </h3>
              <button
                type="button"
                onClick={() => setIsItemPickerOpen(false)}
                className="border border-app-fg/15 p-1.5 text-app-fg/70 transition hover:border-app-fg/40"
                aria-label="Закрыть"
              >
                <X className="h-4 w-4" strokeWidth={1.5} />
              </button>
            </div>

            <input
              value={itemSearch}
              onChange={(e) => setItemSearch(e.target.value)}
              placeholder="Поиск по названию или размеру..."
              className="mb-4 w-full border border-app-fg/15 bg-app-bg px-3 py-2.5 text-sm text-app-fg outline-none ring-app-accent/35 focus:ring-2"
            />

            {filteredProducts.length === 0 ? (
              <p className="border border-dashed border-app-fg/15 px-4 py-8 text-sm text-app-fg/55">
                Ничего не найдено.
              </p>
            ) : (
              <div className="space-y-3">
                <div className="grid max-h-[52vh] grid-cols-2 gap-2 overflow-y-auto sm:grid-cols-3 lg:grid-cols-4">
                  {filteredProducts.map((product) => {
                    const productId = String(product.id ?? "");
                    const active = productId === selectedProductId;
                    return (
                      <button
                        key={productId}
                        type="button"
                        onClick={() => {
                          setSelectedProductId(productId);
                          setSelectedSize("");
                        }}
                        className={
                          active
                            ? "overflow-hidden border-2 border-app-accent bg-app-bg text-left"
                            : "overflow-hidden border border-app-fg/15 bg-app-bg text-left transition hover:border-app-fg/40"
                        }
                      >
                        <div className="aspect-square w-full bg-app-fg/5">
                          {buildImageUrl(product.images?.[0]) ? (
                            <img
                              src={buildImageUrl(product.images?.[0])}
                              alt={product.name ?? productId}
                              className="h-full w-full object-cover"
                              loading="lazy"
                            />
                          ) : (
                            <div className="flex h-full w-full items-center justify-center text-xs text-app-fg/40">
                              Нет фото
                            </div>
                          )}
                        </div>
                        <div className="p-2">
                          <p className="line-clamp-2 text-xs font-medium text-app-fg">
                            {product.name ?? `Товар ${productId}`}
                          </p>
                        </div>
                      </button>
                    );
                  })}
                </div>

                <div className="grid grid-cols-1 gap-2 sm:grid-cols-[1fr_auto]">
                  <select
                    value={selectedSize}
                    onChange={(e) => setSelectedSize(e.target.value)}
                    className={`w-full border border-app-fg/15 bg-app-bg px-3 py-2.5 text-sm text-app-fg outline-none ring-app-accent/35 focus:ring-2 ${selectNativeChevronPad}`}
                    disabled={!selectedProduct || sizeOptions.length === 0}
                  >
                    <option value="">Выбрать размер</option>
                    {sizeOptions.map((size) => (
                      <option key={size} value={size}>
                        {size}
                      </option>
                    ))}
                  </select>
                  <button
                    type="button"
                    onClick={addSelectedItem}
                    disabled={!selectedProduct || !selectedSize}
                    className="inline-flex items-center justify-center border border-app-fg/15 px-4 py-2.5 text-xs font-semibold uppercase tracking-wide text-app-fg/85 transition hover:border-app-fg/45 disabled:opacity-50"
                  >
                    Добавить
                  </button>
                </div>
              </div>
            )}

            <button
              type="button"
              onClick={() => setIsItemPickerOpen(false)}
              className="mt-4 inline-flex w-full items-center justify-center border border-app-fg/15 py-2.5 text-xs font-semibold uppercase tracking-wide text-app-fg/80 transition hover:border-app-fg/45"
            >
              Готово
            </button>
          </div>
        </div>
      )}

      {isContractorPickerOpen && isAddOpen && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/75 px-4">
          <div className="w-full max-w-2xl border border-app-fg/15 bg-app-bg p-5 shadow-accent-glow sm:p-6">
            <div className="mb-4 flex items-start justify-between gap-3">
              <h3 className="text-sm font-semibold uppercase tracking-[0.1em] text-app-fg">
                Выбор контрагента
              </h3>
              <button
                type="button"
                onClick={() => setIsContractorPickerOpen(false)}
                className="border border-app-fg/15 p-1.5 text-app-fg/70 transition hover:border-app-fg/40"
                aria-label="Закрыть"
              >
                <X className="h-4 w-4" strokeWidth={1.5} />
              </button>
            </div>

            <input
              value={contractorSearch}
              onChange={(e) => setContractorSearch(e.target.value)}
              placeholder="Поиск по ФИО или нику..."
              className="mb-4 w-full border border-app-fg/15 bg-app-bg px-3 py-2.5 text-sm text-app-fg outline-none ring-app-accent/35 focus:ring-2"
            />

            <div className="max-h-[60vh] overflow-y-auto border border-app-fg/15">
              {filteredContractors.length === 0 ? (
                <p className="px-4 py-8 text-sm text-app-fg/55">Ничего не найдено.</p>
              ) : (
                filteredContractors.map((contractor) => (
                  <button
                    key={contractor.id}
                    type="button"
                    onClick={() => {
                      setContractorId(contractor.id);
                      setSelectedItems([]);
                      setIsContractorPickerOpen(false);
                    }}
                    className="block w-full px-4 py-3 text-left transition hover:bg-app-fg/[0.04]"
                  >
                    <p className="text-sm font-semibold uppercase tracking-wide text-app-fg">
                      {contractor.name}
                    </p>
                    <p className="mt-0.5 text-sm text-app-fg/65">
                      {contractor.contactPerson?.trim() || "Без ФИО"}
                    </p>
                  </button>
                ))
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
