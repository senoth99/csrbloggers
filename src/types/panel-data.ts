/** Статусы интеграции (slug → подписи в INTEGRATION_STATUS_LABELS) */
export type IntegrationStatus =
  | "draft"
  | "published"
  | "postponed"
  | "returned"
  | "exchange"
  | "no_response";

const LEGACY_INTEGRATION_STATUS: Record<string, IntegrationStatus | undefined> = {
  active: "published",
  paused: "postponed",
  completed: "exchange",
};

/** Нормализация из JSON / старых данных (active/paused/completed) */
export function normalizeIntegrationStatus(raw: unknown): IntegrationStatus {
  const s = typeof raw === "string" ? raw.trim() : "";
  if (
    s === "draft" ||
    s === "published" ||
    s === "postponed" ||
    s === "returned" ||
    s === "exchange" ||
    s === "no_response"
  ) {
    return s;
  }
  return LEGACY_INTEGRATION_STATUS[s] ?? "draft";
}

/** Договорённость: черновик или перенос */
export function isAgreementIntegrationStatus(s: IntegrationStatus): boolean {
  return s === "draft" || s === "postponed";
}

/** Опубликованная интеграция (учёт в KPI «интеграции») */
export function isPublishedIntegrationStatus(s: IntegrationStatus): boolean {
  return s === "published";
}

export type ContractorStatus = "active" | "paused";
export type DeliveryStatus =
  | "created"
  | "in_transit"
  | "in_pickup"
  | "delivered"
  | "returned";

export const INTEGRATION_STATUS_LABELS: Record<IntegrationStatus, string> = {
  draft: "Черновик",
  published: "Опубликовано",
  postponed: "Перенос",
  returned: "Возврат",
  exchange: "Обмен",
  no_response: "Не отвечает",
};

export const INTEGRATION_STATUSES: IntegrationStatus[] = [
  "draft",
  "published",
  "postponed",
  "returned",
  "exchange",
  "no_response",
];

/** Ниша контрагента: список задаётся админом в админке */
export interface NicheOption {
  id: string;
  label: string;
}

export type ContractorSizeCategory = "micro" | "middle" | "large";

export const CONTRACTOR_SIZE_CATEGORY_LABELS: Record<ContractorSizeCategory, string> = {
  micro: "Микро",
  middle: "Миддл",
  large: "Крупный",
};

export const CONTRACTOR_SIZE_CATEGORIES: ContractorSizeCategory[] = [
  "micro",
  "middle",
  "large",
];

export type IntegrationCooperationType = "barter" | "commercial";

export const INTEGRATION_COOPERATION_LABELS: Record<IntegrationCooperationType, string> = {
  barter: "Бартер",
  commercial: "Коммерция",
};

export const INTEGRATION_COOPERATION_TYPES: IntegrationCooperationType[] = [
  "barter",
  "commercial",
];

export interface Contractor {
  id: string;
  name: string;
  /** Контактное лицо (как в списке заказов) */
  contactPerson?: string;
  /** Город (фильтр интеграций по контрагенту) */
  city?: string;
  /** Ниша (id из справочника nicheOptions) */
  nicheId?: string;
  /** Категория по размеру */
  sizeCategory?: ContractorSizeCategory;
  /** Промокод контрагента (если используется в интеграциях) */
  promoCode?: string;
  /** Вирусность — произвольная метка, вводится вручную */
  virality?: string;
  status?: ContractorStatus;
  /** Устаревшее ручное поле 0..10 (в UI не используется — рейтинг считается автоматически). */
  rating?: number;
  note?: string;
  createdAt?: string;
}

export interface ContractorItem {
  id: string;
  contractorId: string;
  productId: string;
  productName: string;
  size: string;
  imageUrl?: string;
  createdAt?: string;
}

/** Именованная внешняя ссылка у контрагента (профили, портфолио и т.п.) */
export interface ContractorLink {
  id: string;
  contractorId: string;
  /** Подпись в списке */
  title: string;
  /** URL (нормализованная строка для отображения и href) */
  url: string;
  createdAt?: string;
}

export interface Delivery {
  id: string;
  contractorId: string;
  orderNumber?: string;
  trackNumber: string;
  status: DeliveryStatus;
  itemIds?: string[];
  items?: Array<{
    id: string;
    productId: string;
    productName: string;
    size: string;
    imageUrl?: string;
  }>;
  createdAt?: string;
  updatedAt?: string;
  /** Если задано — позиции из доставки уже перенесены в наличие контрагента при «Получено». */
  receivedStockSyncedAt?: string;
  /** Закреплённый сотрудник (по умолчанию — кто создал) */
  assignedEmployeeId?: string;
  /** Время первого перевода в «Получено» (для задач и отчётов) */
  deliveredAt?: string;
}

