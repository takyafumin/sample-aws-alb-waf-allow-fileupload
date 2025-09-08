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

## 使い方（ローカル/コンテナ）

このリポジトリには、ALB/WAF の挙動を検証するための最小アプリ（Express+TypeScript）が含まれます。まずはローカルまたは Docker で起動し、`/upload` が 200 を返すことを確認できます。

### ローカル実行（Node.js）
- 必要: Node.js 18+、npm
- 手順:
  1) `cd app`
  2) 依存を導入: `npm install`
  3) 開発起動: `npm run dev`
  4) 別ターミナルで動作確認:
     - `curl http://localhost:3000/health`
     - `curl -F file=@../README.md http://localhost:3000/upload`
- 補足: 本番相当のビルド/実行は `npm run build && npm start`

### コンテナ実行（Docker）
- 必要: Docker 24+
- 手順:
  - ビルド: `docker build -t sample-alb-waf-app ./app`
  - 実行: `docker run --rm -p 3000:3000 -e APP_MAX_FILE_SIZE_MB=50 sample-alb-waf-app`
  - 確認: `curl -F file=@README.md http://localhost:3000/upload`

### API エンドポイント
- `GET /health`: 健康チェック（200）
- `GET /`: テキスト JSON の案内（後続タスクで HTML を提供）
- `POST /upload`: `multipart/form-data`（フィールド名 `file`）を受理し JSON 返却
- `POST /profile`: ローカルでは同様に 200。WAF 配下では Block 予定（403）

### 環境変数（app）
- `APP_MAX_FILE_SIZE_MB`: 受入上限（MB）。既定 `50`
- `PORT`: リッスンポート。既定 `3000`
- `HOST`: バインドアドレス。既定 `0.0.0.0`

### よくある質問・注意点
- 大きなファイルで 413 になる: `APP_MAX_FILE_SIZE_MB` を引き上げて再起動してください。
- `POST /profile` がローカルで 200 になる: 仕様通りです。WAF 配下で Block（403）させます。
- 静的 HTML での送信フォームは後続タスク（B）で追加します。

関連ファイル:
- アプリ本体: `app/src/server.ts:1`
- Dockerfile: `app/Dockerfile:1`
- 仕様書: `docs/spec.md:1`
