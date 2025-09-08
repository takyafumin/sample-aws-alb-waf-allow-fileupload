#!/usr/bin/env bash
set -euo pipefail

# Manage task statuses and links in .codex/tasks.yaml
# Usage:
#   scripts/tasks-status.sh list [status]
#   scripts/tasks-status.sh get <KEY>
#   scripts/tasks-status.sh set <KEY> <pending|in_progress|blocked|done>
#   scripts/tasks-status.sh link <KEY> issue <NUMBER|URL>
#   scripts/tasks-status.sh link <KEY> pr <NUMBER|URL>

ROOT_DIR=$(cd "$(dirname "$0")/.." && pwd)
TASKS_FILE="$ROOT_DIR/.codex/tasks.yaml"

if ! command -v yq >/dev/null; then
  echo "yq is required. Install: https://mikefarah.github.io/yq/" >&2
  exit 1
fi

cmd=${1:-}
case "$cmd" in
  list)
    filter=${2:-}
    if [ -z "$filter" ]; then
      yq -r '.tasks[] | "\(.key)\t\(.status)\t\(.priority)\t\(.title)"' "$TASKS_FILE" | column -t -s $'\t'
    else
      yq -r ".tasks[] | select(.status == \"$filter\") | \"\(.key)\t\(.status)\t\(.priority)\t\(.title)\"" "$TASKS_FILE" | column -t -s $'\t'
    fi
    ;;
  get)
    key=${2:?"KEY required"}
    yq -r ".tasks[] | select(.key == \"$key\") | .status" "$TASKS_FILE"
    ;;
  set)
    key=${2:?"KEY required"}
    status=${3:?"STATUS required"}
    case "$status" in
      pending|in_progress|blocked|done) ;;
      *) echo "Invalid status: $status" >&2; exit 1;;
    esac
    yq -i ".tasks |= map(select(.key == \"$key\").status = \"$status\" // .)" "$TASKS_FILE"
    echo "Updated $key -> $status"
    ;;
  link)
    key=${2:?"KEY required"}
    field=${3:?"issue|pr required"}
    value=${4:?"NUMBER or URL required"}
    case "$field" in
      issue|pr) ;;
      *) echo "Invalid field: $field (use issue|pr)" >&2; exit 1;;
    esac
    yq -i ".tasks |= map(select(.key == \"$key\").$field = \"$value\" // .)" "$TASKS_FILE"
    echo "Linked $key $field -> $value"
    ;;
  *)
    echo "Usage: $0 list [status] | get <KEY> | set <KEY> <pending|in_progress|blocked|done> | link <KEY> (issue|pr) <VALUE>" >&2
    exit 1
    ;;
esac

