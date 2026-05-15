#!/usr/bin/env bash
set -euo pipefail
ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$ROOT"

export PORT="${PORT:-3000}"

# Сначала ставим все зависимости (в т.ч. Tailwind/PostCSS из devDependencies),
# затем включаем production только для сборки и рантайма.
npm ci

# Синхронизация SQLite со schema.prisma (новые колонки/таблицы после git pull).
# Не трогает SEED — пароли не сбрасываются. Нужен .env с DATABASE_URL.
if [ -f .env ] && grep -q '^DATABASE_URL=' .env; then
  echo "[deploy] prisma db push…"
  npx prisma db push
else
  echo "[deploy] WARN: нет DATABASE_URL в .env — пропуск prisma db push"
fi

export NODE_ENV=production
npm run build

# next.config: output standalone — запуск через server.js, не next start
if [ -f .next/standalone/server.js ]; then
  exec node .next/standalone/server.js
fi
echo "[deploy] WARN: .next/standalone/server.js не найден — fallback на next start"
exec npx next start -H 0.0.0.0 -p "${PORT}"
