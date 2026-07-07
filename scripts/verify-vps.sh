#!/usr/bin/env bash
# =============================================================================
# CADBRASIL — Verifica se o VPS está atualizado e saudável
#
# Uso:
#   cd /www/wwwroot/sicaf-passo-a-passo
#   bash scripts/verify-vps.sh
#
# Opcional em scripts/deploy.env:
#   VERIFY_PUBLIC_URL=https://homolog.cadbrasil.com.br
# =============================================================================
set -eo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"
ENV_FILE="$SCRIPT_DIR/deploy.env"

if [[ -f "$ENV_FILE" ]]; then
  set +u
  # shellcheck disable=SC1090
  source "$ENV_FILE" || true
  set -u
fi

BRANCH="${DEPLOY_BRANCH:-main}"
PM2_USER="${DEPLOY_PM2_USER:-www}"
PM2_FRONTEND="${DEPLOY_PM2_FRONTEND:-FornecedorFrontend}"
PM2_BACKEND="${DEPLOY_PM2_BACKEND:-FornecedorBackend}"
FRONTEND_PORT="${VERIFY_FRONTEND_PORT:-3000}"
BACKEND_PORT="${VERIFY_BACKEND_PORT:-3001}"
PUBLIC_URL="${VERIFY_PUBLIC_URL:-}"

PASS=0
FAIL=0
WARN=0

ok()   { echo "  [OK]   $*"; PASS=$((PASS + 1)); }
fail() { echo "  [FAIL] $*"; FAIL=$((FAIL + 1)); }
warn() { echo "  [WARN] $*"; WARN=$((WARN + 1)); }

section() {
  echo ""
  echo "== $* =="
}

http_code() {
  curl -sS -o /dev/null -w "%{http_code}" --max-time 10 "$1" 2>/dev/null || echo "000"
}

cd "$REPO_ROOT"

section "Git"
if git rev-parse --is-inside-work-tree >/dev/null 2>&1; then
  LOCAL_SHA="$(git rev-parse HEAD)"
  LOCAL_SHORT="$(git rev-parse --short HEAD)"
  ok "Commit local: ${LOCAL_SHORT} (${LOCAL_SHA})"

  if git fetch origin "$BRANCH" >/dev/null 2>&1; then
    REMOTE_SHA="$(git rev-parse "origin/${BRANCH}" 2>/dev/null || echo "")"
    if [[ -n "$REMOTE_SHA" ]]; then
      REMOTE_SHORT="$(git rev-parse --short "origin/${BRANCH}")"
      if [[ "$LOCAL_SHA" == "$REMOTE_SHA" ]]; then
        ok "Sincronizado com origin/${BRANCH} (${REMOTE_SHORT})"
      else
        fail "Atrasado em relação ao GitHub — origin/${BRANCH}=${REMOTE_SHORT}, local=${LOCAL_SHORT}"
        echo "         Rode: git pull origin ${BRANCH} && DEPLOY_FORCE=1 bash scripts/deploy-vps.sh"
      fi
    else
      warn "Não foi possível ler origin/${BRANCH}"
    fi
  else
    warn "git fetch falhou (rede ou credenciais)"
  fi

  if [[ -n "$(git status --porcelain 2>/dev/null)" ]]; then
    warn "Há alterações locais não commitadas no VPS (podem bloquear git pull)"
    git status --short | head -5 | sed 's/^/         /'
  else
    ok "Working tree limpo"
  fi
else
  fail "Não é um repositório git em $REPO_ROOT"
fi

section "Build frontend"
ASSETS_DIR="$REPO_ROOT/.output/public/assets"
SERVER_ENTRY="$REPO_ROOT/.output/server/index.mjs"

if [[ -f "$SERVER_ENTRY" ]]; then
  ok ".output/server/index.mjs existe"
else
  fail "Falta .output/server/index.mjs — rode: npm run build"
fi

if [[ -d "$ASSETS_DIR" ]]; then
  ASSET_COUNT="$(find "$ASSETS_DIR" -maxdepth 1 -type f \( -name '*.js' -o -name '*.css' -o -name '*.mjs' \) | wc -l | tr -d ' ')"
  if [[ "${ASSET_COUNT:-0}" -ge 10 ]]; then
    ok ".output/public/assets: ${ASSET_COUNT} arquivos"
    SAMPLE_ASSET="$(find "$ASSETS_DIR" -maxdepth 1 -type f -name 'index-*.js' | head -1)"
    if [[ -z "$SAMPLE_ASSET" ]]; then
      SAMPLE_ASSET="$(find "$ASSETS_DIR" -maxdepth 1 -type f -name '*.js' | head -1)"
    fi
    if [[ -n "$SAMPLE_ASSET" ]]; then
      SAMPLE_NAME="/assets/$(basename "$SAMPLE_ASSET")"
      ok "Asset de teste: ${SAMPLE_NAME}"
    fi
  else
    fail ".output/public/assets quase vazio (${ASSET_COUNT:-0} arquivos) — rebuild necessário"
  fi
