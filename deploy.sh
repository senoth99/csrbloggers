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

STANDALONE="${ROOT}/.next/standalone"
if [ -f "${STANDALONE}/server.js" ]; then
  # Без этого в браузере нет JS/CSS → вечная «Загрузка…» (см. Next.js output standalone).
  mkdir -p "${STANDALONE}/.next/static" "${STANDALONE}/public"
  cp -R "${ROOT}/.next/static/." "${STANDALONE}/.next/static/"
  cp -R "${ROOT}/public/." "${STANDALONE}/public/"
  if [ -f "${ROOT}/.env" ]; then
    cp "${ROOT}/.env" "${STANDALONE}/.env"
  fi
  cd "${STANDALONE}"
  exec node server.js
fi

echo "[deploy] WARN: .next/standalone/server.js не найден — fallback на next start"
cd "${ROOT}"
exec npx next start -H 0.0.0.0 -p "${PORT}"
