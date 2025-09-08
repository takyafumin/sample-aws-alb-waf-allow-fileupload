name: Task
description: Use for feature/chore tasks
title: "[Task] "
labels: ["type:task"]
body:
  - type: textarea
    id: goal
    attributes:
      label: 目的 (Goal)
      placeholder: この Issue で何を達成するか
    validations:
      required: true
  - type: textarea
    id: deliverables
    attributes:
      label: 成果物 (Deliverables)
      placeholder: 例) app/src/**, cdk/lib/waf.ts, README.md など
    validations:
      required: true
  - type: textarea
    id: acceptance
    attributes:
      label: 受入基準 (Acceptance Criteria)
      placeholder: 具体的に合否を判断できる条件
    validations:
      required: true
  - type: textarea
    id: deps
    attributes:
      label: 依存関係 (Dependencies)
      placeholder: 例) C 完了後に D を着手 など
    validations:
      required: false

