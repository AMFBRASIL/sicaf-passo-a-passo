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
set -eo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"
ENV_FILE="$SCRIPT_DIR/deploy.env"
LOG_FILE="${DEPLOY_LOG:-/www/wwwlogs/cadbrasil-deploy.log}"

log() {
  echo "[$(date '+%Y-%m-%d %H:%M:%S')] $*" | tee -a "$LOG_FILE"
}

on_err() {
  log "ERRO: deploy abortado (linha ${BASH_LINENO[0]}, código ${1:-?})"
}
trap on_err ERR

if [[ -f "$ENV_FILE" ]]; then
  set +u
  # shellcheck disable=SC1090
  source "$ENV_FILE" || log "AVISO: não foi possível ler $ENV_FILE"
  set -u
fi

BRANCH="${DEPLOY_BRANCH:-main}"
PM2_USER="${DEPLOY_PM2_USER:-www}"
PM2_FRONTEND="${DEPLOY_PM2_FRONTEND:-frontcadbrasilfornecedor}"
PM2_BACKEND="${DEPLOY_PM2_BACKEND:-cadbrasil-backend}"
NODE_VERSION="${DEPLOY_NODE_VERSION:-22}"
SKIP_FRONTEND_BUILD="${SKIP_FRONTEND_BUILD:-0}"
SKIP_BACKEND_BUILD="${SKIP_BACKEND_BUILD:-0}"
DEPLOY_FORCE="${DEPLOY_FORCE:-0}"

load_node() {
  log "Configurando Node.js (alvo: v${NODE_VERSION})..."

  if [[ -n "${DEPLOY_NODE_BIN:-}" && -x "${DEPLOY_NODE_BIN}" ]]; then
    export PATH="$(dirname "${DEPLOY_NODE_BIN}"):${PATH}"
  fi

  if ! command -v node >/dev/null 2>&1; then
    local dir
    for dir in \
      /www/server/nodejs/v"${NODE_VERSION}".13.1/bin \
      /www/server/nodejs/v"${NODE_VERSION}".19.6/bin \
      /www/server/nodejs/v"${NODE_VERSION}"*/bin \
      /www/server/nvm/versions/node/v"${NODE_VERSION}"*/bin; do
      if [[ -x "${dir}/node" ]]; then
        export PATH="${dir}:${PATH}"
        break
      fi
    done
  fi

  if ! command -v node >/dev/null 2>&1; then
    export NVM_DIR="${NVM_DIR:-/www/server/nvm}"
    if [[ -s "$NVM_DIR/nvm.sh" ]]; then
      set +e
      # shellcheck disable=SC1091
      source "$NVM_DIR/nvm.sh"
      nvm use "$NODE_VERSION" >/dev/null 2>&1
      set -e
    fi
  fi

  if ! command -v node >/dev/null 2>&1; then
    log "ERRO: Node.js ${NODE_VERSION} não encontrado."
    log "Defina em scripts/deploy.env:"
    log "  DEPLOY_NODE_BIN=/www/server/nodejs/v22.13.1/bin/node"
    exit 1
  fi

  log "Node: $(node -v) | npm: $(npm -v 2>/dev/null || echo '?')"
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

if [[ "$BEFORE" == "$AFTER" && "$DEPLOY_FORCE" != "1" ]]; then
  log "Sem commits novos (${AFTER:0:7}). Nada a fazer. (use DEPLOY_FORCE=1 para rebuild)"
  exit 0
fi

if [[ "$BEFORE" == "$AFTER" ]]; then
  log "Sem commits novos — rebuild forçado (DEPLOY_FORCE=1)"
else
  log "Atualizado: ${BEFORE:0:7} → ${AFTER:0:7}"
fi

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
