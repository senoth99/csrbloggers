#!/usr/bin/env bash
# Запуск панели без npm ci / build (после deploy-lite или полного deploy).
set -euo pipefail
ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT"

export PORT="${PORT:-3000}"
export PANEL_ROOT="$ROOT"
export NODE_ENV=production
export DATABASE_URL="${DATABASE_URL:-file:${ROOT}/prisma/panel.sqlite}"

STANDALONE="${ROOT}/.next/standalone"
if [ -d "$STANDALONE" ]; then
  mkdir -p "${STANDALONE}/prisma"
  [ -f "${ROOT}/prisma/schema.prisma" ] && cp "${ROOT}/prisma/schema.prisma" "${STANDALONE}/prisma/"
  exec env PANEL_ROOT="$ROOT" DATABASE_URL="$DATABASE_URL" node "${STANDALONE}/server.js"
fi

if [ -f "${ROOT}/.next/BUILD_ID" ]; then
  exec env PANEL_ROOT="$ROOT" DATABASE_URL="$DATABASE_URL" npx next start -H 0.0.0.0 -p "${PORT}"
fi

echo "Нет сборки (.next/standalone). Соберите на ПК: npm run build && rsync, или ./deploy.sh на сервере с swap." >&2
exit 1