else
  fail "Falta pasta .output/public/assets"
  SAMPLE_NAME=""
fi

section "Build backend"
if [[ -f "$REPO_ROOT/backend/.next/BUILD_ID" ]]; then
  BUILD_ID="$(cat "$REPO_ROOT/backend/.next/BUILD_ID")"
  ok "backend/.next/BUILD_ID = ${BUILD_ID}"
else
  fail "Backend não buildado — rode: cd backend && npm run build"
fi

section "PM2"
for proc in "$PM2_FRONTEND" "$PM2_BACKEND"; do
  if sudo -u "$PM2_USER" pm2 describe "$proc" >/dev/null 2>&1; then
    STATUS="$(sudo -u "$PM2_USER" pm2 jlist 2>/dev/null | node -e "
      const name = process.argv[1];
      let data = '';
      process.stdin.on('data', c => data += c);
      process.stdin.on('end', () => {
        try {
          const list = JSON.parse(data);
          const p = list.find(x => x.name === name);
          process.stdout.write(p?.pm2_env?.status || 'unknown');
        } catch { process.stdout.write('unknown'); }
      });
    " "$proc" 2>/dev/null || echo "unknown")"
    if [[ "$STATUS" == "online" ]]; then
      ok "PM2 ${proc}: online"
    else
      fail "PM2 ${proc}: ${STATUS}"
    fi
  else
    fail "PM2 ${proc}: processo não encontrado (usuário ${PM2_USER})"
  fi
done

section "HTTP local"
FE_HOME="$(http_code "http://127.0.0.1:${FRONTEND_PORT}/")"
if [[ "$FE_HOME" == "200" ]]; then
  ok "Frontend :${FRONTEND_PORT}/ → ${FE_HOME}"
else
  fail "Frontend :${FRONTEND_PORT}/ → ${FE_HOME}"
fi

if [[ -n "${SAMPLE_NAME:-}" ]]; then
  FE_ASSET="$(http_code "http://127.0.0.1:${FRONTEND_PORT}${SAMPLE_NAME}")"
  if [[ "$FE_ASSET" == "200" ]]; then
    ok "Frontend asset ${SAMPLE_NAME} → ${FE_ASSET}"
  else
    fail "Frontend asset ${SAMPLE_NAME} → ${FE_ASSET} (chunks quebrados = tela em branco)"
  fi
fi

BE_HEALTH="$(http_code "http://127.0.0.1:${BACKEND_PORT}/api/v1/health")"
if [[ "$BE_HEALTH" == "200" ]]; then
  ok "Backend :${BACKEND_PORT}/api/v1/health → ${BE_HEALTH}"
else
  fail "Backend :${BACKEND_PORT}/api/v1/health → ${BE_HEALTH}"
fi

if [[ -n "$PUBLIC_URL" ]]; then
  section "HTTP público (${PUBLIC_URL})"
  PUB_HOME="$(http_code "${PUBLIC_URL%/}/")"
  if [[ "$PUB_HOME" == "200" ]]; then
    ok "${PUBLIC_URL%/}/ → ${PUB_HOME}"
  else
    fail "${PUBLIC_URL%/}/ → ${PUB_HOME}"
  fi

  if [[ -n "${SAMPLE_NAME:-}" ]]; then
    PUB_ASSET="$(http_code "${PUBLIC_URL%/}${SAMPLE_NAME}")"
    if [[ "$PUB_ASSET" == "200" ]]; then
      ok "${PUBLIC_URL%/}${SAMPLE_NAME} → ${PUB_ASSET}"
    else
      fail "${PUBLIC_URL%/}${SAMPLE_NAME} → ${PUB_ASSET}"
    fi
  fi

  PUB_API="$(http_code "${PUBLIC_URL%/}/api/v1/health")"
  if [[ "$PUB_API" == "200" ]]; then
    ok "${PUBLIC_URL%/}/api/v1/health → ${PUB_API}"
  else
    fail "${PUBLIC_URL%/}/api/v1/health → ${PUB_API}"
  fi
fi

section "Resumo"
echo "  OK: ${PASS} | FAIL: ${FAIL} | WARN: ${WARN}"
if [[ "$FAIL" -gt 0 ]]; then
  echo ""
  echo "Correção rápida:"
  echo "  cd $REPO_ROOT"
  echo "  git pull origin ${BRANCH}"
  echo "  DEPLOY_FORCE=1 bash scripts/deploy-vps.sh"
  echo "  bash scripts/verify-vps.sh"
  exit 1
fi

echo ""
echo "VPS certificado — deploy parece correto."
exit 0
