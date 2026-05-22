#!/usr/bin/env bash
# Run Playwright E2E tests against the ItCommerce docker-compose stack.
#
# Usage:
#   ./e2e/run.sh               — start docker compose, wait, then run tests
#   ./e2e/run.sh --no-compose  — skip docker compose (stack already running)
#   ./e2e/run.sh --headed      — pass any extra playwright flags (e.g. --headed)
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ROOT_DIR="$(dirname "$SCRIPT_DIR")"

NO_COMPOSE=false
PW_ARGS=()
for arg in "$@"; do
  if [[ "$arg" == "--no-compose" ]]; then
    NO_COMPOSE=true
  else
    PW_ARGS+=("$arg")
  fi
done

# ── helpers ────────────────────────────────────────────────────────────────

wait_http() {
  local label="$1" url="$2" retries="${3:-60}" interval="${4:-3}"
  echo -n "[e2e] Waiting for $label "
  for i in $(seq 1 "$retries"); do
    if curl -sf "$url" >/dev/null 2>&1; then
      echo " ready"
      return 0
    fi
    echo -n "."
    sleep "$interval"
  done
  echo " TIMEOUT" >&2
  exit 1
}

# ── start stack ────────────────────────────────────────────────────────────

if ! $NO_COMPOSE; then
  cd "$ROOT_DIR"
  echo "[e2e] Starting docker compose..."
  docker compose up -d

  wait_http "nginx"    "http://localhost/health"                      60 3
  wait_http "frontend" "http://localhost/"                            60 3
  wait_http "users"    "http://localhost/api/users/api/v1/health"     60 3
  wait_http "products" "http://localhost/api/products/api/v1/health"  60 3
  wait_http "orders"   "http://localhost/api/orders/api/v1/health"    60 3
fi

# ── install & run ──────────────────────────────────────────────────────────

cd "$SCRIPT_DIR"
echo "[e2e] Installing dependencies..."
npm install --silent
npx playwright install --with-deps chromium

echo "[e2e] Running Playwright tests..."
npx playwright test "${PW_ARGS[@]+"${PW_ARGS[@]}"}"
