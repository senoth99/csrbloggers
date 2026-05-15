#!/usr/bin/env bash
# Однократно на VPS с 512MB–1GB RAM перед первым ./deploy.sh
# Запуск: sudo bash scripts/server-swap.sh
set -euo pipefail
SWAP="${SWAP:-/swapfile}"
SIZE="${SIZE:-2G}"

if [ "$(id -u)" -ne 0 ]; then
  echo "Запустите с sudo." >&2
  exit 1
fi

if swapon --show | grep -q "$SWAP"; then
  echo "Swap уже включён:"
  swapon --show
  exit 0
fi

fallocate -l "$SIZE" "$SWAP" 2>/dev/null || dd if=/dev/zero of="$SWAP" bs=1M count=2048 status=progress
chmod 600 "$SWAP"
mkswap "$SWAP"
swapon "$SWAP"
echo "Swap включён:"
swapon --show

if ! grep -q "$SWAP" /etc/fstab 2>/dev/null; then
  echo "$SWAP none swap sw 0 0" >> /etc/fstab
  echo "Добавлено в /etc/fstab"
fi
