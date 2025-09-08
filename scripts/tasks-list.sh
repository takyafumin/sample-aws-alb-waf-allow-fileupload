#!/usr/bin/env bash
set -euo pipefail

# List tasks with optional filters: status and/or priority
# Usage:
#   scripts/tasks-list.sh [status] [priority]

ROOT_DIR=$(cd "$(dirname "$0")/.." && pwd)
TASKS_FILE="$ROOT_DIR/.codex/tasks.yaml"

if ! command -v yq >/dev/null; then
  echo "yq is required. Install: https://mikefarah.github.io/yq/" >&2
  exit 1
fi

status=${1:-}
priority=${2:-}

expr='.tasks[]'
if [ -n "$status" ]; then
  expr="$expr | select(.status == \"$status\")"
fi
if [ -n "$priority" ]; then
  expr="$expr | select(.priority == \"$priority\")"
fi

yq -r "$expr | \"\(.key)\t\(.status)\t\(.priority)\t\(.area)\t\(.title)\"" "$TASKS_FILE" | column -t -s $'\t'

