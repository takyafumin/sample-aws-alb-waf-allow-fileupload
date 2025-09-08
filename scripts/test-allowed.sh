#!/usr/bin/env bash
set -euo pipefail

# Test script: verify that POST /upload returns 200 with a file.
# Usage:
#   URL=http://localhost:3000 FILE=../README.md ./scripts/test-allowed.sh
# Env:
#   URL       Base URL (default: http://localhost:3000)
#   FILE      File to upload (default: ../README.md)
#   EXPECTED  Expected HTTP status (default: 200)

URL=${URL:-http://localhost:3000}
FILE=${FILE:-../README.md}
EXPECTED=${EXPECTED:-200}
ENDPOINT=${ENDPOINT:-/upload}

if [ ! -f "$FILE" ]; then
  echo "[test-allowed] File not found: $FILE" >&2
  exit 2
fi

echo "[test-allowed] POST $ENDPOINT -> $URL (file=$FILE)"
HTTP_CODE=$(curl -sS -o /dev/null -w "%{http_code}" -F "file=@${FILE}" "${URL}${ENDPOINT}")
echo "[test-allowed] HTTP $HTTP_CODE (expected $EXPECTED)"

if [ "$HTTP_CODE" != "$EXPECTED" ]; then
  echo "[test-allowed] Unexpected status. Use: URL=... FILE=... EXPECTED=$EXPECTED $0" >&2
  exit 1
fi

echo "[test-allowed] OK"

