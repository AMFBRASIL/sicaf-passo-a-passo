#!/usr/bin/env bash
# =============================================================================
# CADBRASIL — Deploy automático no VPS (git pull + build + restart PM2)
#
# Uso manual:
#   cd /www/wwwroot/sicaf-passo-a-passo
#   bash scripts/deploy-vps.sh
#
# Configuração (opcional): copie scripts/deploy.env.example → scripts/deploy.env
# =============================================================================
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"
ENV_FILE="$SCRIPT_DIR/deploy.env"
LOG_FILE="${DEPLOY_LOG:-/www/wwwlogs/cadbrasil-deploy.log}"

if [[ -f "$ENV_FILE" ]]; then
  # shellcheck disable=SC1090
  source "$ENV_FILE"
fi

BRANCH="${DEPLOY_BRANCH:-main}"
PM2_USER="${DEPLOY_PM2_USER:-www}"
PM2_FRONTEND="${DEPLOY_PM2_FRONTEND:-frontcadbrasilfornecedor}"
PM2_BACKEND="${DEPLOY_PM2_BACKEND:-cadbrasil-backend}"
NODE_VERSION="${DEPLOY_NODE_VERSION:-22}"
SKIP_FRONTEND_BUILD="${SKIP_FRONTEND_BUILD:-0}"
SKIP_BACKEND_BUILD="${SKIP_BACKEND_BUILD:-0}"

log() {
  echo "[$(date '+%Y-%m-%d %H:%M:%S')] $*" | tee -a "$LOG_FILE"
}

load_node() {
  export NVM_DIR="${NVM_DIR:-/www/server/nvm}"
  if [[ -s "$NVM_DIR/nvm.sh" ]]; then
    # shellcheck disable=SC1091
    source "$NVM_DIR/nvm.sh"
    nvm use "$NODE_VERSION" >/dev/null 2>&1 || nvm use --delete-prefix "v${NODE_VERSION}" >/dev/null 2>&1 || true
  fi
  if ! node -v | grep -q "v${NODE_VERSION%%.*}"; then
    export PATH="/www/server/nvm/versions/node/v${NODE_VERSION}.22.3/bin:/www/server/nvm/versions/node/v${NODE_VERSION}.13.1/bin:$PATH"
  fi
  log "Node: $(node -v) | npm: $(npm -v)"
}

pm2_restart() {
  local name="$1"
  if sudo -u "$PM2_USER" pm2 describe "$name" >/dev/null 2>&1; then
    log "PM2 restart: $name"
    sudo -u "$PM2_USER" pm2 restart "$name" --update-env
  else
    log "AVISO: processo PM2 '$name' não encontrado (usuário $PM2_USER). Reinicie pelo aaPanel."
  fi
}

cd "$REPO_ROOT"
log "========== Deploy iniciado =========="
log "Repo: $REPO_ROOT | Branch: $BRANCH"

load_node

BEFORE="$(git rev-parse HEAD)"
git fetch origin "$BRANCH"
git pull origin "$BRANCH" --ff-only
AFTER="$(git rev-parse HEAD)"

if [[ "$BEFORE" == "$AFTER" ]]; then
  log "Sem commits novos ($AFTER). Nada a fazer."
  exit 0
fi

log "Atualizado: ${BEFORE:0:7} → ${AFTER:0:7}"

# ── Backend ───────────────────────────────────────────────────────────────────
if [[ "$SKIP_BACKEND_BUILD" != "1" ]]; then
  log "── Backend: npm install + build ──"
  cd "$REPO_ROOT/backend"
  npm install --no-fund --no-audit
  npm run build
  pm2_restart "$PM2_BACKEND"
fi

# ── Frontend ──────────────────────────────────────────────────────────────────
if [[ "$SKIP_FRONTEND_BUILD" != "1" ]]; then
  log "── Frontend: npm install + build ──"
  cd "$REPO_ROOT"
  npm install --no-fund --no-audit
  npm run build
  pm2_restart "$PM2_FRONTEND"
fi

sudo -u "$PM2_USER" pm2 save >/dev/null 2>&1 || true

log "========== Deploy concluído com sucesso =========="
