#!/usr/bin/env bash

set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
DEPS_DIR="$ROOT_DIR/.cache/backend-test-deps"
STAMP_FILE="$ROOT_DIR/.cache/backend-test-deps.sha256"
REQ_FILE="$ROOT_DIR/backend/requirements.txt"

if ! command -v python3 >/dev/null 2>&1; then
  echo "[erro] python3 não encontrado no ambiente." >&2
  exit 1
fi

if [ ! -f "$REQ_FILE" ]; then
  echo "[erro] arquivo $REQ_FILE não encontrado." >&2
  exit 1
fi

mkdir -p "$ROOT_DIR/.cache"
REQ_HASH="$(sha256sum "$REQ_FILE" | cut -d' ' -f1)"
INSTALLED_HASH="$(cat "$STAMP_FILE" 2>/dev/null || true)"

if [ ! -d "$DEPS_DIR" ] || [ "$REQ_HASH" != "$INSTALLED_HASH" ]; then
  echo "[info] Instalando dependências locais do backend para testes..."
  rm -rf "$DEPS_DIR"
  mkdir -p "$DEPS_DIR"
  python3 -m pip install \
    --disable-pip-version-check \
    --quiet \
    --target "$DEPS_DIR" \
    -r "$REQ_FILE"
  printf '%s' "$REQ_HASH" > "$STAMP_FILE"
fi

echo "[info] Executando testes do backend..."
cd "$ROOT_DIR"
PYTHONPATH="$DEPS_DIR" python3 -m unittest discover -s backend/tests -v
