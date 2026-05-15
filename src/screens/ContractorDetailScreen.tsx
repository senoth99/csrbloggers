"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useMemo, useState, type FormEvent } from "react";
import { ArrowLeft, ChevronLeft, ChevronRight, Pencil, Plus, Save, Search, Trash2, X } from "lucide-react";
import { usePanelData } from "@/context/PanelDataContext";
import { useUndo } from "@/context/UndoContext";
import { formatRuMoney } from "@/lib/format-ru";
import { nicheChoiceCaption } from "@/lib/niche-display";
import {
  integrationPublicLinkHref,
  normalizeIntegrationPublicLink,
} from "@/lib/integration-link";
import {
  computeContractorRating10,
  formatContractorRating10Display,
} from "@/lib/contractor-rating";
import {
  countBy,
  deliveriesCreatedInMonth,
  integrationsCreatedInMonth,
  ymdInYearMonth,
  monthOverMonthTrend,
  shiftYearMonth,
} from "@/lib/dashboard-metrics";
import { useDashboardMonth } from "@/hooks/useDashboardMonth";
import { ContractorRatingBadge } from "@/components/ContractorRatingBadge";
import { CrmPill } from "@/components/CrmPill";
import { usePromocodesCtx } from "@/context/PromocodesContext";
import {
  CHANNEL_BADGE_CLASS,
  CONTRACTOR_SIZE_CATEGORY_LABELS,
  CONTRACTOR_SIZE_CATEGORIES,
  DELIVERY_STATUS_LABELS,
  INTEGRATION_COOPERATION_LABELS,
  INTEGRATION_STATUS_LABELS,
  STATUS_BADGE_CLASS,
  type Contractor,
  type ContractorLink,
  type IntegrationStatus,
} from "@/types/panel-data";
import { ConfirmDeleteButton } from "@/components/ui";
import {
  DashboardChartSection,
  DistributionBars,
  StatCard,
  dashboardMonthInputClass,
  dashboardMonthNavButtonClass,
  dashboardMonthPickerRowClass,
  dashboardPageTitleClass,
  selectNativeChevronPad,
} from "@/screens/dashboard-shared";

const fieldClass =
  "w-full border border-app-fg/15 bg-app-bg px-3 py-2.5 text-sm text-app-fg outline-none ring-app-accent/35 focus:ring-2";

const selectClass =
  "w-full min-w-0 border border-app-fg/15 bg-app-bg px-3 py-2.5 text-sm text-app-fg outline-none ring-app-accent/35 focus:ring-2";

const overlayClass =
  "fixed inset-0 z-50 flex items-center justify-center bg-black/70 px-4 py-8 backdrop-blur-[2px]";

const modalShellClass =
  "flex max-h-[min(92vh,880px)] w-full max-w-lg flex-col border border-app-fg/20 bg-app-bg shadow-[0_0_40px_-12px_rgba(0,0,0,0.45)]";

const nfReach = new Intl.NumberFormat("ru-RU", {
  maximumFractionDigits: 0,
});

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
const PRODUCTS_API_URL = "/api/casher-products";
const REFRESH_EVERY_MS = 30 * 60 * 1000;
const API_ORIGIN = "https://api.cashercollection.com";
type ContractorTab = "availability" | "deliveries" | "integrations" | "links";

interface ApiProductSize {
  id?: number;
  size?: string;
  isVisible?: boolean;
}

interface ApiProduct {
  id?: string | number;
  name?: string;
  images?: string[];
  sizes?: ApiProductSize[];
  isDeleted?: boolean;
  popularityRank?: number;
}

function buildImageUrl(raw?: string): string {
  if (!raw) return "";
  if (raw.startsWith("http://") || raw.startsWith("https://")) return raw;
  return `${API_ORIGIN}${raw.startsWith("/") ? raw : `/${raw}`}`;
}

function isNotDeletedProduct(product: ApiProduct): boolean {
  return product.isDeleted !== true;
}

type DrawerTab = "profile" | "integrations" | "deliveries" | "items";

