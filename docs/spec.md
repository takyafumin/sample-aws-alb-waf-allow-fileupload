# 仕様書: ALB + AWS WAF でパス別にファイルアップロード許可

本ドキュメントは、ALB 配下のアプリケーションで「特定パスのみ大きなファイルの multipart/form-data を許可」する検証用サンプルの仕様を定義します。AWS リソースは AWS CDK v2（TypeScript）で一元管理し、アプリケーションは Node.js + TypeScript（Express）で実装します。チームで並行開発ができるよう、作業分割と受け入れ基準（Acceptance Criteria）も明記します。

---

## 1. 目的と背景
- 特定の API パス（例 `/upload`）に限り、大きなファイルアップロード（multipart/form-data）を許容する。
- WAF のリクエストボディ検査は 8KB を超えると完全には検査できず誤検知する可能性があるため、許可パスではマネージドルール検査をスコープダウン（実質除外）し、過検知を回避する。
- 許可されていないパスでの multipart/form-data は明確に Block する。

## 2. スコープ
- In scope
  - ALB + AWS WAFv2(REGIONAL) + ECS Fargate + Node.js(Express)
  - CDK(TypeScript) による IaC 一元管理
  - 許可パス/不許可パスの検証が可能な最小アプリ・テストスクリプト
  - WAF ログ出力（CloudWatch Logs）
- Out of scope（将来拡張の余地）
  - S3 直アップロード（プリサインド URL）
  - ウイルススキャン（ClamAV など）
  - 認証/認可（Cognito/OIDC など）

## 3. 要件
- 機能要件
  - `POST /upload`: multipart/form-data（フィールド名 `file`）を受け付け、メタ情報を JSON で返す。
  - `POST /profile`: 同様の multipart/form-data だが WAF により Block されること。
  - `GET /`: `/upload` と `/profile` へ投稿できるテスト HTML を提供。
  - `GET /health`: 200（ALB ヘルスチェック用）。
- 非機能要件
  - IaC は AWS CDK v2（TypeScript）。
  - Node.js 18 以降、TypeScript、Express、multer。
  - 受入サイズ上限は既定 50MB（環境変数で変更可能）。
  - WAF ログは CloudWatch Logs へ出力。
  - コスト最小化のため最小構成（Fargate 1〜2 タスク）。

## 4. アーキテクチャ概要
- 図: `docs/architecture/diagram.md`（Mermaid）。GitHub の Markdown で直接プレビュー可能。
  - 構成: Client → WAF(Web ACL) → ALB → Target Group → ECS(Fargate)
  - WAF ログ: CloudWatch Logs へ送出
  - 任意: ACM 証明書で 443 を有効化
- VPC: 2AZ（ALB はパブリック、ECS タスクはプライベート）
- ALB: リスナー 80/443（443 は任意の ACM 証明書 ARN で有効化）
- WAFv2: Web ACL を ALB にアタッチ
- 実装詳細: `docs/waf-web-acl.md`（ルール、スコープダウン、ログ要件）
- ECS Fargate: コンテナで Express アプリを提供

## 5. WAF ポリシー設計
- デフォルト: Allow
- マネージドルール（推奨）
  - `AWSManagedRulesCommonRuleSet`
  - `AWSManagedRulesKnownBadInputsRuleSet`
  - `AWSManagedRulesAmazonIpReputationList`
  - （任意）`AWSManagedRulesAdminProtectionRuleSet`
- カスタムルール
  1) BlockMultipartOutsideAllowedPaths（優先度: 最上位）
     - 条件: `content-type` ヘッダに `multipart/form-data` を含む AND `uriPath` が許可パスでない
     - 実装: `And(ByteMatch: SingleHeader=content-type CONTAINS 'multipart/form-data' + Not(Or(ByteMatch: UriPath STARTS_WITH each allowedPath)))`
     - アクション: Block
  2) ManagedRulesWithScopeDown（各マネージドルールに適用）
     - ScopeDown: `NOT ( Method in [POST,PUT] AND content-type CONTAINS 'multipart/form-data' AND UriPath startsWith any allowedPath )`
     - 効果: 許可パスの multipart はマネージドルール検査対象から除外（過検知回避）。
- 実装上の注意
  - `TextTransformations: LOWERCASE` を `content-type` 判定に付与し大小文字や微妙な差異に耐性。
  - 本設計はボディに直接触るステートメントを使わないため `OversizeHandling` の影響を受けにくい。
  - 必要に応じて `RateBasedStatement` によるレート制限を追加可。

