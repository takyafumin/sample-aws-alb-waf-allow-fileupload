# 開発ガイド（Issues/PR/Codex CLI）

このプロジェクトでは、docs/spec.md の「12. 並行タスク分解」をベースに
Issue/PR を運用し、Codex CLI の計画機能で日々の作業を可視化します。

## 1) Issue/PR 運用
- 1 Issue = 1 ブランチ = 1 PR を原則とする。
- ブランチ名: `feature/#<issue>-<slug>`（例: `feature/#123-app-scaffold`）。
- PR 本文に `Closes #<n>` を記載し、自動クローズを有効化。
- PR テンプレート: `.github/pull_request_template.md` を利用。
- タスク作成時は `.github/ISSUE_TEMPLATE/task.md` を利用。

### ラベル例
- `type:task`, `type:tracking`
- `priority:P1/P2/P3`
- `area:app`, `area:cdk`, `area:waf`, `docs`
- `size:S/M/L`

## 2) タスクの出典（Single Source of Truth）
- 概要: `docs/spec.md`
- 詳細なタスクリスト（機械可読・永続）: `.codex/tasks.yaml`（status/依存/Issue/PR を保持）
- 追跡 Issue: `.github/ISSUE_TEMPLATE/tracking.md` を使い、A〜G をチェックリスト化
 - 進捗メモ（任意）: `docs/PROGRESS.md`

## 3) Codex CLI の使い方（タスク進行）
Codex CLI セッションでは、以下の運用を推奨します。

1. セッション開始時に、取り組むタスクのサマリを `update_plan` へ登録。
2. 実装/編集前に「次に何をするか」を 1 文で宣言（短いプレアンブル）。
3. 実装後または節目で `update_plan` を更新（完了/着手を反映）。
4. まとまった変更は PR として起こし、受入基準に沿って自己検証。

より詳細な手順は `docs/DEVELOPMENT.md` を参照してください（セッション再開手順、ステータス更新、補助スクリプトなど）。

### 例: Codex への依頼テンプレ
```
対象: タスク D（WAF）
やること: BlockMultipartOutsideAllowedPaths と scope-down の実装
受入基準: /upload=200, /profile=403
希望: cdk/lib/waf.ts を追加し、最小で deploy 可能な形に
```

## 4) Issues を一括作成したい場合（任意）
`scripts/gh-create-issues.sh` を用意しています。GitHub CLI にログイン済みであれば、
`.codex/tasks.yaml` を読み取り、A〜G を Issue 化します（Draft 推奨）。

> 注意: リポジトリ権限・ネットワークが必要。CI では実行しないでください。
