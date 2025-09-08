# sample-aws-alb-waf-allow-fileupload
AWS WAF でのファイルアップロードサイズ上限をパスベースで許可するサンプル

- 仕様・設計の詳細は `docs/spec.md` を参照してください。
  - 並行タスク分解、受入基準、検証シナリオを記載しています。
  - アーキテクチャ図（Mermaid）は `docs/architecture/diagram.md` で直接表示できます。

## 開発の進め方（Codex 併用）
- 開発の手引き: `docs/DEVELOPMENT.md`
- 運用ガイド: `docs/CONTRIBUTING.md`
- タスク定義（永続）: `.codex/tasks.yaml`
- Issue/PR テンプレ: `.github/ISSUE_TEMPLATE/*`, `.github/pull_request_template.md`

新しいセッションでの再開手順や、タスクのステータス永続化（pending/in_progress/blocked/done）は `docs/DEVELOPMENT.md` を参照してください。
