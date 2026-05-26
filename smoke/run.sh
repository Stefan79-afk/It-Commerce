#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

USERS_URL="http://localhost:8000"
PRODUCTS_URL="http://localhost:8081"
ORDERS_URL="http://localhost:3001"

TS=$(date +%s)
EMAIL="smoke-${TS}@test.com"
PASSWORD="SmokeTest1!"

# ── helpers ────────────────────────────────────────────────────────────────

log()  { echo "[SMOKE] $*"; }
ok()   { echo "[OK]   $*" >&2; }
fail() { echo "[FAIL] $*" >&2; exit 1; }

# call <label> <expected_2xx> <curl-args...>
# Returns response body; exits 1 with details on unexpected status.
call() {
    local label="$1" ; shift
    local response http_code body

    response=$(curl -s -w $'\n%{http_code}' "$@")
    body=$(echo "$response" | head -n -1)
    http_code=$(echo "$response" | tail -n 1)

    if [[ "$http_code" -lt 200 || "$http_code" -ge 300 ]]; then
        echo "[FAIL] $label — HTTP $http_code" >&2
        echo "       Response: $body" >&2
        exit 1
    fi
    ok "$label (HTTP $http_code)"
    echo "$body"
}

# ── pre-flight ─────────────────────────────────────────────────────────────

for tool in curl; do
    command -v "$tool" > /dev/null || fail "$tool is required but not installed"
done

# jq is preferred; fall back to Python (python3 or python)
if command -v jq > /dev/null 2>&1; then
    jq_r() { jq -r "$1"; }
elif command -v python3 > /dev/null 2>&1; then
    jq_r() {
        local key="${1#'.'}"; key="${key%'?'}"
        python3 -c "import sys,json; d=json.load(sys.stdin); print(d.get('$key') or '')"
    }
elif command -v python > /dev/null 2>&1; then
    jq_r() {
        local key="${1#'.'}"; key="${key%'?'}"
        python -c "import sys,json; d=json.load(sys.stdin); print(d.get('$key') or '')"
    }
elif command -v node > /dev/null 2>&1; then
    jq_r() {
        local key="${1#'.'}"; key="${key%'?'}"
        node -e "const d=JSON.parse(require('fs').readFileSync('/dev/stdin','utf8')); process.stdout.write(String(d['$key']||''))"
    }
else
    fail "jq, python, or node is required for JSON parsing but none is installed"
fi

# ── wait for services ──────────────────────────────────────────────────────

bash "$SCRIPT_DIR/wait-for.sh" "users-service"    "$USERS_URL/api/v1/health"    120
bash "$SCRIPT_DIR/wait-for.sh" "products-service"  "$PRODUCTS_URL/api/v1/health" 180
bash "$SCRIPT_DIR/wait-for.sh" "orders-service"    "$ORDERS_URL/api/v1/health"   120

# ── 1. register ────────────────────────────────────────────────────────────

log "Registering $EMAIL ..."
call "Register user" \
    -X POST "$USERS_URL/api/v1/users/register" \
    -H "Content-Type: application/json" \
    -d "{\"email\":\"$EMAIL\",\"password\":\"$PASSWORD\",\"firstName\":\"Smoke\",\"lastName\":\"Test\"}" \
    > /dev/null

# ── 2. login ───────────────────────────────────────────────────────────────

log "Logging in ..."
LOGIN=$(call "Login" \
    -X POST "$USERS_URL/api/v1/users/login" \
    -H "Content-Type: application/json" \
    -d "{\"email\":\"$EMAIL\",\"password\":\"$PASSWORD\"}")

ACCESS_TOKEN=$(echo "$LOGIN" | jq_r '.accessToken')
[[ -n "$ACCESS_TOKEN" && "$ACCESS_TOKEN" != "null" ]] || fail "No accessToken in login response: $LOGIN"
log "Token acquired."

# ── 3. create product (protected) ─────────────────────────────────────────

log "Creating product ..."
PRODUCT=$(call "Create product" \
    -X POST "$PRODUCTS_URL/api/v1/products" \
    -H "Content-Type: application/json" \
    -H "Authorization: Bearer $ACCESS_TOKEN" \
    -d '{"name":"Smoke Test GPU","description":"Smoke test product","category":"Electronics","price":499.99,"stockQuantity":10}')

PRODUCT_ID=$(echo "$PRODUCT" | jq_r '.id')
[[ -n "$PRODUCT_ID" && "$PRODUCT_ID" != "null" ]] || fail "No product id in response: $PRODUCT"
log "Product ID: $PRODUCT_ID"

# ── 4. create order (with snapshot fields) ────────────────────────────────

log "Creating order ..."
ORDER=$(call "Create order" \
    -X POST "$ORDERS_URL/api/v1/orders" \
    -H "Content-Type: application/json" \
    -H "Authorization: Bearer $ACCESS_TOKEN" \
    -d "{
      \"shippingAddressId\": \"00000000-0000-0000-0000-000000000001\",
      \"shippingAddressSnapshot\": {
        \"street\": \"123 Smoke Test Ave\",
        \"city\": \"Test City\",
        \"country\": \"Testland\",
        \"postalCode\": \"12345\"
      },
      \"items\": [{
        \"productId\": \"$PRODUCT_ID\",
        \"productName\": \"Smoke Test GPU\",
        \"priceAtPurchase\": 499.99,
        \"quantity\": 1
      }]
    }")

ORDER_ID=$(echo "$ORDER" | jq_r '.id')
[[ -n "$ORDER_ID" && "$ORDER_ID" != "null" ]] || fail "No order id in response: $ORDER"
log "Order ID: $ORDER_ID"

# ── 5. list orders ─────────────────────────────────────────────────────────

log "Listing orders ..."
LIST=$(call "List orders" \
    "$ORDERS_URL/api/v1/orders" \
    -H "Authorization: Bearer $ACCESS_TOKEN")

TOTAL=$(echo "$LIST" | jq_r '.totalElements')
[[ "$TOTAL" -ge 1 ]] || fail "Expected totalElements >= 1, got: $TOTAL"
log "totalElements = $TOTAL"

# ── done ───────────────────────────────────────────────────────────────────

echo ""
echo "[SMOKE] === ALL TESTS PASSED ==="