export function ContractorDetailScreen({
  contractorId,
  variant = "page",
  onClose,
}: {
  contractorId: string;
  variant?: "page" | "drawer";
  onClose?: () => void;
}) {
  const router = useRouter();
  const isDrawer = variant === "drawer";
  const {
    contractors,
    integrations,
    socialOptions,
    nicheOptions,
    isAdmin,
    canWriteCore,
    updateContractor,
    removeContractor,
    restoreContractorDeletion,
    contractorItems,
    deliveries,
    addContractorItem,
    removeContractorItem,
    contractorLinks,
    addContractorLink,
    updateContractorLink,
    removeContractorLink,
  } = usePanelData();
  const { showUndo } = useUndo();
  const { byCodeKey: promoByCodeKey, loading: promoLoading, error: promoError } =
    usePromocodesCtx();
  const [products, setProducts] = useState<ApiProduct[]>([]);
  const [isProductsLoading, setIsProductsLoading] = useState(false);
  const [productsError, setProductsError] = useState<string | null>(null);
  const [lastSyncAt, setLastSyncAt] = useState<number | null>(null);
  const [isAddItemOpen, setIsAddItemOpen] = useState(false);
  const [isProductPickerOpen, setIsProductPickerOpen] = useState(false);
  const [productSearch, setProductSearch] = useState("");
  const [selectedProductId, setSelectedProductId] = useState("");
  const [selectedSize, setSelectedSize] = useState("");
  const [isEditOpen, setIsEditOpen] = useState(false);
  const [draftName, setDraftName] = useState("");
  const [draftContactPerson, setDraftContactPerson] = useState("");
  const [draftCity, setDraftCity] = useState("");
  const [draftPromoCode, setDraftPromoCode] = useState("");
  const [draftVirality, setDraftVirality] = useState("");
  const [draftNicheId, setDraftNicheId] = useState("");
  const [draftSizeCategory, setDraftSizeCategory] = useState<string>("");
  const [activeTab, setActiveTab] = useState<ContractorTab>("availability");
  const [drawerTab, setDrawerTab] = useState<DrawerTab>("profile");
  const [availSearch, setAvailSearch] = useState("");
  const [delSearch, setDelSearch] = useState("");
  const [intSearch, setIntSearch] = useState("");
  const { ym: overviewYm, setMonth: setOverviewYm, monthInputValue: overviewMonthInput } =
    useDashboardMonth();
  const [linksSearch, setLinksSearch] = useState("");
  const [isLinkModalOpen, setIsLinkModalOpen] = useState(false);
  const [editingLinkId, setEditingLinkId] = useState<string | null>(null);
  const [draftLinkTitle, setDraftLinkTitle] = useState("");
  const [draftLinkUrl, setDraftLinkUrl] = useState("");
  const [linkModalError, setLinkModalError] = useState<string | null>(null);

  const contractor = contractors.find((c) => c.id === contractorId);
  const related = integrations.filter((i) => i.contractorId === contractorId);
  const ownedItems = contractorItems.filter((item) => item.contractorId === contractorId);
  const ownedLinks = useMemo(() => {
    return contractorLinks
      .filter((l) => l.contractorId === contractorId)
      .slice()
      .sort((a, b) => (b.createdAt ?? "").localeCompare(a.createdAt ?? ""));
  }, [contractorLinks, contractorId]);
  const contractorDeliveries = deliveries.filter((d) => d.contractorId === contractorId);

  const filteredOwnedItems = useMemo(() => {
    const q = availSearch.trim().toLowerCase();
    if (!q) return ownedItems;
    return ownedItems.filter(
      (item) =>
        (item.productName ?? "").toLowerCase().includes(q) ||
        (item.size ?? "").toLowerCase().includes(q),
    );
  }, [ownedItems, availSearch]);

  const filteredContractorDeliveries = useMemo(() => {
    const q = delSearch.trim().toLowerCase();
    if (!q) return contractorDeliveries;
    return contractorDeliveries.filter(
      (d) =>
        d.trackNumber.toLowerCase().includes(q) ||
        (d.orderNumber ?? "").toLowerCase().includes(q) ||
        DELIVERY_STATUS_LABELS[d.status].toLowerCase().includes(q),
    );
  }, [contractorDeliveries, delSearch]);

  const nicheLabel = useMemo(() => {
    if (!contractor?.nicheId) return "";
    const raw = nicheOptions.find((o) => o.id === contractor.nicheId)?.label ?? "";
    return raw ? nicheChoiceCaption(raw) : "";
  }, [contractor?.nicheId, nicheOptions]);

  const nicheSearchBlob = useMemo(() => {
    if (!contractor?.nicheId) return "";
    const raw = nicheOptions.find((o) => o.id === contractor.nicheId)?.label ?? "";
    if (!raw.trim()) return "";
    return `${raw} ${nicheChoiceCaption(raw)}`;
  }, [contractor?.nicheId, nicheOptions]);

  const filteredRelatedIntegrations = useMemo(() => {
    const q = intSearch.trim().toLowerCase();
    if (!q) return related;
    return related.filter((i) => {
      const social = socialOptions.find((o) => o.id === i.socialNetworkId);
      const coop = i.cooperationType
        ? INTEGRATION_COOPERATION_LABELS[i.cooperationType]
        : "";
      const blob = [
        i.title ?? "",
        social?.label ?? "",
        INTEGRATION_STATUS_LABELS[i.status],
        coop,
        nicheSearchBlob,
        contractor?.sizeCategory
          ? CONTRACTOR_SIZE_CATEGORY_LABELS[contractor.sizeCategory]
          : "",
      ]
        .join(" ")
        .toLowerCase();
      return blob.includes(q);
    });
  }, [related, intSearch, socialOptions, contractor, nicheSearchBlob]);

  const filteredOwnedLinks = useMemo(() => {
    const q = linksSearch.trim().toLowerCase();
    if (!q) return ownedLinks;
    return ownedLinks.filter(
      (l) =>
        l.title.toLowerCase().includes(q) ||
        l.url.toLowerCase().includes(q),
    );
  }, [ownedLinks, linksSearch]);

  const rating10 = useMemo(
    () => computeContractorRating10(related, ownedItems.length),
    [related, ownedItems.length],
  );

  const aggBudget = useMemo(() => {
    let sum = 0;
    let n = 0;
    for (const i of related) {
      const b = i.budget ?? i.amount;
      if (b != null && Number.isFinite(b)) {
        sum += b;
        n += 1;
      }
    }
    return n > 0 ? sum : undefined;
  }, [related]);

  const aggReach = useMemo(() => {
    let sum = 0;
    let n = 0;
    for (const i of related) {
      if (i.reach != null && Number.isFinite(i.reach)) {
        sum += i.reach;
        n += 1;
      }
    }
    return n > 0 ? sum : undefined;
  }, [related]);

  const aggPromo = useMemo(() => {
    let sum = 0;
    let n = 0;
    for (const i of related) {
      if (i.promoActivations != null && Number.isFinite(i.promoActivations)) {
        sum += i.promoActivations;
        n += 1;
      }
    }
    return n > 0 ? sum : undefined;
  }, [related]);

  const promoCodeKey = (contractor?.promoCode ?? "").trim().toLowerCase();
  const promoActivationsFromApi =
    promoCodeKey && promoByCodeKey.has(promoCodeKey)
      ? promoByCodeKey.get(promoCodeKey)
      : undefined;
  const promoActivationsDisplay =
    promoCodeKey && promoActivationsFromApi !== undefined ? promoActivationsFromApi : aggPromo;

  const promoSubLabel =
    contractor?.promoCode?.trim()
      ? promoError
        ? `${contractor.promoCode.trim()} · ошибка: ${promoError}`
        : promoLoading && promoActivationsFromApi === undefined
          ? `${contractor.promoCode.trim()} · загружаю…`
          : contractor.promoCode.trim()
      : undefined;

  const overviewYmPrev = useMemo(() => shiftYearMonth(overviewYm, -1), [overviewYm]);

  const contractorIntegrationsCreatedInMonth = useMemo(
    () => integrationsCreatedInMonth(related, overviewYm),
    [related, overviewYm],
  );
  const contractorIntegrationsCreatedInMonthPrev = useMemo(
    () => integrationsCreatedInMonth(related, overviewYmPrev),
    [related, overviewYmPrev],
  );

  const contractorReleasePipelineInMonth = useMemo(
    () => related.filter((i) => ymdInYearMonth(i.releaseDate, overviewYm)),
    [related, overviewYm],
  );

  const contractorReleasePipelineInMonthPrev = useMemo(
    () => related.filter((i) => ymdInYearMonth(i.releaseDate, overviewYmPrev)),
    [related, overviewYmPrev],
  );

  const overviewStatusBars = useMemo(() => {
    const raw = countBy(contractorIntegrationsCreatedInMonth.map((i) => i.status));
    return (Object.keys(INTEGRATION_STATUS_LABELS) as IntegrationStatus[]).map((k) => ({
      key: k,
      label: INTEGRATION_STATUS_LABELS[k],
      value: raw[k] ?? 0,
    }));
  }, [contractorIntegrationsCreatedInMonth]);

  const overviewPlatformBars = useMemo(() => {
    const raw = countBy(contractorIntegrationsCreatedInMonth.map((i) => i.socialNetworkId));
    return Object.entries(raw)
      .map(([id, value]) => ({
        key: id,
        label: socialOptions.find((o) => o.id === id)?.label ?? id,
        value,
      }))
      .sort((a, b) => b.value - a.value);
  }, [contractorIntegrationsCreatedInMonth, socialOptions]);

  const deliveriesCreatedThisMonth = useMemo(
    () => deliveriesCreatedInMonth(contractorDeliveries, overviewYm),
    [contractorDeliveries, overviewYm],
  );
  const deliveriesCreatedThisMonthPrev = useMemo(
    () => deliveriesCreatedInMonth(contractorDeliveries, overviewYmPrev),
    [contractorDeliveries, overviewYmPrev],
  );

  const selectedProduct = useMemo(
    () => products.find((p) => String(p.id ?? "") === selectedProductId),
    [products, selectedProductId],
  );

  const sizeOptions = useMemo(() => {
    if (!selectedProduct) return [];
    return (selectedProduct.sizes ?? [])
      .filter((x) => x.isVisible === true)
      .map((x) => (x.size ?? "").trim().toUpperCase())
      .filter((x) => x.length > 0);
  }, [selectedProduct]);

  const filteredProducts = useMemo(() => {
    const q = productSearch.trim().toLowerCase();
    const base = q
      ? products.filter((p) => (p.name ?? "").toLowerCase().includes(q))
      : products.filter(isNotDeletedProduct);
    return [...base].sort(
      (a, b) => (a.popularityRank ?? Number.POSITIVE_INFINITY) - (b.popularityRank ?? Number.POSITIVE_INFINITY),
    );
  }, [products, productSearch]);

  useEffect(() => {
    let active = true;

    async function loadProducts() {
      setIsProductsLoading(true);
      setProductsError(null);
      try {
        const response = await fetch(PRODUCTS_API_URL, { cache: "no-store" });
        if (!response.ok) {
          throw new Error(`HTTP ${response.status}`);
        }
        const payload = (await response.json()) as unknown;
        if (!Array.isArray(payload)) {
          throw new Error("Unexpected payload");
        }
        if (!active) return;
        setProducts(payload as ApiProduct[]);
        setLastSyncAt(Date.now());
      } catch {
        if (!active) return;
        setProductsError("Не удалось загрузить вещи с API.");
      } finally {
        if (active) setIsProductsLoading(false);
      }
    }

    void loadProducts();
    const timer = window.setInterval(() => {
      void loadProducts();
    }, REFRESH_EVERY_MS);

    return () => {
      active = false;
      window.clearInterval(timer);
    };
  }, []);

  const applyContractorToDrafts = useCallback((source: Contractor) => {
    setDraftName(source.name ?? "");
    setDraftContactPerson(source.contactPerson ?? "");
    setDraftCity(source.city ?? "");
    setDraftPromoCode(source.promoCode ?? "");
    setDraftVirality(source.virality ?? "");
    setDraftNicheId(source.nicheId ?? "");
    setDraftSizeCategory(
      source.sizeCategory === "micro" ||
        source.sizeCategory === "middle" ||
        source.sizeCategory === "large"
        ? source.sizeCategory
        : "",
    );
  }, []);

  const closeEdit = useCallback(() => {
    if (contractor) applyContractorToDrafts(contractor);
    setIsEditOpen(false);
  }, [contractor, applyContractorToDrafts]);

  useEffect(() => {
    if (!contractor || isEditOpen) return;
    applyContractorToDrafts(contractor);
  }, [contractor, isEditOpen, applyContractorToDrafts]);

  useEffect(() => {
    if (!isEditOpen) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") closeEdit();
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [isEditOpen, closeEdit]);

  useEffect(() => {
    if (!isLinkModalOpen) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        setIsLinkModalOpen(false);
        setEditingLinkId(null);
        setLinkModalError(null);
        setDraftLinkTitle("");
        setDraftLinkUrl("");
      }
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [isLinkModalOpen]);

  if (!contractor) {
    return (
      <div className={`space-y-4 ${isDrawer ? "px-4 py-4 sm:px-5" : ""}`}>
        {!isDrawer ? <BackLink href="/contractors" /> : null}
        {isDrawer && onClose ? (
          <button
            type="button"
            onClick={onClose}
            className="ml-auto flex border border-app-fg/15 p-1.5 text-app-fg/70"
            aria-label="Закрыть"
          >
            <X className="h-4 w-4" strokeWidth={1.5} />
          </button>
        ) : null}
        <p className="text-sm text-app-fg/55">Контрагент не найден.</p>
      </div>
    );
  }

  function saveProfileBlur(updates: Partial<Contractor>) {
    if (!isAdmin || !contractor) return;
    updateContractor(contractor.id, updates);
  }

  function handleDelete() {
    if (!isAdmin || !contractor) return;
    const contractorId = contractor.id;
    const snapshot = {
      contractor: { ...contractor },
      integrations: integrations.filter((i) => i.contractorId === contractorId),
      contractorItems: contractorItems.filter((i) => i.contractorId === contractorId),
      contractorLinks: contractorLinks.filter((i) => i.contractorId === contractorId),
      deliveries: deliveries.filter((d) => d.contractorId === contractorId),
    };
    removeContractor(contractorId);
    showUndo("Контрагент удалён.", () => {
      restoreContractorDeletion(snapshot);
    });
    if (onClose) onClose();
    else router.replace("/contractors");
  }

  function openEdit() {
    if (!contractor) return;
    applyContractorToDrafts(contractor);
    setIsEditOpen(true);
  }

  function handleSaveContractor() {
    if (!contractor) return;
    const nextName = draftName.trim();
    if (!nextName) return;
    const hasSize =
      draftSizeCategory === "micro" ||
      draftSizeCategory === "middle" ||
      draftSizeCategory === "large";
    updateContractor(contractor.id, {
      name: nextName,
      contactPerson: draftContactPerson.trim(),
      city: draftCity.trim(),
      promoCode: draftPromoCode.trim(),
      virality: draftVirality.trim(),
      nicheId: draftNicheId.trim(),
      sizeCategory: hasSize ? draftSizeCategory : undefined,
    });
    setIsEditOpen(false);
  }

  function handleAddItem(e: FormEvent) {
    e.preventDefault();
    if (!contractor || !selectedProduct || !selectedSize) return;
    const productId = String(selectedProduct.id ?? "").trim();
    const productName = (selectedProduct.name ?? "").trim();
    if (!productId || !productName) return;
    addContractorItem({
      contractorId: contractor.id,
      productId,
      productName,
      size: selectedSize,
      imageUrl: buildImageUrl(selectedProduct.images?.[0]),
    });
    setSelectedProductId("");
    setSelectedSize("");
    setProductSearch("");
    setIsAddItemOpen(false);
  }

  function closeLinkModal() {
    setIsLinkModalOpen(false);
    setEditingLinkId(null);
    setLinkModalError(null);
    setDraftLinkTitle("");
    setDraftLinkUrl("");
  }

  function openAddLink() {
    setEditingLinkId(null);
    setDraftLinkTitle("");
    setDraftLinkUrl("");
    setLinkModalError(null);
    setIsLinkModalOpen(true);
  }

  function openEditLink(row: ContractorLink) {
    setEditingLinkId(row.id);
    setDraftLinkTitle(row.title);
    setDraftLinkUrl(row.url);
    setLinkModalError(null);
    setIsLinkModalOpen(true);
  }

  function handleSaveLink() {
    if (!contractor) return;
    const t = draftLinkTitle.trim();
    const u = draftLinkUrl.trim();
    if (!t) {
      setLinkModalError("Укажите название.");
      return;
    }
    if (!u) {
      setLinkModalError("Укажите ссылку.");
      return;
    }
    const stored = normalizeIntegrationPublicLink(u);
    if (!stored) {
      setLinkModalError("Укажите ссылку.");
      return;
    }
    if (!integrationPublicLinkHref(stored)) {
      setLinkModalError("Некорректная ссылка. Используйте http(s) или адрес сайта.");
      return;
    }
    if (editingLinkId) {
      updateContractorLink(editingLinkId, { title: t, url: stored });
    } else {
      addContractorLink({ contractorId: contractor.id, title: t, url: stored });
    }
    closeLinkModal();
  }

  const nicknameDisplay = isEditOpen ? draftName : (contractor.name ?? "");
  const fioDisplay = isEditOpen ? draftContactPerson : (contractor.contactPerson ?? "");

  return (
    <div
      className={
        isDrawer
          ? "w-full space-y-6 pb-6"
          : "mx-auto w-full max-w-5xl space-y-10 pb-10"
      }
    >
      {isDrawer ? (
        <div className="flex items-start justify-between gap-3 border-b border-app-fg/10 px-4 py-3 sm:px-5">
          <div className="min-w-0 flex-1">
            <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-app-fg/50">
              Контрагент
            </p>
            <div className="mt-1 flex flex-wrap items-center gap-2">
              <h1 className="truncate text-lg font-semibold text-app-fg">
                {contractor.contactPerson?.trim() || contractor.name}
              </h1>
              <ContractorRatingBadge value={rating10} />
            </div>
          </div>
          {onClose ? (
            <button
              type="button"
              onClick={onClose}
              className="shrink-0 border border-app-fg/15 p-1.5 text-app-fg/70 transition hover:border-app-fg/40"
              aria-label="Закрыть"
            >
              <X className="h-4 w-4" strokeWidth={1.5} />
            </button>
          ) : null}
        </div>
      ) : (
        <BackLink href="/contractors" />
      )}

      {!isDrawer ? (
      <header className="flex flex-col gap-4 border-b border-app-fg/10 pb-6 sm:flex-row sm:items-end sm:justify-between">
        <div className="min-w-0 space-y-2">
          <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-app-fg/50">
            Контрагент
          </p>
          <div className="flex min-w-0 flex-wrap items-center gap-2.5">
            <h1 className="min-w-0 text-balance text-xl font-semibold tracking-tight text-app-fg sm:text-2xl">
              {contractor.name}
            </h1>
            <ContractorRatingBadge value={rating10} />
          </div>
        </div>
        {canWriteCore ? (
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
      ) : null}

      {!isDrawer ? (
      <section className="space-y-10">
        <div className="flex flex-col gap-5 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <p className="text-[10px] font-semibold uppercase tracking-[0.22em] text-app-fg/40">
              Обзор
            </p>
            <h2 className={dashboardPageTitleClass}>Интеграции и активность</h2>
          </div>
          <div className="flex min-w-0 flex-col gap-1">
            <label
              htmlFor="contractor-overview-month"
              className="text-[10px] font-semibold uppercase tracking-wider text-app-fg/45"
            >
              Месяц
            </label>
            <div className={dashboardMonthPickerRowClass}>
              <button
                type="button"
                aria-label="Предыдущий месяц"
                onClick={() => setOverviewYm(shiftYearMonth(overviewYm, -1))}
                className={dashboardMonthNavButtonClass}
              >
                <ChevronLeft className="h-4 w-4" strokeWidth={1.75} />
              </button>
              <input
                id="contractor-overview-month"
                type="month"
                value={overviewMonthInput}
                onChange={(e) => {
                  const v = e.target.value;
                  const parts = v.split("-").map(Number);
                  if (parts.length === 2 && parts[0] && parts[1]) {
                    setOverviewYm({ year: parts[0], month: parts[1] });
                  }
                }}
                className={dashboardMonthInputClass}
              />
              <button
                type="button"
                aria-label="Следующий месяц"
                onClick={() => setOverviewYm(shiftYearMonth(overviewYm, 1))}
                className={dashboardMonthNavButtonClass}
              >
                <ChevronRight className="h-4 w-4" strokeWidth={1.75} />
              </button>
            </div>
          </div>
        </div>

        <DashboardChartSection title="Сводка">
          <p className="mb-4 text-xs text-app-fg/50">
            «Создано в месяце» и диаграммы статусов/площадок — по дате создания записи.
            «План выхода в месяце» — по releaseDate.
          </p>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
            <StatCard
              label="Создано в месяце"
              value={contractorIntegrationsCreatedInMonth.length}
              accent="accent"
              trend={monthOverMonthTrend(
                contractorIntegrationsCreatedInMonth.length,
                contractorIntegrationsCreatedInMonthPrev.length,
              )}
            />
            <StatCard
              label="План выхода в месяце"
              value={contractorReleasePipelineInMonth.length}
              trend={monthOverMonthTrend(
                contractorReleasePipelineInMonth.length,
                contractorReleasePipelineInMonthPrev.length,
              )}
            />
            <StatCard label="Всего интеграций" value={related.length} />
          </div>
        </DashboardChartSection>

        <div className="grid grid-cols-1 gap-8 lg:grid-cols-2">
          <DashboardChartSection title="Создано в месяце · статусы">
            <DistributionBars entries={overviewStatusBars} />
          </DashboardChartSection>
          <DashboardChartSection title="Создано в месяце · площадки">
            <DistributionBars entries={overviewPlatformBars} />
          </DashboardChartSection>
        </div>

        <DashboardChartSection title="Ключевые показатели">
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
            <StatCard
              label="Рейтинг"
              value={formatContractorRating10Display(rating10)}
              accent="accent"
            />
            <StatCard label="Вещей в наличии" value={ownedItems.length} />
            <StatCard label="Сохранённых ссылок" value={ownedLinks.length} />
            <StatCard label="Доставок всего" value={contractorDeliveries.length} />
            <StatCard
              label="Доставок создано в месяце"
              value={deliveriesCreatedThisMonth.length}
              trend={monthOverMonthTrend(
                deliveriesCreatedThisMonth.length,
                deliveriesCreatedThisMonthPrev.length,
              )}
            />
            <StatCard
              label="Активации промокодов"
              subLabel={promoSubLabel}
              value={
                promoActivationsDisplay != null
                  ? nfReach.format(promoActivationsDisplay)
                  : "—"
              }
            />
          </div>
        </DashboardChartSection>

        <DashboardChartSection title="Финансы по интеграциям">
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
            <StatCard
              label="Бюджет всего"
              value={aggBudget != null ? `${formatRuMoney(aggBudget)} ₽` : "—"}
            />
            <StatCard
              label="Охваты всего"
              value={aggReach != null ? nfReach.format(aggReach) : "—"}
            />
            <StatCard
              label="Вирусность"
              value={contractor.virality?.trim() || "—"}
            />
          </div>
        </DashboardChartSection>
      </section>
      ) : null}

      {!isDrawer ? (
      <section className="space-y-4">
        <h2 className="text-[11px] font-semibold uppercase tracking-[0.18em] text-app-fg/45">
          Данные контрагента
        </h2>
        <div className="grid gap-3 sm:grid-cols-2">
          <InfoBlock label="Никнейм">{nicknameDisplay.trim() || "—"}</InfoBlock>
          <InfoBlock label="Контактное лицо">{fioDisplay.trim() || "—"}</InfoBlock>
          <InfoBlock label="Город">
            {contractor.city?.trim() ? (
              <span className="text-app-fg">{contractor.city.trim()}</span>
            ) : (
              <span className="text-app-fg/50">Не указан</span>
            )}
          </InfoBlock>
          <InfoBlock label="Промокод">
            {contractor.promoCode?.trim() ? (
              <span className="text-app-fg">{contractor.promoCode.trim()}</span>
            ) : (
              <span className="text-app-fg/50">Не указан</span>
            )}
          </InfoBlock>
          <InfoBlock label="Ниша">
            {nicheLabel ? (
              <span className="text-app-fg">{nicheLabel}</span>
            ) : (
              <span className="text-app-fg/50">Не указана</span>
            )}
          </InfoBlock>
          <InfoBlock label="Категория">
            {contractor.sizeCategory ? (
              <span className="text-app-fg">
                {CONTRACTOR_SIZE_CATEGORY_LABELS[contractor.sizeCategory]}
              </span>
            ) : (
              <span className="text-app-fg/50">Не указана</span>
            )}
          </InfoBlock>
          <InfoBlock label="Бюджет">
            <span className="tabular-nums">
              {aggBudget != null ? `${formatRuMoney(aggBudget)} ₽` : "—"}
            </span>
          </InfoBlock>
          <InfoBlock label="Охваты">
            <span className="tabular-nums">
              {aggReach != null ? nfReach.format(aggReach) : "—"}
            </span>
          </InfoBlock>
          <InfoBlock label="Вирусность">
            {contractor.virality?.trim() ? (
              <span className="text-app-fg">{contractor.virality.trim()}</span>
            ) : (
              <span className="text-app-fg/50">Не указана</span>
            )}
          </InfoBlock>
          <InfoBlock label="Активации промокодов">
            <span className="tabular-nums">
              {promoActivationsDisplay != null ? nfReach.format(promoActivationsDisplay) : "—"}
            </span>
          </InfoBlock>
          {contractor.note?.trim() ? (
            <InfoBlock label="Заметка" className="sm:col-span-2">
              {contractor.note.trim()}
            </InfoBlock>
          ) : null}
        </div>
      </section>
      ) : null}

      {canWriteCore && !isDrawer && isEditOpen ? (
        <div className={overlayClass} role="presentation" onClick={closeEdit}>
          <div
            role="dialog"
            aria-modal="true"
            aria-labelledby="contractor-edit-title"
            className={modalShellClass}
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex shrink-0 items-start justify-between gap-3 border-b border-app-fg/15 px-5 py-4 sm:px-6">
              <div>
                <p
                  id="contractor-edit-title"
                  className="text-sm font-semibold uppercase tracking-[0.12em] text-app-fg"
                >
                  Редактирование
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
                <label className="block text-xs uppercase tracking-wider text-app-fg/55">
                  Никнейм
                  <input
                    value={draftName}
                    onChange={(e) => setDraftName(e.target.value)}
                    className={`${selectClass} mt-1`}
                    required
                    autoComplete="off"
                  />
                </label>
                <label className="block text-xs uppercase tracking-wider text-app-fg/55">
                  Контактное лицо
                  <input
                    value={draftContactPerson}
                    onChange={(e) => setDraftContactPerson(e.target.value)}
                    className={`${selectClass} mt-1`}
                    placeholder="Имя и фамилия"
                    autoComplete="name"
                  />
                </label>
                <label className="block text-xs uppercase tracking-wider text-app-fg/55">
                  Город
                  <input
                    value={draftCity}
                    onChange={(e) => setDraftCity(e.target.value)}
                    className={`${selectClass} mt-1`}
                    placeholder="Например, Москва"
                    autoComplete="address-level2"
                  />
                </label>
                <label className="block text-xs uppercase tracking-wider text-app-fg/55">
                  Промокод
                  <input
                    value={draftPromoCode}
                    onChange={(e) => setDraftPromoCode(e.target.value)}
                    className={`${selectClass} mt-1`}
                    placeholder="Например, BLOG10"
                    autoComplete="off"
                    spellCheck={false}
                  />
                </label>
                <label className="block text-xs uppercase tracking-wider text-app-fg/55">
                  Вирусность
                  <input
                    value={draftVirality}
                    onChange={(e) => setDraftVirality(e.target.value)}
                    className={`${selectClass} mt-1`}
                    placeholder="Произвольно: число, процент, комментарий…"
                    autoComplete="off"
                  />
                </label>
                <label className="block text-xs uppercase tracking-wider text-app-fg/55">
                  Ниша
                  <select
                    value={draftNicheId}
                    onChange={(e) => setDraftNicheId(e.target.value)}
                    className={`${selectClass} mt-1 ${selectNativeChevronPad}`}
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
                  Категория (микро / миддл / крупный)
                  <select
                    value={draftSizeCategory}
                    onChange={(e) => setDraftSizeCategory(e.target.value)}
                    className={`${selectClass} mt-1 ${selectNativeChevronPad}`}
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
            </div>

            <div className="flex shrink-0 flex-col gap-2 border-t border-app-fg/15 bg-app-fg/[0.02] px-5 py-4 sm:flex-row sm:items-center sm:justify-between sm:px-6">
              <ConfirmDeleteButton
                onConfirm={handleDelete}
                confirmLabel="Подтвердить удаление"
                className="inline-flex items-center justify-center gap-2 border border-app-fg/15 px-4 py-2.5 text-xs font-medium text-app-fg/75 transition hover:border-red-500/40 hover:bg-red-500/5 sm:order-2"
                confirmClassName="inline-flex items-center justify-center gap-2 border border-red-500/50 bg-red-500/10 px-4 py-2.5 text-xs font-medium text-red-300 sm:order-2"
              >
                <span className="inline-flex items-center gap-2">
                  <Trash2 className="h-3.5 w-3.5" strokeWidth={1.5} />
                  Удалить
                </span>
              </ConfirmDeleteButton>
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
                  onClick={handleSaveContractor}
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

      <section
        className={`space-y-3 border-t border-app-fg/10 pt-4 ${isDrawer ? "px-0" : ""}`}
      >
        <div
          className={`flex flex-wrap gap-2 border border-app-fg/15 bg-app-bg p-1 ${isDrawer ? "mx-4 sm:mx-5" : ""}`}
        >
          {isDrawer ? (
            <>
              <TabButton
                active={drawerTab === "profile"}
                label="ПРОФИЛЬ"
                onClick={() => setDrawerTab("profile")}
              />
              <TabButton
                active={drawerTab === "integrations"}
                label="ИНТЕГРАЦИИ"
                count={related.length}
                onClick={() => setDrawerTab("integrations")}
              />
              <TabButton
                active={drawerTab === "deliveries"}
                label="ДОСТАВКИ"
                count={contractorDeliveries.length}
                onClick={() => setDrawerTab("deliveries")}
              />
              <TabButton
                active={drawerTab === "items"}
                label="ТОВАРЫ"
                count={ownedItems.length}
                onClick={() => setDrawerTab("items")}
              />
            </>
          ) : (
            <>
              <TabButton
                active={activeTab === "availability"}
                label="НАЛИЧИЕ"
                count={ownedItems.length}
                onClick={() => setActiveTab("availability")}
              />
              <TabButton
                active={activeTab === "deliveries"}
                label="ДОСТАВКИ"
                count={contractorDeliveries.length}
                onClick={() => setActiveTab("deliveries")}
              />
              <TabButton
                active={activeTab === "integrations"}
                label="ИНТЕГРАЦИИ"
                count={related.length}
                onClick={() => setActiveTab("integrations")}
              />
              <TabButton
                active={activeTab === "links"}
                label="ССЫЛКИ"
                count={ownedLinks.length}
                onClick={() => setActiveTab("links")}
              />
            </>
          )}
        </div>

        {isDrawer && drawerTab === "profile" ? (
          <div className="space-y-3 px-4 sm:px-5">
            <h2 className="text-xs font-semibold uppercase tracking-wider text-app-fg/55">
              Профиль
            </h2>
            <div className="grid gap-3 sm:grid-cols-2">
              <label className="block text-xs uppercase tracking-wider text-app-fg/55">
                Никнейм
                <input
                  key={`name-${contractor.id}-${contractor.name}`}
                  defaultValue={contractor.name ?? ""}
                  disabled={!canWriteCore}
                  onBlur={(e) => {
                    const v = e.target.value.trim();
                    if (v && v !== contractor.name) saveProfileBlur({ name: v });
                  }}
                  className={`${fieldClass} mt-1`}
                />
              </label>
              <label className="block text-xs uppercase tracking-wider text-app-fg/55">
                Контактное лицо
                <input
                  key={`cp-${contractor.id}-${contractor.contactPerson}`}
                  defaultValue={contractor.contactPerson ?? ""}
                  disabled={!canWriteCore}
                  onBlur={(e) => {
                    const v = e.target.value.trim();
                    if (v !== (contractor.contactPerson ?? ""))
                      saveProfileBlur({ contactPerson: v });
                  }}
                  className={`${fieldClass} mt-1`}
                />
              </label>
              <label className="block text-xs uppercase tracking-wider text-app-fg/55">
                Город
                <input
                  key={`city-${contractor.id}-${contractor.city}`}
                  defaultValue={contractor.city ?? ""}
                  disabled={!canWriteCore}
                  onBlur={(e) => {
                    const v = e.target.value.trim();
                    if (v !== (contractor.city ?? "")) saveProfileBlur({ city: v });
                  }}
                  className={`${fieldClass} mt-1`}
                />
              </label>
              <label className="block text-xs uppercase tracking-wider text-app-fg/55">
                Промокод
                <input
                  key={`promo-${contractor.id}-${contractor.promoCode}`}
                  defaultValue={contractor.promoCode ?? ""}
                  disabled={!canWriteCore}
                  onBlur={(e) => {
                    const v = e.target.value.trim();
                    if (v !== (contractor.promoCode ?? "")) saveProfileBlur({ promoCode: v });
                  }}
                  className={`${fieldClass} mt-1`}
                />
              </label>
              <label className="block text-xs uppercase tracking-wider text-app-fg/55 sm:col-span-2">
                Вирусность
                <input
                  key={`vir-${contractor.id}-${contractor.virality}`}
                  defaultValue={contractor.virality ?? ""}
                  disabled={!canWriteCore}
                  onBlur={(e) => {
                    const v = e.target.value.trim();
                    if (v !== (contractor.virality ?? "")) saveProfileBlur({ virality: v });
                  }}
                  className={`${fieldClass} mt-1`}
                />
              </label>
              <label className="block text-xs uppercase tracking-wider text-app-fg/55">
                Ниша
                <select
                  key={`niche-${contractor.id}-${contractor.nicheId}`}
                  defaultValue={contractor.nicheId ?? ""}
                  disabled={!canWriteCore}
                  onChange={(e) => saveProfileBlur({ nicheId: e.target.value.trim() })}
                  className={`${selectClass} mt-1 ${selectNativeChevronPad}`}
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
                  key={`size-${contractor.id}-${contractor.sizeCategory}`}
                  defaultValue={contractor.sizeCategory ?? ""}
                  disabled={!canWriteCore}
                  onChange={(e) => {
                    const v = e.target.value;
                    const hasSize =
                      v === "micro" || v === "middle" || v === "large";
                    saveProfileBlur({
                      sizeCategory: hasSize ? v : undefined,
                    });
                  }}
                  className={`${selectClass} mt-1 ${selectNativeChevronPad}`}
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
          </div>
        ) : null}

        {(isDrawer ? drawerTab === "items" : activeTab === "availability") && (
          <>
            <div className="flex items-center justify-between gap-3">
              <h2 className="text-xs font-semibold uppercase tracking-wider text-app-fg/55">
                Наличие
              </h2>
              {canWriteCore && (
                <button
                  type="button"
                  onClick={() => setIsAddItemOpen(true)}
                  className="inline-flex items-center gap-2 bg-app-accent px-3 py-2 text-[11px] font-semibold uppercase tracking-wide text-app-fg transition hover:brightness-125"
                >
                  <Plus className="h-3.5 w-3.5" strokeWidth={1.5} />
                  Добавить вещь
                </button>
              )}
            </div>

            {productsError ? (
              <div className="text-xs text-red-300">{productsError}</div>
            ) : null}

            {ownedItems.length === 0 ? (
              <p className="border border-dashed border-app-fg/15 px-4 py-6 text-sm text-app-fg/55">
                У этого контрагента пока нет добавленных вещей.
              </p>
            ) : (
              <>
                <label className="relative mb-3 block">
                  <Search
                    className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-app-fg/35"
                    aria-hidden
                  />
                  <input
                    type="search"
                    value={availSearch}
                    onChange={(e) => setAvailSearch(e.target.value)}
                    placeholder="Фильтр по названию вещи или размеру…"
                    className="w-full border border-app-fg/15 bg-app-bg py-2.5 pl-9 pr-3 text-sm text-app-fg outline-none ring-app-accent/35 focus:ring-2"
                  />
                </label>
                {filteredOwnedItems.length === 0 ? (
                  <p className="border border-dashed border-app-fg/15 px-4 py-6 text-sm text-app-fg/55">
                    Нет вещей по текущему фильтру.
                  </p>
                ) : (
              <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-4">
                {filteredOwnedItems.map((item) => (
                  <article
                    key={item.id}
                    className="group overflow-hidden border border-app-fg/15 bg-app-bg"
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
                        <div className="flex h-full w-full items-center justify-center text-xs text-app-fg/40">
                          Нет фото
                        </div>
                      )}
                    </div>
                    <div className="space-y-1 p-2">
                      <p className="truncate text-xs font-medium text-app-fg">{item.productName}</p>
                      <p className="text-xs uppercase tracking-wide text-app-fg/55">
                        Размер: {item.size}
                      </p>
                      {isAdmin && (
                        <ConfirmDeleteButton
                          onConfirm={() => removeContractorItem(item.id)}
                          confirmLabel="Подтвердить?"
                          className="pt-1 text-[11px] text-app-fg/55 transition hover:text-red-400"
                        />
                      )}
                    </div>
                  </article>
                ))}
              </div>
                )}
              </>
            )}
          </>
        )}

        {(isDrawer ? drawerTab === "deliveries" : activeTab === "deliveries") && (
          <>
            {contractorDeliveries.length === 0 ? (
              <div className="border border-dashed border-app-fg/15 px-4 py-6 text-sm text-app-fg/55">
                Доставок пока нет.
              </div>
            ) : (
              <>
                <label className="relative mb-3 block">
                  <Search
                    className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-app-fg/35"
                    aria-hidden
                  />
                  <input
                    type="search"
                    value={delSearch}
                    onChange={(e) => setDelSearch(e.target.value)}
                    placeholder="Фильтр по треку, заказу, статусу…"
                    className="w-full border border-app-fg/15 bg-app-bg py-2.5 pl-9 pr-3 text-sm text-app-fg outline-none ring-app-accent/35 focus:ring-2"
                  />
                </label>
                {filteredContractorDeliveries.length === 0 ? (
                  <div className="border border-dashed border-app-fg/15 px-4 py-6 text-sm text-app-fg/55">
                    Нет доставок по текущему фильтру.
                  </div>
                ) : (
              <ul className="bg-app-bg">
                {filteredContractorDeliveries.map((delivery) => (
                  <li key={delivery.id}>
                    <Link
                      href={`/deliveries/${delivery.id}`}
                      className="flex items-center justify-between gap-3 px-3 py-3 transition hover:bg-app-fg/5"
                    >
                      <div className="min-w-0">
                        <p className="truncate text-sm font-medium text-app-fg">
                          {delivery.trackNumber}
                        </p>
                        {delivery.orderNumber?.trim() ? (
                          <p className="truncate text-xs uppercase tracking-wide text-app-fg/55">
                            Заказ: {delivery.orderNumber}
                          </p>
                        ) : null}
                      </div>
                      <span className="shrink-0 text-xs uppercase tracking-wide text-app-fg/55">
                        {delivery.items?.length ?? delivery.itemIds?.length ?? 0} вещей
                      </span>
                    </Link>
                  </li>
                ))}
              </ul>
                )}
              </>
            )}
          </>
        )}

        {(isDrawer ? drawerTab === "integrations" : activeTab === "integrations") && (
          <>
            {related.length > 0 ? (
              <>
                <label className="relative mb-3 block">
                  <Search
                    className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-app-fg/35"
                    aria-hidden
                  />
                  <input
                    type="search"
                    value={intSearch}
                    onChange={(e) => setIntSearch(e.target.value)}
                    placeholder="Фильтр по названию, площадке, статусу…"
                    className="w-full border border-app-fg/15 bg-app-bg py-2.5 pl-9 pr-3 text-sm text-app-fg outline-none ring-app-accent/35 focus:ring-2"
                  />
                </label>
                {filteredRelatedIntegrations.length === 0 ? (
                  <div className="border border-dashed border-app-fg/15 px-4 py-6 text-sm text-app-fg/55">
                    Нет интеграций по текущему фильтру.
                  </div>
                ) : (
              <ul className="bg-app-bg">
                {filteredRelatedIntegrations.map((i) => {
                  const social = socialOptions.find((o) => o.id === i.socialNetworkId);
                  return (
                    <li key={i.id}>
                      <Link
                        href={`/integrations/${i.id}`}
                        className="flex flex-col gap-2 px-3 py-3 transition hover:bg-app-fg/5 sm:flex-row sm:items-center sm:justify-between"
                      >
                        <span className="truncate text-sm font-medium text-app-fg">
                          {i.title}
                        </span>
                        <div className="flex flex-wrap items-center gap-2">
                          <CrmPill className={CHANNEL_BADGE_CLASS}>
                            {social?.label ?? i.socialNetworkId}
                          </CrmPill>
                          <CrmPill className={STATUS_BADGE_CLASS[i.status]}>
                            {INTEGRATION_STATUS_LABELS[i.status]}
                          </CrmPill>
                          <span className="tabular-nums text-xs text-app-fg/55">
                            {formatRuMoney(i.amount ?? 0)}
                          </span>
                        </div>
                      </Link>
                    </li>
                  );
                })}
              </ul>
                )}
              </>
            ) : (
              <p className="border border-dashed border-app-fg/15 px-4 py-12 text-center text-sm text-app-fg/55">
                Интеграций пока нет.
                {canWriteCore ? " Создайте первую в разделе «Интеграции»." : ""}
              </p>
            )}
          </>
        )}

        {!isDrawer && activeTab === "links" && (
          <>
            <div className="flex items-center justify-between gap-3">
              <h2 className="text-xs font-semibold uppercase tracking-wider text-app-fg/55">
                Ссылки
              </h2>
              {canWriteCore && (
                <button
                  type="button"
                  onClick={openAddLink}
                  className="inline-flex items-center gap-2 bg-app-accent px-3 py-2 text-[11px] font-semibold uppercase tracking-wide text-app-fg transition hover:brightness-125"
                >
                  <Plus className="h-3.5 w-3.5" strokeWidth={1.5} />
                  Добавить ссылку
                </button>
              )}
            </div>

            {ownedLinks.length === 0 ? (
              <p className="border border-dashed border-app-fg/15 px-4 py-6 text-sm text-app-fg/55">
                Пока нет сохранённых ссылок.
              </p>
            ) : (
              <>
                <label className="relative mb-3 block">
                  <Search
                    className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-app-fg/35"
                    aria-hidden
                  />
                  <input
                    type="search"
                    value={linksSearch}
                    onChange={(e) => setLinksSearch(e.target.value)}
                    placeholder="Фильтр по названию или адресу…"
                    className="w-full border border-app-fg/15 bg-app-bg py-2.5 pl-9 pr-3 text-sm text-app-fg outline-none ring-app-accent/35 focus:ring-2"
                  />
                </label>
                {filteredOwnedLinks.length === 0 ? (
                  <p className="border border-dashed border-app-fg/15 px-4 py-6 text-sm text-app-fg/55">
                    Нет ссылок по текущему фильтру.
                  </p>
                ) : (
                  <ul className="bg-app-bg">
                    {filteredOwnedLinks.map((item) => {
                      const href = integrationPublicLinkHref(item.url);
                      return (
                        <li key={item.id} className="px-3 py-3">
                          <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
                            <div className="min-w-0 flex-1">
                              <p className="text-sm font-medium text-app-fg">{item.title}</p>
                              {href ? (
                                <a
                                  href={href}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  className="mt-1 block break-all font-mono text-[13px] text-app-fg transition"
                                >
                                  {item.url}
                                </a>
                              ) : (
                                <span className="mt-1 block break-all font-mono text-[13px] text-app-fg/70">
                                  {item.url}
                                </span>
                              )}
                            </div>
                            {canWriteCore || isAdmin ? (
                              <div className="flex shrink-0 flex-wrap gap-2 sm:justify-end">
                                {canWriteCore ? (
                                  <button
                                    type="button"
                                    onClick={() => openEditLink(item)}
                                    className="inline-flex items-center gap-1.5 border border-app-fg/15 px-2.5 py-1.5 text-[11px] font-semibold uppercase tracking-wide text-app-fg/80 transition hover:border-app-fg/35"
                                  >
                                    <Pencil className="h-3 w-3" strokeWidth={1.75} />
                                    Изменить
                                  </button>
                                ) : null}
                                {isAdmin ? (
                                  <ConfirmDeleteButton
                                    onConfirm={() => removeContractorLink(item.id)}
                                    confirmLabel="Подтвердить?"
                                    className="inline-flex items-center gap-1.5 border border-app-fg/15 px-2.5 py-1.5 text-[11px] font-semibold uppercase tracking-wide text-app-fg/80 transition hover:border-app-fg/35"
                                    confirmClassName="inline-flex items-center gap-1.5 border border-red-500/50 bg-red-500/10 px-2.5 py-1.5 text-[11px] font-semibold uppercase tracking-wide text-red-300"
                                  >
                                    <span className="inline-flex items-center gap-1.5">
                                      <Trash2 className="h-3 w-3" strokeWidth={1.5} />
                                      Удалить
                                    </span>
                                  </ConfirmDeleteButton>
                                ) : null}
                              </div>
                            ) : null}
                          </div>
                        </li>
                      );
                    })}
                  </ul>
                )}
              </>
            )}
          </>
        )}
      </section>

      {isLinkModalOpen && canWriteCore && contractor ? (
        <div className={overlayClass} role="presentation" onClick={closeLinkModal}>
          <div
            role="dialog"
            aria-modal="true"
            aria-labelledby="contractor-link-modal-title"
            className={modalShellClass}
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex shrink-0 items-start justify-between gap-3 border-b border-app-fg/15 px-5 py-4 sm:px-6">
              <p
                id="contractor-link-modal-title"
                className="text-sm font-semibold uppercase tracking-[0.12em] text-app-fg"
              >
                {editingLinkId ? "Редактировать ссылку" : "Добавить ссылку"}
              </p>
              <button
                type="button"
                onClick={closeLinkModal}
                className="border border-app-fg/15 p-2 text-app-fg/65 transition hover:border-app-fg/35"
                aria-label="Закрыть"
              >
                <X className="h-4 w-4" strokeWidth={1.5} />
              </button>
            </div>
            <div className="min-h-0 flex-1 overflow-y-auto px-5 py-5 sm:px-6">
              <div className="space-y-4">
                <label className="block text-xs uppercase tracking-wider text-app-fg/55">
                  Название
                  <input
                    value={draftLinkTitle}
                    onChange={(e) => {
                      setDraftLinkTitle(e.target.value);
                      setLinkModalError(null);
                    }}
                    className={`${selectClass} mt-1`}
                    placeholder="Например, Twitch"
                    autoComplete="off"
                  />
                </label>
                <label className="block text-xs uppercase tracking-wider text-app-fg/55">
                  Ссылка
                  <input
                    value={draftLinkUrl}
                    onChange={(e) => {
                      setDraftLinkUrl(e.target.value);
                      setLinkModalError(null);
                    }}
                    className={`${selectClass} mt-1 font-mono text-[13px]`}
                    placeholder="https://…"
                    inputMode="url"
                    autoComplete="url"
                  />
                </label>
                {linkModalError ? (
                  <p className="text-xs text-app-fg/80">{linkModalError}</p>
                ) : null}
              </div>
            </div>
            <div className="flex shrink-0 flex-col gap-2 border-t border-app-fg/15 bg-app-fg/[0.02] px-5 py-4 sm:flex-row sm:justify-end sm:gap-3 sm:px-6">
              <button
                type="button"
                onClick={closeLinkModal}
                className="inline-flex items-center justify-center border border-app-fg/20 px-4 py-2.5 text-xs font-semibold uppercase tracking-wide text-app-fg/80 transition hover:border-app-fg/40"
              >
                Отмена
              </button>
              <button
                type="button"
                onClick={handleSaveLink}
                className="inline-flex items-center justify-center gap-2 bg-app-accent px-5 py-2.5 text-xs font-semibold uppercase tracking-wide text-app-fg transition hover:brightness-125"
              >
                <Save className="h-3.5 w-3.5" strokeWidth={1.75} />
                {editingLinkId ? "Сохранить" : "Добавить"}
              </button>
            </div>
          </div>
        </div>
      ) : null}

      {isAddItemOpen && canWriteCore && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/65 px-4">
          <div className="w-full max-w-lg border border-app-fg/15 bg-app-bg p-5 shadow-accent-glow sm:p-6">
            <div className="mb-4 flex items-start justify-between gap-3">
              <h3 className="text-sm font-semibold uppercase tracking-[0.1em] text-app-fg">
                Добавить вещь
              </h3>
              <button
                type="button"
                onClick={() => setIsAddItemOpen(false)}
                className="border border-app-fg/15 p-1.5 text-app-fg/70 transition hover:border-app-fg/40"
                aria-label="Закрыть"
              >
                <X className="h-4 w-4" strokeWidth={1.5} />
              </button>
            </div>

            <form onSubmit={handleAddItem} className="space-y-3">
              <label className="block text-xs uppercase tracking-wider text-app-fg/55">
                Название
                <button
                  type="button"
                  onClick={() => setIsProductPickerOpen(true)}
                  className={`${fieldClass} mt-1`}
                  disabled={products.length === 0}
                >
                  <span className="line-clamp-1">
                    {selectedProduct?.name ?? "Нажмите для выбора вещи"}
                  </span>
                </button>
              </label>

              <label className="block text-xs uppercase tracking-wider text-app-fg/55">
                Размер
                <select
                  value={selectedSize}
                  onChange={(e) => setSelectedSize(e.target.value)}
                  required
                  className={`${fieldClass} mt-1 ${selectNativeChevronPad}`}
                  disabled={!selectedProduct}
                >
                  <option value="">Выбрать размер</option>
                  {sizeOptions.map((size) => (
                    <option key={size} value={size}>
                      {size}
                    </option>
                  ))}
                </select>
              </label>

              <button
                type="submit"
                className="inline-flex w-full items-center justify-center gap-2 bg-app-accent px-4 py-3 text-xs font-semibold uppercase tracking-wide text-app-fg transition hover:brightness-125"
              >
                <Plus className="h-4 w-4" strokeWidth={1.5} />
                Добавить
              </button>
            </form>
          </div>
        </div>
      )}

      {isProductPickerOpen && isAddItemOpen && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/75 px-4">
          <div className="w-full max-w-4xl border border-app-fg/15 bg-app-bg p-5 shadow-accent-glow sm:p-6">
            <div className="mb-4 flex items-start justify-between gap-3">
              <h3 className="text-sm font-semibold uppercase tracking-[0.1em] text-app-fg">
                Выбор вещи
              </h3>
              <button
                type="button"
                onClick={() => setIsProductPickerOpen(false)}
                className="border border-app-fg/15 p-1.5 text-app-fg/70 transition hover:border-app-fg/40"
                aria-label="Закрыть"
              >
                <X className="h-4 w-4" strokeWidth={1.5} />
              </button>
            </div>

            <input
              value={productSearch}
              onChange={(e) => setProductSearch(e.target.value)}
              placeholder="Поиск по названию..."
              className="mb-4 w-full border border-app-fg/15 bg-app-bg px-3 py-2.5 text-sm text-app-fg outline-none ring-app-accent/35 focus:ring-2"
            />

            <div className="max-h-[65vh] overflow-y-auto">
              {filteredProducts.length === 0 ? (
                <p className="border border-dashed border-app-fg/15 px-4 py-8 text-sm text-app-fg/55">
                  Ничего не найдено.
                </p>
              ) : (
                <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
                  {filteredProducts.map((p) => {
                    const pid = String(p.id ?? "");
                    const isSelected = pid === selectedProductId;
                    return (
                      <button
                        key={pid}
                        type="button"
                        onClick={() => {
                          setSelectedProductId(pid);
                          setSelectedSize("");
                          setIsProductPickerOpen(false);
                        }}
                        className={
                          isSelected
                            ? "overflow-hidden border-2 border-app-accent bg-app-bg text-left"
                            : "overflow-hidden border border-app-fg/15 bg-app-bg text-left transition hover:border-app-fg/40"
                        }
                      >
                        <div className="aspect-square w-full bg-app-fg/5">
                          {buildImageUrl(p.images?.[0]) ? (
                            <img
                              src={buildImageUrl(p.images?.[0])}
                              alt={p.name ?? pid}
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
                            {p.name ?? `Товар ${pid}`}
                          </p>
                        </div>
                      </button>
                    );
                  })}
                </div>
              )}
            </div>
          </div>
        </div>
      )}
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

function TabButton({
  active,
  label,
  count,
  onClick,
}: {
  active: boolean;
  label: string;
  count?: number;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={
        active
          ? "inline-flex items-center gap-1.5 bg-app-accent px-3 py-2 text-xs font-semibold uppercase tracking-wide text-app-fg"
          : "inline-flex items-center gap-1.5 border border-app-fg/15 bg-app-bg px-3 py-2 text-xs font-semibold uppercase tracking-wide text-app-fg/65 transition"
      }
    >
      {label}
      {count != null ? (
        <span className={active ? "tabular-nums opacity-70" : "tabular-nums opacity-50"}>
          {count}
        </span>
      ) : null}
    </button>
  );
}
