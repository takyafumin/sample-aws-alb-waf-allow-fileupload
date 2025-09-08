name: Tracking
description: Cross-task tracking issue with checklist
title: "[Tracking] MVP 進捗"
labels: ["type:tracking", "priority:P1"]
body:
  - type: textarea
    id: scope
    attributes:
      label: スコープ
      value: |
        docs/spec.md に定義された MVP を対象。
  - type: checkboxes
    id: tasks
    attributes:
      label: タスク一覧 (リンクして更新)
      options:
        - label: A. アプリ雛形（Express + TS）
        - label: B. テスト HTML とスクリプト
        - label: C. CDK: VPC/ECS/ALB 基盤
        - label: D. CDK: WAF Web ACL + ルール + ログ
        - label: E. パラメータ/設定値の外部化
        - label: F. ドキュメント整備
        - label: G. 開発規約セットアップ（TS/JSDoc/Lint/Format）

