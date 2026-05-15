#!/usr/bin/env bash
set -euo pipefail
ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$ROOT"

export PORT="${PORT:-3000}"
export PANEL_ROOT="$ROOT"
export NODE_ENV=production

DB_DIR="${ROOT}/prisma"
DB_FILE="${DB_DIR}/panel.sqlite"
export DATABASE_URL="file:${DB_FILE}"

mkdir -p "$DB_DIR"

# Сначала ставим все зависимости (в т.ч. Tailwind/PostCSS из devDependencies),
# затем production-сборка.
npm ci

echo "[deploy] prisma db push → ${DB_FILE}"
npx prisma db push

npm run build

# Standalone: движок Prisma + schema (SQLite-файл остаётся в ${DB_FILE})
STANDALONE="${ROOT}/.next/standalone"
if [ -d "$STANDALONE" ]; then
  mkdir -p "${STANDALONE}/prisma"
  cp "${ROOT}/prisma/schema.prisma" "${STANDALONE}/prisma/"
  if [ -d "${ROOT}/node_modules/.prisma" ]; then
    mkdir -p "${STANDALONE}/node_modules/.prisma"
    cp -R "${ROOT}/node_modules/.prisma/." "${STANDALONE}/node_modules/.prisma/"
  fi
  if [ -d "${ROOT}/node_modules/@prisma/client" ]; then
    mkdir -p "${STANDALONE}/node_modules/@prisma"
    cp -R "${ROOT}/node_modules/@prisma/client" "${STANDALONE}/node_modules/@prisma/"
  fi
fi

# next.config: output standalone — запуск из корня репозитория (cwd = PANEL_ROOT)
if [ -f .next/standalone/server.js ]; then
  exec env PANEL_ROOT="$ROOT" DATABASE_URL="$DATABASE_URL" node .next/standalone/server.js
fi
echo "[deploy] WARN: .next/standalone/server.js не найден — fallback на next start"
exec env PANEL_ROOT="$ROOT" DATABASE_URL="$DATABASE_URL" npx next start -H 0.0.0.0 -p "${PORT}"
