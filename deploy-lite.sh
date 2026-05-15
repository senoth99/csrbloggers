#!/usr/bin/env bash
# Обновление на слабом VPS: git pull + схема БД + перезапуск, БЕЗ npm ci и build.
set -euo pipefail
ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$ROOT"

export PANEL_ROOT="$ROOT"
export NODE_ENV=production
DB_FILE="${ROOT}/prisma/panel.sqlite"
export DATABASE_URL="file:${DB_FILE}"
mkdir -p "${ROOT}/prisma"

if [ ! -x "${ROOT}/node_modules/.bin/prisma" ]; then
  echo "[deploy-lite] Нет node_modules — один раз нужен npm ci (лучше с включённым swap)." >&2
  npm ci
fi

echo "[deploy-lite] prisma db push → ${DB_FILE}"
npx prisma db push

STANDALONE="${ROOT}/.next/standalone"
if [ -d "${ROOT}/node_modules/.prisma" ] && [ -d "$STANDALONE" ]; then
  mkdir -p "${STANDALONE}/prisma" "${STANDALONE}/node_modules/.prisma" "${STANDALONE}/node_modules/@prisma"
  cp "${ROOT}/prisma/schema.prisma" "${STANDALONE}/prisma/" 2>/dev/null || true
  cp -R "${ROOT}/node_modules/.prisma/." "${STANDALONE}/node_modules/.prisma/" 2>/dev/null || true
  cp -R "${ROOT}/node_modules/@prisma/client" "${STANDALONE}/node_modules/@prisma/" 2>/dev/null || true
fi

echo "[deploy-lite] Запуск панели…"
exec "${ROOT}/scripts/start-panel.sh"