export const CONTRACTOR_STATUS_LABELS: Record<ContractorStatus, string> = {
  active: "Активен",
  paused: "Пауза",
};

/** Обновить статус контрагента в массиве (для синхронизации с интеграциями). */
export function contractorsWithStatus(
  contractors: Contractor[],
  contractorId: string,
  status: ContractorStatus,
): Contractor[] {
  const id = contractorId.trim();
  if (!id) return contractors;
  return contractors.map((c) => (c.id === id ? { ...c, status } : c));
}

export const DELIVERY_STATUS_LABELS: Record<DeliveryStatus, string> = {
  created: "Создано",
  in_transit: "В пути",
  in_pickup: "В ПВЗ",
  delivered: "Получено",
  returned: "Возврат",
};

export interface SocialOption {
  id: string;
  label: string;
}

/** Сотрудник панели: отображаемое имя + внутренний идентификатор; вход по логину/паролю через panelLogin */
export interface Employee {
  id: string;
  /** Полное ФИО или отображаемое имя */
  fullName: string;
  /** Внутренний ключ (часто совпадает с логином панели; для старых данных — Telegram без @) */
  telegramUsername: string;
  /** Логин входа в панель */
  panelLogin?: string;
  /** URL картинки; иначе генерация по seed */
  avatarUrl?: string;
  createdAt?: string;
}

export interface IntegrationPosition {
  id: string;
  title: string;
  status: IntegrationStatus;
  socialNetworkId?: string;
  contractorId?: string;
  cooperationType?: IntegrationCooperationType;
  assignedEmployeeId?: string;
  releaseDate?: string;
  budget?: number;
  createdAt: string;
}

export interface Integration {
  id: string;
  contractorId: string;
  socialNetworkId: string;
  status: IntegrationStatus;
  /** Заголовок строки в таблице (уникальный среди интеграций) */
  title?: string;
  /** Дата выхода (календарь), YYYY-MM-DD */
  releaseDate?: string;
  /** Время выхода, HH:mm */
  releaseTime?: string;
  /** @deprecated сохраняется в старых данных */
  amount?: number;
  /** @deprecated сохраняется в старых данных */
  note?: string;
  /** Бюджет кампании, ₽ */
  budget?: number;
  /** Охваты (показы / доставки и т.п.), шт. */
  reach?: number;
  /** Активации промокодов по интеграции (ввод вручную) */
  promoActivations?: number;
  /** Ссылка на публикацию / материал (пост, ролик и т.п.) */
  publicLink?: string;
  /** Комментарий по интеграции (внутренний) */
  comment?: string;
  /** Закреплённый сотрудник (по умолчанию — кто создал) */
  assignedEmployeeId?: string;
  /** Условия сотрудничества */
  cooperationType?: IntegrationCooperationType;
  positions?: IntegrationPosition[];
  createdAt?: string;
}

/** Данные формы добавления интеграции */
export type AddIntegrationInput = {
  contractorId: string;
  socialNetworkId: string;
  /** Обязателен, уникален среди интеграций */
  title: string;
  status?: IntegrationStatus;
  releaseDate?: string;
  releaseTime?: string;
  budget?: number;
  reach?: number;
  promoActivations?: number;
  /** Ссылка на публикацию / материал */
  publicLink?: string;
  comment?: string;
  assignedEmployeeId?: string;
  cooperationType?: IntegrationCooperationType;
};

export type AddDeliveryInput = {
  contractorId: string;
  orderNumber?: string;
  trackNumber: string;
  items: Array<{
    productId: string;
    productName: string;
    size: string;
    imageUrl?: string;
  }>;
  assignedEmployeeId?: string;
};

/** Только три цвета приложения: чёрный, белый (+opacity в классах), акцент */
export const STATUS_BADGE_CLASS: Record<IntegrationStatus, string> = {
  draft: "border border-transparent bg-app-fg/[0.1] text-app-fg/75",
  published: "border border-transparent bg-app-accent text-app-fg",
  postponed: "border-2 border-app-accent bg-app-bg text-app-fg",
  returned: "border border-transparent bg-app-fg/[0.14] text-app-fg/80",
  exchange: "border border-transparent bg-app-fg/[0.2] text-app-fg",
  no_response: "border border-amber-700/40 bg-amber-950/30 text-amber-200/90",
};

export const CHANNEL_BADGE_CLASS =
  "border border-transparent bg-app-accent text-app-fg";

export const DEFAULT_SOCIAL_OPTIONS: SocialOption[] = [
  { id: "tiktok", label: "TikTok" },
  { id: "twitch", label: "Twitch" },
  { id: "inst", label: "Inst" },
  { id: "tg", label: "TG" },
  { id: "youtube", label: "YouTube" },
  { id: "vk", label: "VK" },
];
