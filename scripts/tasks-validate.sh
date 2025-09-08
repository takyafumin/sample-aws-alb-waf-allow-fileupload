#!/usr/bin/env bash
set -euo pipefail

# Validate that blocked_by dependencies are met for in_progress/done tasks.

ROOT_DIR=$(cd "$(dirname "$0")/.." && pwd)
TASKS_FILE="$ROOT_DIR/.codex/tasks.yaml"

if ! command -v yq >/dev/null; then
  echo "yq is required. Install: https://mikefarah.github.io/yq/" >&2
  exit 1
fi

errors=0

keys=$(yq -r '.tasks[].key' "$TASKS_FILE")
for key in $keys; do
  status=$(yq -r ".tasks[] | select(.key == \"$key\").status" "$TASKS_FILE")
  # Only validate when status is in_progress or done
  if [[ "$status" != "in_progress" && "$status" != "done" ]]; then
    continue
  fi
  deps=$(yq -r ".tasks[] | select(.key == \"$key\").blocked_by[]?" "$TASKS_FILE" || true)
  for dep in $deps; do
    dep_status=$(yq -r ".tasks[] | select(.key == \"$dep\").status" "$TASKS_FILE")
    if [[ "$dep_status" != "done" ]]; then
      echo "Violation: $key ($status) depends on $dep ($dep_status)" >&2
      errors=$((errors+1))
    fi
  done
done

if [[ $errors -gt 0 ]]; then
  echo "Found $errors dependency violation(s)." >&2
  exit 2
fi

echo "All dependencies are satisfied."

