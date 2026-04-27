#!/usr/bin/env bash
# 01-init-university-did.sh
# Creates a PRISM DID for the university issuer, publishes it, then writes
# the short-form DID to the root .env file.
# Usage: bash scripts/01-init-university-did.sh

set -euo pipefail

ISSUER_AGENT="${ISSUER_AGENT_URL:-http://localhost:8000}"
ENV_FILE="$(dirname "$0")/../.env"
POLL_SECONDS=5
MAX_ATTEMPTS=30

echo "=== Step 1: Create university DID ==="

CREATE_RESPONSE=$(curl -s -X POST \
  "${ISSUER_AGENT}/did-registrar/dids" \
  -H "Content-Type: application/json" \
  -d '{
    "documentTemplate": {
      "publicKeys": [
        { "id": "auth-1",   "purpose": "authentication" },
        { "id": "assert-1", "purpose": "assertionMethod" }
      ],
      "services": []
    }
  }')

echo "Create response: $CREATE_RESPONSE"

LONG_FORM_DID=$(echo "$CREATE_RESPONSE" | grep -o '"longFormDid":"[^"]*"' | sed 's/"longFormDid":"//;s/"//')

if [ -z "$LONG_FORM_DID" ]; then
  echo "❌ Failed to extract longFormDid from response."
  exit 1
fi

echo "Long-form DID: $LONG_FORM_DID"

echo ""
echo "=== Step 2: Publish DID to ledger ==="

PUBLISH_RESPONSE=$(curl -s -X POST \
  "${ISSUER_AGENT}/did-registrar/dids/${LONG_FORM_DID}/publications" \
  -H "Content-Type: application/json")

echo "Publish response: $PUBLISH_RESPONSE"

echo ""
echo "=== Step 3: Poll until DID is PUBLISHED ==="

SHORT_FORM_DID=""
for i in $(seq 1 $MAX_ATTEMPTS); do
  STATUS_RESPONSE=$(curl -s "${ISSUER_AGENT}/did-registrar/dids/${LONG_FORM_DID}")
  STATUS=$(echo "$STATUS_RESPONSE" | grep -o '"status":"[^"]*"' | head -1 | sed 's/"status":"//;s/"//')
  echo "  Attempt $i/$MAX_ATTEMPTS: status = $STATUS"

  if [ "$STATUS" = "PUBLISHED" ]; then
    SHORT_FORM_DID=$(echo "$STATUS_RESPONSE" | grep -o '"did":"[^"]*"' | head -1 | sed 's/"did":"//;s/"//')
    break
  fi

  sleep $POLL_SECONDS
done

if [ -z "$SHORT_FORM_DID" ]; then
  echo "❌ DID was not published after $MAX_ATTEMPTS attempts."
  echo "   In dev mode (in-memory ledger), publication should be near-instant."
  echo "   Check the cloud-agent logs: docker compose -f infrastructure/docker-compose.dev.yml logs issuer-agent"
  exit 1
fi

echo ""
echo "✅ DID published: $SHORT_FORM_DID"

echo ""
echo "=== Step 4: Write DID to .env ==="

if grep -q "^VITE_UNIVERSITY_DID=" "$ENV_FILE" 2>/dev/null; then
  # Update existing line
  if [[ "$OSTYPE" == "darwin"* ]]; then
    sed -i '' "s|^VITE_UNIVERSITY_DID=.*|VITE_UNIVERSITY_DID=${SHORT_FORM_DID}|" "$ENV_FILE"
  else
    sed -i "s|^VITE_UNIVERSITY_DID=.*|VITE_UNIVERSITY_DID=${SHORT_FORM_DID}|" "$ENV_FILE"
  fi
else
  echo "VITE_UNIVERSITY_DID=${SHORT_FORM_DID}" >> "$ENV_FILE"
fi

echo "VITE_UNIVERSITY_DID written to $ENV_FILE"
echo ""
echo "Next: bash scripts/02-register-diploma-schema.sh"
