#!/usr/bin/env bash
set -euo pipefail
ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$ROOT"

# Prisma CLI: путь к SQLite относительно prisma/schema.prisma.
# Node (standalone): относительно cwd → без абсолютного пути получаются две разные БД.
DB_FILE="${ROOT}/prisma/panel.sqlite"
export DATABASE_URL="file:${DB_FILE}"

export PORT="${PORT:-3000}"

# Сначала ставим все зависимости (в т.ч. Tailwind/PostCSS из devDependencies),
# затем включаем production только для сборки и рантайма.
npm ci

# Если раньше БД жила в standalone — переносим в prisma/panel.sqlite (один файл для CLI и runtime).
STANDALONE_DB="${ROOT}/.next/standalone/panel.sqlite"
if [ -f "${STANDALONE_DB}" ]; then
  if [ ! -f "${DB_FILE}" ] || [ "${STANDALONE_DB}" -nt "${DB_FILE}" ]; then
    echo "[deploy] sync SQLite: standalone → prisma/panel.sqlite"
    mkdir -p "$(dirname "${DB_FILE}")"
    cp "${STANDALONE_DB}" "${DB_FILE}"
  fi
fi

echo "[deploy] prisma db push…"
npx prisma db push

# Seed не запускаем — пароли на проде не сбрасываются.

export NODE_ENV=production
npm run build

STANDALONE="${ROOT}/.next/standalone"
if [ -f "${STANDALONE}/server.js" ]; then
  # Без этого в браузере нет JS/CSS → вечная «Загрузка…» (см. Next.js output standalone).
  mkdir -p "${STANDALONE}/.next/static" "${STANDALONE}/public"
  cp -R "${ROOT}/.next/static/." "${STANDALONE}/.next/static/"
  cp -R "${ROOT}/public/." "${STANDALONE}/public/"
  if [ -f "${ROOT}/.env" ]; then
    grep -v '^DATABASE_URL=' "${ROOT}/.env" > "${STANDALONE}/.env" || true
  else
    : > "${STANDALONE}/.env"
  fi
  echo "DATABASE_URL=\"file:${DB_FILE}\"" >> "${STANDALONE}/.env"
  cd "${STANDALONE}"
  exec node server.js
fi

echo "[deploy] WARN: .next/standalone/server.js не найден — fallback на next start"
cd "${ROOT}"
exec npx next start -H 0.0.0.0 -p "${PORT}"
