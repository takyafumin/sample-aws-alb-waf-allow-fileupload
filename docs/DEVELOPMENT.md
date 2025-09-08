# Codex での開発の進め方（継続可能版）

このドキュメントは、Codex CLI を使って本リポジトリの開発を継続的に進めるための実践手順です。セッションが切れても再開しやすいよう、タスクの永続化と運用ルールをまとめています。

## 構成の考え方
- 仕様と受入基準: `docs/spec.md`
- タスクリスト（機械可読・永続）: `.codex/tasks.yaml`（status/依存/Issue/PR を保持）
- 運用ガイド: `docs/CONTRIBUTING.md`
- 進捗ログ（任意・軽量）: `docs/PROGRESS.md`
- GitHub Issues/PR: 実タスクの発行とレビュー

## 初回セットアップ
1) ラベル・テンプレ確認
- `.github/ISSUE_TEMPLATE/*`, `.github/pull_request_template.md` を利用

2) Issue の一括作成（任意）
- 事前に GitHub CLI と yq を導入
- `bash scripts/gh-create-issues.sh`

## 日々の進め方（1 セッションの流れ）
1) 着手タスクを選ぶ
- `.codex/tasks.yaml` の `status: pending` から選定（優先度/依存を考慮）
- （任意）`scripts/tasks-list.sh` で一覧表示

2) Codex に開始を宣言（例）
- 「タスク D に着手。受入基準は /upload=200, /profile=403」
- Codex は内部の plan（`update_plan`）を作成して進行を可視化

3) ブランチ運用
- `git switch -c feature/#<issue>-<slug>`（Issue 番号がある場合は含める）

4) 実装と検証
- 受入基準を満たすまで小さく進め、Draft PR を早めに作成
- PR 本文に `Closes #<n>` を記載（自動クローズ）

5) ステータス更新（永続化）
- 作業開始: `scripts/tasks-status.sh set <KEY> in_progress`
- 完了: `scripts/tasks-status.sh set <KEY> done`
- ブロック: `scripts/tasks-status.sh set <KEY> blocked`
- `.codex/tasks.yaml` に反映され、次セッションでも復元可能

6) 進捗ログ（任意）
- `docs/PROGRESS.md` に要点を 1〜2 行追加

## セッション再開（新しい Codex セッション）
- Codex への最初の依頼（例）
  - 「.codex/tasks.yaml を読み込み、`status != done` のタスクから計画を再構成。次は A から着手」
- ローカル確認
  - `scripts/tasks-list.sh` で未完タスクを確認
  - 直近の PR/Issue を `gh` で確認（`gh issue list`, `gh pr list`）

## タスク・Issue の同期（任意）
- `.codex/tasks.yaml` の `issue`/`pr` フィールドに番号または URL を記録
- 例: `scripts/tasks-status.sh link A issue 123`（後述のコマンドで対応）

## ステータスと依存の定義
- `status`: `pending | in_progress | blocked | done`
- `blocked_by`: 依存するタスクの `key` 配列（例: `D` は `[C]`）

## 補助スクリプト
- `scripts/tasks-status.sh`: タスクの status/リンクを更新・参照
- `scripts/tasks-list.sh`: タスク一覧を status/priority でフィルタ表示

## 運用の小さな約束
- 1 Issue = 1 ブランチ = 1 PR
- PR は小さく Draft で早出し、受入基準チェックを自分で通す
- セッション終わりに `status` と `docs/PROGRESS.md` を 1 分で更新

---

困ったら `docs/CONTRIBUTING.md` も参照してください。

## コマンド チートシート（例）
- 一覧表示: `scripts/tasks-list.sh`（全件）/ `scripts/tasks-list.sh pending P1`
- ステータス取得: `scripts/tasks-status.sh get A`
- ステータス変更: `scripts/tasks-status.sh set A in_progress`
- 完了にする: `scripts/tasks-status.sh set A done`
- Issue 紐付け: `scripts/tasks-status.sh link A issue 123`