### 5.1 WAF 例（ステートメント JSON スニペット・概念）
```jsonc
{
  "Name": "BlockMultipartOutsideAllowedPaths",
  "Priority": 0,
  "Action": { "Block": {} },
  "Statement": {
    "AndStatement": {
      "Statements": [
        { "ByteMatchStatement": {
            "SearchString": "multipart/form-data",
            "FieldToMatch": { "SingleHeader": { "Name": "content-type" }},
            "TextTransformations": [{ "Priority": 0, "Type": "LOWERCASE" }],
            "PositionalConstraint": "CONTAINS"
        }},
        { "NotStatement": {
            "Statement": {
              "OrStatement": {
                "Statements": [
                  // 繰り返し: 許可パスごとに 1 エントリ
                  { "ByteMatchStatement": {
                      "SearchString": "/upload",
                      "FieldToMatch": { "UriPath": {} },
                      "TextTransformations": [{ "Priority": 0, "Type": "NONE" }],
                      "PositionalConstraint": "STARTS_WITH"
                  }}
                ]
              }
            }
        }}
      ]
    }
  }
}
```

## 6. アプリケーション設計（Node.js + TypeScript）
- 主要エンドポイント
  - `POST /upload`: `multer` の memoryStorage で受け取り、ファイル名・サイズ・MIME を JSON で返却。
  - `POST /profile`: 実装は同等だが、WAF ブロックによりアプリは基本到達しない前提。
  - `GET /`: 2 つのフォーム（/upload, /profile）を提供する検証用 HTML。
  - `GET /health`: 200。
- 設定
  - 上限サイズ: 既定 50MB（`APP_MAX_FILE_SIZE_MB` で変更）。
  - 受入 MIME: `image/*`, `application/pdf`（簡易チェック例、プロダクションでは厳格化推奨）。
  - 返却: JSON（ファイル名、size、mimetype、timestamp）。
- 注意
  - memoryStorage は大きなファイルでメモリ消費が増える。検証用途で採用。実運用では一時ディスク or ストリーム化推奨。

### 6.1 言語/スタイル方針（TypeScript + JSDoc）
- 言語: TypeScript（Node.js 18+）。`tsconfig.json` は `strict: true`、`noUncheckedIndexedAccess: true` を有効化。
- JSDoc: 公開 API（エクスポート関数/クラス、Express ルートハンドラ）に JSDoc を付与。
  - 形式: `/** ... */` で `@param`/`@returns`/`@throws` を記載。
  - 目的: 型だけでなく、ユースケース・制約・副作用を明示。
- ドキュメント生成: `typedoc` で `docs/api/` に HTML 出力（任意、CI で生成可能）。

### 6.2 Lint / Format 規約
- Linter: ESLint（`@typescript-eslint`）を採用。共通設定はリポジトリ直下に配置し `app/` と `cdk/` に適用。
- ルール: ベースは `eslint:recommended` + `plugin:@typescript-eslint/recommended`。一部ルールを強める:
  - `@typescript-eslint/explicit-module-boundary-types`: warn
  - `@typescript-eslint/no-floating-promises`: error
  - `@typescript-eslint/consistent-type-imports`: error
  - `no-console`: warn（サーバ起動ログは許可）
- JSDoc ルール: `eslint-plugin-jsdoc` を導入し、公開 API への JSDoc を必須化。
- Formatter: Prettier を採用し、ESLint と連携（`eslint-config-prettier`）。
  - 既定: セミコロンあり、シングルクォート、幅 100、タブ幅 2。
- コミットフック: `husky` + `lint-staged` で pre-commit に `eslint --fix` と `prettier --write` を実行。
- 推奨追加: `.editorconfig` を配置し、エディタ間の差異を最小化。

## 7. IaC 設計（AWS CDK v2, TypeScript）
- ディレクトリ
  - `cdk/bin/app.ts`: エントリ
  - `cdk/lib/network.ts`: VPC
  - `cdk/lib/alb-ecs.ts`: ALB, TargetGroup, ECS(Fargate)
  - `cdk/lib/waf.ts`: Web ACL, ルール, ログ出力, ALB への関連付け
  - `cdk/cdk.json`, `cdk/package.json`
- パラメータ（Context/SSM/環境変数）
  - `allowedPaths`: 例 `['/upload']`
  - `allowedContentType`: 既定 `'multipart/form-data'`
  - `enableHttps` と `certificateArn`（任意）
  - `appMaxFileSizeMb`: 既定 `50`
  - `fargateCpu`: 例 `256`、`fargateMemory`: 例 `512`
- ログ
  - WAF: CloudWatch Logs（ロググループ名例 `waf-logs-sample-alb`）
  - ALB アクセスログ: 任意（コストと用途に応じて）

## 8. デプロイ（ハイレベル）
1) CDK ブートストラップ: `cdk bootstrap`（初回のみ）
2) デプロイ: `cdk deploy`（スタックは 1 つ想定）
3) 出力: ALB の DNS 名を取得

## 9. 検証シナリオ（期待結果）
- ケース1: `POST /upload` に 10MB
  - 期待: 200（アプリ受理）。WAF ログは allow。
- ケース2: `POST /profile` に 1MB
  - 期待: 403（WAF BlockMultipartOutsideAllowedPaths に一致）。
- ケース3: `POST /upload` に 40MB
  - 期待: 200（アプリ上限未満なら受理）。
- ケース4: `GET /upload`
  - 期待: 405/404（アプリ応答）。
