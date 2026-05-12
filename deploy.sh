#!/usr/bin/env bash
set -euo pipefail
ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$ROOT"

export NODE_ENV="${NODE_ENV:-production}"
export PORT="${PORT:-3000}"

npm ci
npm run build
exec npx next start -H 0.0.0.0 -p "${PORT}"
