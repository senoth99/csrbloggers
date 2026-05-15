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

LITE=0
for arg in "$@"; do
  case "$arg" in
    --lite | -l) LITE=1 ;;
  esac
done

if [ "$LITE" = "1" ]; then
  exec "${ROOT}/deploy-lite.sh"
fi

# Полная сборка на сервере — нужно ~1–2 ГБ RAM или swap (см. scripts/server-swap.sh).
export NODE_OPTIONS="${NODE_OPTIONS:---max-old-space-size=768}"

echo "[deploy] npm ci…"
npm ci

echo "[deploy] prisma db push → ${DB_FILE}"
npx prisma db push

echo "[deploy] next build (тяжёлая операция)…"
npm run build

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

exec "${ROOT}/scripts/start-panel.sh"
