#!/usr/bin/env bash
# deploy.sh — entrypoint canônico de deploy da VPS.
#
# Uso:
#   ./scripts/deploy.sh           # deploya tudo (backend + frontend)
#   ./scripts/deploy.sh backend   # só backend
#   ./scripts/deploy.sh frontend  # só frontend
#
# NUNCA usar "docker compose restart" para deploy — ele roda a imagem antiga.
# Sempre usar este script ou "docker compose up -d --build --no-deps <serviço>".

set -euo pipefail

COMPOSE_FILE="/opt/peticiona/docker-compose.yml"
PROJECT_DIR="/opt/peticiona"
SSH_KEY="$HOME/.ssh/id_ed25519_peticiona"
VPS_HOST="root@31.97.249.204"
HEALTH_URL="https://peticiona.app.br/api/health"
TARGET="${1:-all}"

log()  { echo "[deploy] $*"; }
ok()   { echo "[deploy] ✓ $*"; }
fail() { echo "[deploy] ✗ $*" >&2; exit 1; }

# ── 1. Pull ──────────────────────────────────────────────────────────────────
log "git pull origin main..."
ssh -i "$SSH_KEY" "$VPS_HOST" "cd $PROJECT_DIR && git pull origin main" \
  || fail "git pull falhou"

# ── 2. Build + recreate ───────────────────────────────────────────────────────
case "$TARGET" in
  backend)
    SERVICES="backend"
    ;;
  frontend)
    SERVICES="frontend"
    ;;
  all)
    SERVICES="backend frontend"
    ;;
  *)
    fail "Target inválido: '$TARGET'. Use: backend | frontend | all"
    ;;
esac

for SVC in $SERVICES; do
  log "Rebuild + recreate: $SVC..."
  ssh -i "$SSH_KEY" "$VPS_HOST" \
    "cd $PROJECT_DIR && docker compose up -d --build --no-deps $SVC" \
    || fail "Build do $SVC falhou"
  ok "$SVC recriado com nova imagem"
done

# ── 3. Healthcheck ────────────────────────────────────────────────────────────
log "Aguardando healthcheck ($HEALTH_URL)..."
for i in $(seq 1 12); do
  STATUS=$(curl -s -o /dev/null -w "%{http_code}" "$HEALTH_URL" 2>/dev/null || echo "000")
  if [ "$STATUS" = "200" ]; then
    ok "API respondendo (HTTP 200)"
    break
  fi
  if [ "$i" -eq 12 ]; then
    fail "Healthcheck falhou após 60s (último status: $STATUS)"
  fi
  sleep 5
done

# ── 4. Smoke test básico ──────────────────────────────────────────────────────
HEALTH=$(curl -s "$HEALTH_URL")
if echo "$HEALTH" | grep -q '"status":"ok"'; then
  ok "Smoke test OK: $HEALTH"
else
  fail "Smoke test falhou: $HEALTH"
fi

echo ""
echo "╔══════════════════════════════════════╗"
echo "║  Deploy concluído com sucesso  🚀    ║"
echo "╚══════════════════════════════════════╝"
echo "  Serviço(s): $SERVICES"
echo "  URL: https://peticiona.app.br"