- curl 例
  - `curl -F file=@big.bin http://<ALB-DNS>/upload`
  - `curl -F file=@small.bin http://<ALB-DNS>/profile` → 403

## 10. 監視・運用
- WAF ログ（CloudWatch Logs）で Allow/Block を確認。
- CloudWatch メトリクス: ALB 4xx/5xx、ターゲット 5xx、ECS サービス CPU/メモリ。
- 最低限のダッシュボードは任意で作成可。

## 11. パラメータ一覧（既定値）
- `allowedPaths`: `['/upload']`
- `allowedContentType`: `'multipart/form-data'`
- `appMaxFileSizeMb`: `50`
- `rateLimitPer5min`: 未設定（任意で 2000 など）
- `enableHttps`: `false`（`true` の場合は `certificateArn` 必須）

## 12. 並行タスク分解（Work Breakdown）
- A. アプリ雛形（Express + TS）
  - 目的: ルーティング（/upload, /profile, /, /health）と multer 設定。
  - 成果物: `app/src/**`, `app/Dockerfile`。
  - 受入基準: ローカルで `POST /upload` が 200、JSON 応答。
- B. テスト HTML とスクリプト
  - 目的: `/` のフォーム、`scripts/test-allowed.sh` と `scripts/test-blocked.sh`。
  - 成果物: `app/public/index.html`, `scripts/**`。
  - 受入基準: フォーム送信と curl で期待結果を再現。
- C. CDK: VPC/ECS/ALB 基盤
  - 目的: VPC（2AZ）、ALB、ECS Fargate サービス（タスク 1）、ALB ターゲット設定。
  - 成果物: `cdk/lib/network.ts`, `cdk/lib/alb-ecs.ts`。
  - 受入基準: デプロイ後 `GET /health` が 200。
- D. CDK: WAF Web ACL + ルール + ログ
  - 目的: カスタム Block ルール、マネージドルール（scope-down）、ALB への関連付け、CloudWatch Logs 出力。
  - 成果物: `cdk/lib/waf.ts`。
  - 受入基準: `/upload` は 200、`/profile` は 403。
- E. パラメータ/設定値の外部化
  - 目的: `allowedPaths`, `appMaxFileSizeMb`, `enableHttps`, `certificateArn` を Context/SSM/環境変数化。
  - 成果物: `cdk/bin/app.ts`, `cdk/lib/**`。
  - 受入基準: 値変更で挙動が反映。
- F. ドキュメント整備
  - 目的: `README.md` 更新、検証手順、コスト・注意点の記載。
  - 成果物: `README.md`, `docs/spec.md`。
  - 受入基準: 新規参加者が手順通りに検証可能。
- G. 開発規約セットアップ（TS/JSDoc/Lint/Format）
  - 目的: TypeScript 設定、ESLint + Prettier、`eslint-plugin-jsdoc`、`husky`/`lint-staged` の導入。
  - 成果物: ルートに `.eslintrc.cjs`, `.prettierrc`, `.editorconfig`, `tsconfig.base.json`、各パッケージに `tsconfig.json`。
  - 受入基準: `npm run lint`/`format:check` が成功し、pre-commit フックが動作。

依存関係（簡略）
- C →（D/E）→ 検証
- A/B は C・D と並行可（最終統合時に ALB 経由で検証）

## 13. Definition of Done（全体）
- `/upload` は 10〜40MB のファイルで 200 を返す（アプリ上限内）。
- `/profile` は 1MB でも 403（WAF Block）。
- WAF ログに Allow/Block が記録され、理由が確認可能。
- IaC（CDK）で作成・削除可能（`cdk deploy` / `cdk destroy`）。
- README の手順で第三者が環境構築〜検証まで実施可能。

## 14. リスクと対策
- ヘッダ偽装（Content-Type）: LOWERCASE 変換とメソッド限定（POST/PUT）で緩和。
- 大容量時のメモリ使用: `multer` memoryStorage は検証用途。必要に応じてストリーム or /tmp を使用。
- 413/タイムアウト: アプリと ALB のタイムアウト/上限設定に留意。
- マネージドルールの誤検知: 許可パスは scope-down で回避、その他はログでチューニング。

## 15. 将来拡張
- S3 プリサインド URL による直アップロード（WAF を回避しつつ署名で制御）。
- ウイルススキャン、MIME 厳格チェック、認証/認可の導入。
- BotControl や追加マネージドルール。

## 16. 付録: 参考 CDK 実装方針（概略）
- `CfnWebACL` で上記カスタムルールとマネージドルールを記述。
- `CfnWebACLAssociation` で ALB にアタッチ。
- ルール優先度は `BlockMultipartOutsideAllowedPaths` を最上位に配置。
- ScopeDownStatement は `NOT (POST/PUT + multipart/form-data + allowedPaths)` を表現。

---

この仕様で問題なければ、CDK/アプリの雛形実装に着手できます。リージョン、HTTPS の有無、許可パス、サイズ上限の初期値に指定があれば共有してください。
