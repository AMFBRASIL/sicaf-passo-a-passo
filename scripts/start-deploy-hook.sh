#!/usr/bin/env bash
# Inicia o webhook de deploy com Node do aaPanel (PM2 usuário www).
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ENV_FILE="$SCRIPT_DIR/deploy.env"
NODE_BIN="${DEPLOY_NODE_BIN:-/www/server/nodejs/v22.13.1/bin/node}"

if [[ -f "$ENV_FILE" ]]; then
  set +u
  # shellcheck disable=SC1090
  source "$ENV_FILE"
  set -u
  NODE_BIN="${DEPLOY_NODE_BIN:-$NODE_BIN}"
fi

if [[ ! -x "$NODE_BIN" ]]; then
  echo "ERRO: Node não encontrado: $NODE_BIN" >&2
  exit 1
fi

exec "$NODE_BIN" "$SCRIPT_DIR/webhook-deploy.cjs"
