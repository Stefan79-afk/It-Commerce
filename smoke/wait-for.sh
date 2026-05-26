#!/usr/bin/env bash
# Usage: wait-for.sh <label> <url> [timeout_seconds]
# Polls <url> every 2s until HTTP 2xx is returned, then exits 0.
# Exits 1 if <timeout_seconds> (default: 120) is reached.

set -euo pipefail

LABEL="${1:?Usage: wait-for.sh <label> <url> [timeout]}"
URL="${2:?Usage: wait-for.sh <label> <url> [timeout]}"
TIMEOUT="${3:-120}"

printf "[SMOKE] Waiting for %s " "$LABEL"
elapsed=0
while true; do
    if curl -sf --max-time 3 "$URL" > /dev/null 2>&1; then
        echo " OK"
        exit 0
    fi
    printf "."
    sleep 2
    elapsed=$((elapsed + 2))
    if [[ $elapsed -ge $TIMEOUT ]]; then
        echo ""
        echo "[FAIL] Timed out after ${TIMEOUT}s waiting for $LABEL ($URL)" >&2
        exit 1
    fi
done
