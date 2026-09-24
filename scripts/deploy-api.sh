#!/usr/bin/env bash
# Teşvikiye — API (Node 22 / Passenger) yüklemesi. Uygulama kökü sunucuda ~/api, URL: https://teshvikiye.com/api
# Kullanım: scripts/deploy-api.sh            (yükle + npm install + migrate + seed + restart + health)
#           scripts/deploy-api.sh --no-seed  (tohumlamayı atla)
set -euo pipefail
cd "$(dirname "$0")/.."
ENV_FILE="${DEPLOY_ENV_FILE:-deploy.env}"
[[ -f "$ENV_FILE" ]] && source "$ENV_FILE"
: "${DEPLOY_HOST:?}"; : "${DEPLOY_USER:?}"
DEPLOY_PORT="${DEPLOY_PORT:-22}"
DEPLOY_KEY="${DEPLOY_KEY:-$HOME/.ssh/id_ed25519}"
API_PATH="${DEPLOY_API_PATH:-/home/$DEPLOY_USER/api}"
NODEVENV="${DEPLOY_NODEVENV:-/home/$DEPLOY_USER/nodevenv/api/22/bin/activate}"
SEED=1; [[ "${1:-}" == "--no-seed" ]] && SEED=0
SSH_OPTS=(-p "$DEPLOY_PORT" -i "$DEPLOY_KEY" -o BatchMode=yes -o StrictHostKeyChecking=accept-new)
R="$DEPLOY_USER@$DEPLOY_HOST"

echo "▶ Yerel kontrol (node --check)"
find api -name '*.js' -not -path '*/node_modules/*' -print0 | xargs -0 -n1 node --check

echo "▶ Yükleme (tar over ssh): $R:$API_PATH"
# .env sunucuda kalır; node_modules sunucuda kurulur.
COPYFILE_DISABLE=1 tar -C api --exclude node_modules --exclude .env --exclude '.env.*' -czf - . \
  | ssh "${SSH_OPTS[@]}" "$R" "mkdir -p '$API_PATH' && tar -C '$API_PATH' -xzf - && chmod 711 '$API_PATH' && mkdir -p '$API_PATH/public' '$API_PATH/tmp'"

echo "▶ Bağımlılıklar + migration + seed (sunucuda, Node 22 venv)"
ssh "${SSH_OPTS[@]}" "$R" "set -e; source '$NODEVENV'; cd '$API_PATH'; npm install --omit=dev --no-audit --no-fund --loglevel=error; node scripts/migrate.js; if [ '$SEED' = '1' ]; then node scripts/seed.js; fi; mkdir -p tmp && touch tmp/restart.txt; echo restart-touched"

echo "▶ Sağlık kontrolü"
sleep 3
curl -fsS -m 30 "https://teshvikiye.com/api/health" && echo
echo "✔ API yüklendi"
