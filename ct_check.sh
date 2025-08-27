#!/usr/bin/env bash
set -euo pipefail

# === commercetools creds (yours) ===
CTP_PROJECT_KEY="hcltech-b2c"
CTP_CLIENT_ID="Uf0oSRSedp00L_-9NDcAvnfa"
CTP_CLIENT_SECRET="y-IGwNXl-249pa40DF6MEOruBLkNOk7a"
CTP_SCOPE="manage_project:hcltech-b2c"
CTP_REGION="us-central1.gcp"

AUTH_URL="https://auth.$CTP_REGION.commercetools.com"
API_URL="https://api.$CTP_REGION.commercetools.com"

# jq is used to pretty-print JSON
if ! command -v jq >/dev/null 2>&1; then
  echo "jq not found. Install it with: brew install jq"
  exit 1
fi

echo "🔐 Getting OAuth token..."
BASIC=$(printf "%s:%s" "$CTP_CLIENT_ID" "$CTP_CLIENT_SECRET" | base64)
TOKEN=$(curl -sS -X POST "$AUTH_URL/oauth/token" \
  -H "Authorization: Basic $BASIC" \
  -H "Content-Type: application/x-www-form-urlencoded" \
  --data "grant_type=client_credentials&scope=$CTP_SCOPE" | jq -r .access_token)

if [[ -z "${TOKEN}" || "${TOKEN}" == "null" ]]; then
  echo "❌ Failed to obtain token. Check CTP_* values and scope."; exit 1
fi
echo "✅ Auth OK"

echo "🔎 Product types (up to 5):"
curl -sS "$API_URL/$CTP_PROJECT_KEY/product-types?limit=5" \
  -H "Authorization: Bearer $TOKEN" | jq '{count, names: [.results[].name]}'

echo "🔎 Products (up to 5):"
curl -sS "$API_URL/$CTP_PROJECT_KEY/products?limit=5" \
  -H "Authorization: Bearer $TOKEN" | jq '{count, keys: [.results[].key]}'
