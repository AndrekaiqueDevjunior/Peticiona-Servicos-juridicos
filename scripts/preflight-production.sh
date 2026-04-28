#!/usr/bin/env bash

set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
ENV_FILE="$ROOT_DIR/.env"

info() { printf '[info] %s\n' "$1"; }
warn() { printf '[warn] %s\n' "$1"; }
fail() { printf '[erro] %s\n' "$1" >&2; exit 1; }

require_command() {
  if ! command -v "$1" >/dev/null 2>&1; then
    fail "Comando obrigatório não encontrado: $1"
  fi
}

require_env() {
  local name="$1"
  local value
  value="$(grep -E "^${name}=" "$ENV_FILE" | head -1 | cut -d'=' -f2- || true)"
  if [ -z "$value" ]; then
    fail "Variável obrigatória ausente em .env: $name"
  fi
}

env_value() {
  local name="$1"
  grep -E "^${name}=" "$ENV_FILE" | head -1 | cut -d'=' -f2- || true
}

check_env_warnings() {
  local flask_env cors api_url flask_secret jwt_secret pagarme_secret pagarme_public pagarme_dry_run

  flask_env="$(env_value FLASK_ENV)"
  cors="$(env_value CORS_ALLOWED_ORIGINS)"
  api_url="$(env_value NEXT_PUBLIC_API_BASE_URL)"
  flask_secret="$(env_value FLASK_SECRET_KEY)"
  jwt_secret="$(env_value JWT_SECRET)"
  pagarme_secret="$(env_value PAGARME_SECRET_KEY)"
  pagarme_public="$(env_value PAGARME_PUBLIC_KEY)"
  pagarme_dry_run="$(env_value PAGARME_DRY_RUN)"

  if [ "$flask_env" != "production" ]; then
    warn "FLASK_ENV está '$flask_env'. Para produção, o esperado é 'production'."
  fi

  if printf '%s' "$cors" | grep -q "localhost"; then
    warn "CORS_ALLOWED_ORIGINS ainda contém localhost. Revise antes do deploy final."
  fi

  if printf '%s' "$api_url" | grep -Eq '^(http://|https://localhost|http://localhost)'; then
    warn "NEXT_PUBLIC_API_BASE_URL parece apontar para ambiente local ou sem HTTPS."
  fi

  if [ "${#flask_secret}" -lt 32 ]; then
    warn "FLASK_SECRET_KEY tem menos de 32 caracteres."
  fi

  if [ "${#jwt_secret}" -lt 32 ]; then
    warn "JWT_SECRET tem menos de 32 caracteres."
  fi

  if [ "$flask_env" = "production" ]; then
    [ -n "$pagarme_secret" ] || fail "PAGARME_SECRET_KEY é obrigatória em produção."
    [ -n "$pagarme_public" ] || fail "PAGARME_PUBLIC_KEY é obrigatória em produção."
    if printf '%s' "$pagarme_dry_run" | grep -Eiq '^(1|true|yes|on)$'; then
      fail "PAGARME_DRY_RUN não pode ficar ativo em produção."
    fi
  fi
}

info "Validando ambiente de preflight..."
require_command node
require_command npm
require_command python3

[ -f "$ENV_FILE" ] || fail ".env não encontrado na raiz do projeto."

require_env FLASK_ENV
require_env FLASK_SECRET_KEY
require_env JWT_SECRET
require_env DATABASE_URL
require_env CORS_ALLOWED_ORIGINS
require_env NEXT_PUBLIC_API_BASE_URL
check_env_warnings

cd "$ROOT_DIR"

info "Rodando lint..."
npm run lint

info "Rodando testes do frontend..."
npm run test:frontend

info "Rodando testes do backend..."
npm run test:backend

info "Gerando build de produção..."
npm run build

info "Preflight concluído com sucesso. Projeto validado para deploy."
