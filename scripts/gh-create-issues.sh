#!/usr/bin/env bash
set -euo pipefail

# Create GitHub issues from .codex/tasks.yaml using yq + gh
# Requirements: gh (logged in), yq

ROOT_DIR=$(cd "$(dirname "$0")/.." && pwd)
TASKS_FILE="$ROOT_DIR/.codex/tasks.yaml"

if ! command -v gh >/dev/null; then
  echo "gh CLI is required. Install: https://cli.github.com/" >&2
  exit 1
fi

if ! command -v yq >/dev/null; then
  echo "yq is required. Install: https://mikefarah.github.io/yq/" >&2
  exit 1
fi

repo=$(gh repo view --json nameWithOwner -q .nameWithOwner)
echo "Target repo: $repo" >&2

count=$(yq '.tasks | length' "$TASKS_FILE")
for i in $(seq 0 $((count-1))); do
  key=$(yq -r ".tasks[$i].key" "$TASKS_FILE")
  title=$(yq -r ".tasks[$i].title" "$TASKS_FILE")
  area=$(yq -r ".tasks[$i].area" "$TASKS_FILE")
  size=$(yq -r ".tasks[$i].size" "$TASKS_FILE")
  priority=$(yq -r ".tasks[$i].priority" "$TASKS_FILE")
  goal=$(yq -r ".tasks[$i].goal" "$TASKS_FILE")
  acceptance=$(yq -r ".tasks[$i].acceptance | join('\n- ')" "$TASKS_FILE")
  deliverables=$(yq -r ".tasks[$i].deliverables | join('\n- ')" "$TASKS_FILE")

  body=$(cat <<EOF
目的:\n$goal\n\n成果物:\n- $deliverables\n\n受入基準:\n- $acceptance\n\n出典: docs/spec.md#L182 / .codex/tasks.yaml
EOF
)

  echo "Creating issue [$key] $title" >&2
  url=$(gh issue create \
    --title "[$key] $title" \
    --label "type:task" --label "area:$area" --label "size:$size" --label "priority:$priority" \
    --body "$body" | tail -n1)
  if [[ -n "$url" ]]; then
    yq -i ".tasks |= map(select(.key == \"$key\").issue = \"$url\" // .)" "$TASKS_FILE"
    echo "Linked $key issue -> $url" >&2
  fi
done

echo "Done. Consider creating a Tracking issue via template."
