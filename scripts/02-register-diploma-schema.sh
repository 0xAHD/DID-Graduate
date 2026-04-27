#!/usr/bin/env bash
# 02-register-diploma-schema.sh
# Reads VITE_UNIVERSITY_DID from .env, registers the diploma JSON Schema
# with the issuer Cloud Agent, then writes the schema GUID to .env.
# Usage: bash scripts/02-register-diploma-schema.sh

set -euo pipefail

ISSUER_AGENT="${ISSUER_AGENT_URL:-http://localhost:8000}"
SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
ENV_FILE="${SCRIPT_DIR}/../.env"
SCHEMA_FILE="${SCRIPT_DIR}/../packages/common/src/schema/diploma.schema.json"

echo "=== Read university DID from .env ==="

if [ ! -f "$ENV_FILE" ]; then
  echo "❌ .env file not found at $ENV_FILE"
  echo "   Run scripts/01-init-university-did.sh first."
  exit 1
fi

VITE_UNIVERSITY_DID=$(grep '^VITE_UNIVERSITY_DID=' "$ENV_FILE" | cut -d'=' -f2- | tr -d '"')

if [ -z "${VITE_UNIVERSITY_DID:-}" ]; then
  echo "❌ VITE_UNIVERSITY_DID is not set in .env"
  echo "   Run scripts/01-init-university-did.sh first."
  exit 1
fi

echo "University DID: $VITE_UNIVERSITY_DID"

echo ""
echo "=== Register diploma schema with issuer agent ==="

SCHEMA_CONTENT=$(cat "$SCHEMA_FILE")

REGISTER_RESPONSE=$(curl -s -X POST \
  "${ISSUER_AGENT}/schema-registry/schemas" \
  -H "Content-Type: application/json" \
  -d "{
    \"name\": \"DiplomaCredential\",
    \"version\": \"1.0.0\",
    \"description\": \"W3C VC schema for university diploma issuance\",
    \"type\": \"https://w3c-ccg.github.io/vc-json-schemas/schema/2.0/schema.json\",
    \"author\": \"${VITE_UNIVERSITY_DID}\",
    \"tags\": [\"diploma\", \"education\"],
    \"schema\": ${SCHEMA_CONTENT}
  }")

echo "Register response: $REGISTER_RESPONSE"

SCHEMA_GUID=$(echo "$REGISTER_RESPONSE" | grep -o '"guid":"[^"]*"' | head -1 | sed 's/"guid":"//;s/"//')

if [ -z "$SCHEMA_GUID" ]; then
  echo "❌ Failed to extract schema guid from response."
  echo "   The schema may already be registered, or the agent returned an error."
  exit 1
fi

echo ""
echo "✅ Schema registered: $SCHEMA_GUID"

echo ""
echo "=== Write schema GUID to .env ==="

if grep -q "^VITE_DIPLOMA_SCHEMA_ID=" "$ENV_FILE" 2>/dev/null; then
  if [[ "$OSTYPE" == "darwin"* ]]; then
    sed -i '' "s|^VITE_DIPLOMA_SCHEMA_ID=.*|VITE_DIPLOMA_SCHEMA_ID=${SCHEMA_GUID}|" "$ENV_FILE"
  else
    sed -i "s|^VITE_DIPLOMA_SCHEMA_ID=.*|VITE_DIPLOMA_SCHEMA_ID=${SCHEMA_GUID}|" "$ENV_FILE"
  fi
else
  echo "VITE_DIPLOMA_SCHEMA_ID=${SCHEMA_GUID}" >> "$ENV_FILE"
fi

echo "VITE_DIPLOMA_SCHEMA_ID written to $ENV_FILE"
echo ""
echo "✅ Setup complete! You can now start the apps:"
echo "   pnpm run dev"
