# casher-bloggers-panel

Внутренняя CRM-панель для управления блогерскими интеграциями Casher Collection.
Сотрудники ведут контрагентов (блогеры), интеграции (выходы контента), доставки товаров, задачи, промокоды.

## Стек

- **Next.js 14** (App Router), **TypeScript**, **Tailwind CSS**
- **Prisma + SQLite** — хранилище пользователей и единый JSON-снапшот данных
- **Нет UI-библиотеки** — всё написано вручную на Tailwind
- **Нет тестов**

## Запуск

```bash
npm run dev  # predev сам создаёт .env, пушит схему, делает seed
# Логин: senoth / admin (dev)
```

## Архитектура данных

Вся бизнес-логика — контрагенты, интеграции, доставки, сотрудники — живёт в **одной JSON-колонке** `PanelSnapshot.data` (SQLite).
Запись через `PUT /api/panel-data` с оптимистичной блокировкой по полю `revision` (заголовок `X-Panel-Base-Revision`).
На клиенте данные дополнительно кэшируются в `localStorage` под ключом `casher-panel-data-v1`.

Пользователи панели и сессии — отдельная таблица `User` в той же SQLite.

## Хеширование паролей

Новые пароли хешируются `scrypt(password, random_salt, 32, {N:16384,r:8,p:1})` → `scrypt:<salt_hex>:<hash_hex>`.
Старые хеши (SHA-256) верифицируются и **перехешируются при первом входе** — миграция прозрачная.

## Ключевые файлы

| Файл | Роль |
|------|------|
| `src/context/PanelDataContext.tsx` | **1785 строк** — god-context, всё состояние + все мутации |
| `src/context/AuthContext.tsx` | Аутентификация, роли, список пользователей |
| `src/types/panel-data.ts` | Все типы домена (Contractor, Integration, Delivery, …) |
| `src/lib/panel-session-server.ts` | HMAC-сессия (кастомная, не JWT) |
| `src/lib/auth-password.ts` | scrypt-хеш (новый) + legacy SHA-256 верификация |
| `src/app/api/panel-data/route.ts` | GET/PUT снапшота с конфликт-детекцией |
| `src/app/api/auth/` | login / logout / me / users |
| `src/app/api/casher-products/route.ts` | Прокси каталога (CORS-обход, кеш 5 мин) |
| `src/app/api/promocodes/route.ts` | Прокси промокодов Casher API |
| `src/screens/` | Экраны (логика + рендер вместе) |

## Команды

```bash
npm run dev          # dev-сервер 0.0.0.0:3000 (auto-setup)
npm run build        # prisma generate + next build
npm run typecheck    # tsc --noEmit
npm run lint         # eslint
npm run ci           # typecheck + lint + build
npm run db:push      # применить схему без миграций
npm run db:seed      # создать суперадмина (пароль из SEED_ADMIN_PASSWORD или случайный)
npm run db:migrate   # prisma migrate deploy (prod)
```

---

## Что улучшено

- **Хеширование паролей**: SHA-256 без соли → scrypt с per-user random salt
- **Pepper больше не публичен**: убран `NEXT_PUBLIC_AUTH_PEPPER` → `AUTH_PEPPER`
- **Rate limit на `/api/auth/login`**: 10 попыток / 15 мин per IP, возврат 429
- **Пароль суперадмина**: seed читает `SEED_ADMIN_PASSWORD` или генерирует случайный
- **Прокси каталога**: кеш `revalidate: 300` вместо `no-store`
- **`npm run dev` auto-setup**: `predev` сам создаёт `.env`, пушит схему, сидит БД
- **Метрики дашборда**: `integrationsPublishedInMonth` и bar-chart считают по `releaseDate` (не `createdAt`)
- **UTC-баг в `isoInYearMonth`**: исправлен на `getUTCFullYear`/`getUTCMonth`
- **`currentYearMonth` в дашборде**: убран `useMemo`, вычисляется при каждом рендере
- **Задача «убедиться в выходе»**: создаётся при дате без времени (берёт начало дня)
- **Дельта промокодов**: при одном снапшоте за месяц база = 0, не `last`
- **O(n²) рейтинг контрагентов**: перегруппировка в `Map` перед вычислением
- **Вкладки контрагента**: счётчики элементов на каждой вкладке
- **Подтверждение удаления**: `window.confirm` для вещей и ссылок
- **Источники данных в дашборде**: явно подписаны «ручные данные» и «Casher API»
- **CSV-экспорт**: добавлены колонки `releaseDate`, `platform`, `cooperationType`, `reach`, `budget`
- **Race condition задач**: `completedTaskKeys` перенесены в таблицу `User` per-user, новый API `/api/tasks/completed`
- **Двойной запрос промокодов**: `usePromocodes` вынесен в `PromocodesContext`, один fetch на сессию
- **Ошибки сохранения**: при сбое PUT показывается баннер в `AppShell`, очищается кнопкой
- **Маршрут интеграций**: `/panel/[id]` → `/integrations/[id]`, список `/panel` → `/integrations`
- **Скролл-индикатор таблиц**: fade-right градиент на таблицах в `ContractorsScreen` и `DeliveriesScreen`
- **Онбординг**: карточка на дашборде при отсутствии данных
- **Поля контрагента**: «ФИО» → «Контактное лицо» в заголовках и фильтрах
- **Таймзона дат**: `formatRuDate`/`formatRuTime` используют UTC явно
- **Отчёты**: реализован `ReportsScreen` — сводная таблица за 6 месяцев (интеграции, охваты, бюджет, CPM, доставки)
- **ESLint безопасность**: добавлены правила `no-eval`, `no-implied-eval`, `no-new-func`, `no-script-url`

---

## Открытые задачи

### UI/UX

**U9. Нет focus-trap в модалах**
Tab уходит «за» модал в фоновый контент. Нарушение WCAG 2.1 (2.4.3).
Решение: `focus-trap-react` или своя реализация.

### Архитектура

**A1. Весь домен в одном JSON-блобе**
Нет нормальных запросов, нет индексов, конфликты при параллельных изменениях.
Решение: отдельные Prisma-модели для каждого домена.

**A2. `PanelDataContext` — god-object**
Загрузка, синхронизация, все CRUD + бизнес-логика в одном файле.
Решение: разбить на `useContractors`, `useIntegrations`, `useDeliveries`, `useTasks`.

**A3. Экраны смешивают логику и рендер**
`ContractorDetailScreen`, `PanelScreen`, `DeliveriesScreen` — крупные файлы.
Решение: бизнес-логику в хуки, компоненты дробить.

### Функциональность

**F4. Нет тестов**
Критичные функции (`verifyPassword`, `signSession`, `buildOpenTasks`, метрики) без покрытия.
