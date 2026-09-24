#!/usr/bin/env bash
# Günlük veritabanı yedeği (cron). Yedekler docroot DIŞINDA ~/backups altında, 14 gün tutulur, 600 izinle.
set -euo pipefail
ENV_FILE="$HOME/api/.env"
[[ -f "$ENV_FILE" ]] || { echo "env yok" >&2; exit 1; }
set -a; source "$ENV_FILE"; set +a
mkdir -p "$HOME/backups" && chmod 700 "$HOME/backups"
umask 077
OUT="$HOME/backups/${DB_NAME}-$(date +%Y%m%d-%H%M).sql.gz"
mysqldump --single-transaction --quick --routines --triggers -h "${DB_HOST:-127.0.0.1}" -u "$DB_USER" -p"$DB_PASSWORD" "$DB_NAME" | gzip -9 > "$OUT"
find "$HOME/backups" -name "${DB_NAME}-*.sql.gz" -mtime +14 -delete
echo "yedek: $OUT"
