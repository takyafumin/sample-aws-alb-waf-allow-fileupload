#!/usr/bin/env bash
set -euo pipefail

# Test script: verify POST /profile behavior.
# Locally, the app responds 200. Behind WAF it is expected to be blocked (403).
# Usage:
#   URL=http://localhost:3000 FILE=../README.md ./scripts/test-blocked.sh
#   # When testing behind WAF: EXPECTED=403 URL=https://<alb-domain> ./scripts/test-blocked.sh
# Env:
#   URL       Base URL (default: http://localhost:3000)
#   FILE      File to upload (default: ../README.md)
#   EXPECTED  Expected HTTP status (default: 200 for local, set 403 for WAF)

URL=${URL:-http://localhost:3000}
FILE=${FILE:-../README.md}
EXPECTED=${EXPECTED:-200}
ENDPOINT=${ENDPOINT:-/profile}

if [ ! -f "$FILE" ]; then
  echo "[test-blocked] File not found: $FILE" >&2
  exit 2
fi

echo "[test-blocked] POST $ENDPOINT -> $URL (file=$FILE)"
HTTP_CODE=$(curl -sS -o /dev/null -w "%{http_code}" -F "file=@${FILE}" "${URL}${ENDPOINT}")
echo "[test-blocked] HTTP $HTTP_CODE (expected $EXPECTED)"

if [ "$HTTP_CODE" != "$EXPECTED" ]; then
  echo "[test-blocked] Unexpected status. For WAF test, set EXPECTED=403. Example:" >&2
  echo "  EXPECTED=403 URL=https://<alb-domain> $0" >&2
  exit 1
fi

echo "[test-blocked] OK"

