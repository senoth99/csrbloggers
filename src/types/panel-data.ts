export type IntegrationStatus = "draft" | "active" | "paused" | "completed";
export type ContractorStatus = "active" | "paused";
export type DeliveryStatus =
  | "created"
  | "in_transit"
  | "in_pickup"
  | "delivered"
  | "returned";

export const INTEGRATION_STATUS_LABELS: Record<IntegrationStatus, string> = {
  draft: "Черновик",
  active: "В работе",
  paused: "Пауза",
  completed: "Завершена",
};

export const INTEGRATION_STATUSES: IntegrationStatus[] = [
  "draft",
  "active",
  "paused",
  "completed",
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
  active: "border border-transparent bg-app-accent text-app-fg",
  paused: "border-2 border-app-accent bg-app-bg text-app-fg",
  completed: "border border-transparent bg-app-accent text-app-fg",
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
