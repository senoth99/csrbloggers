#!/usr/bin/env bash
set -euo pipefail
ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$ROOT"

export PORT="${PORT:-3000}"

# Сначала ставим все зависимости (в т.ч. Tailwind/PostCSS из devDependencies),
# затем включаем production только для сборки и рантайма.
npm ci
export NODE_ENV=production
npm run build
exec npx next start -H 0.0.0.0 -p "${PORT}"
