#!/usr/bin/env bash
# Teşvikiye — üretim yüklemesi (cPanel / Apache).
# Kullanım: scripts/deploy.sh [--dry-run]
# Ayarlar deploy.env dosyasından okunur (git'e girmez):
#   DEPLOY_HOST=217.131.14.126
#   DEPLOY_USER=teshvikiyeadmin
#   DEPLOY_PORT=22
#   DEPLOY_PATH=/home/teshvikiyeadmin/public_html      # teshvikiye.com docroot
#   DEPLOY_KEY=~/.ssh/id_ed25519                         # SSH anahtarı (parola kullanılmaz)
set -euo pipefail
cd "$(dirname "$0")/.."

ENV_FILE="${DEPLOY_ENV_FILE:-deploy.env}"
if [[ -f "$ENV_FILE" ]]; then
  # shellcheck disable=SC1090
  source "$ENV_FILE"
fi
: "${DEPLOY_HOST:?deploy.env içinde DEPLOY_HOST tanımlı olmalı}"
: "${DEPLOY_USER:?deploy.env içinde DEPLOY_USER tanımlı olmalı}"
: "${DEPLOY_PATH:?deploy.env içinde DEPLOY_PATH tanımlı olmalı}"
DEPLOY_PORT="${DEPLOY_PORT:-22}"
DEPLOY_KEY="${DEPLOY_KEY:-$HOME/.ssh/id_ed25519}"
DRY_RUN=""
[[ "${1:-}" == "--dry-run" ]] && DRY_RUN="--dry-run"

SSH_OPTS=(-p "$DEPLOY_PORT" -i "$DEPLOY_KEY" -o BatchMode=yes -o StrictHostKeyChecking=accept-new)

echo "▶ Derleme (npm run build)"
npm run build --silent

echo "▶ Sunucu hazırlığı: $DEPLOY_USER@$DEPLOY_HOST:$DEPLOY_PATH"
ssh "${SSH_OPTS[@]}" "$DEPLOY_USER@$DEPLOY_HOST" "mkdir -p '$DEPLOY_PATH'"

echo "▶ Yükleme (tar over ssh — sunucuda rsync yok)"
if [[ -n "$DRY_RUN" ]]; then
  echo "(dry-run) yükleme atlandı"
else
  # Eski derleme dosyalarını temizle; cPanel dosyaları (cgi-bin, .well-known, php.ini, .user.ini), api/ (Passenger) ve uploads/ korunur.
  ssh "${SSH_OPTS[@]}" "$DEPLOY_USER@$DEPLOY_HOST" "cd '$DEPLOY_PATH' && rm -rf assets fonts index.html favicon.svg"
  COPYFILE_DISABLE=1 tar -C dist -czf - . | ssh "${SSH_OPTS[@]}" "$DEPLOY_USER@$DEPLOY_HOST" "tar -C '$DEPLOY_PATH' -xzf -"
fi

echo "▶ Doğrulama"
ssh "${SSH_OPTS[@]}" "$DEPLOY_USER@$DEPLOY_HOST" "ls -la '$DEPLOY_PATH' | head -20"
echo "✔ Tamam: https://teshvikiye.com"
