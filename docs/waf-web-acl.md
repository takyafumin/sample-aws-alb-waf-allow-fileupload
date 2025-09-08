# Web ACL 定義（実装ドキュメント）

このドキュメントは、CDK 実装済みの AWS WAFv2 Web ACL の定義内容と設計意図をまとめたものです。実装は `cdk/lib/waf.ts` にあります。

## 概要
- 対象: ALB（REGIONAL）
- 既定動作: Allow（`defaultAction: Allow`）
- ルール構成（優先度の昇順で評価）
  1. カスタム Block ルール: 許可パス外の `multipart/form-data` を Block
  2. マネージドルール（3種）: 許可パスの `multipart/form-data` を scope-down（除外）
- ロギング: CloudWatch Logs（ロググループ名は `aws-waf-logs-` 接頭辞必須）

## 実装ファイルの主な定義
- Web ACL 本体: `cdk/lib/waf.ts:130`
- ALB への関連付け: `cdk/lib/waf.ts:142`
- カスタム Block ルール: `cdk/lib/waf.ts:76`
- マネージドルール群 + scope-down: `cdk/lib/waf.ts:96`
- 許可パスの判定ステートメント（単数/複数対応）: `cdk/lib/waf.ts:30`
- ロググループ作成（命名要件に対応）: `cdk/lib/waf.ts:147`
- WAF → CloudWatch Logs のリソースポリシー: `cdk/lib/waf.ts:163`
- WAF ログ有効化（CfnLoggingConfiguration）: `cdk/lib/waf.ts:185`

## ルール詳細
### 1) BlockMultipartOutsideAllowedPaths（優先度: 0, Action: Block）
- 条件
  - `Content-Type` が `multipart/form-data` を含む
  - かつ、`UriPath` が「許可パス（`allowedPaths`）のいずれかで始まる」に該当しない
- 実装メモ
  - `content-type` は `LOWERCASE` 変換で頑強化（大文字小文字差異の吸収）
  - 許可パスが1件のときは `ByteMatchStatement` で直接判定／複数のときは `OrStatement`

### 2) マネージドルール（scope-down 付き, overrideAction: none）
- 使用ルール
  - `AWSManagedRulesCommonRuleSet`
  - `AWSManagedRulesKnownBadInputsRuleSet`
  - `AWSManagedRulesAmazonIpReputationList`
- scope-down 条件（NOT で除外）
  - メソッド: `POST` または `PUT`
  - `Content-Type`: `multipart/form-data`
  - `UriPath`: 許可パスで始まる
- ねらい
  - 許可パスの大きな multipart はマネージドルール検査の対象外とし、過検知を回避

## パラメータ（既定値）
- `allowedPaths`: `['/upload']`（`cdk/lib/waf.ts:18`）
- ログ保持日数: 1週間（変更可）

## ロギング（CloudWatch Logs）
- ロググループ名は `aws-waf-logs-` で始める必要がある（`cdk/lib/waf.ts:149`）
- WAF ログ配信のサービスプリンシパルは `delivery.logs.amazonaws.com`（`cdk/lib/waf.ts:172`）
- 付与権限の最小化（推奨）
  - `aws:SourceAccount` と `aws:SourceArn` 条件で Web ACL 起点に限定する（将来追加検討）

## 設計上のポイント
- Web ACL はデフォルト Allow。最上位に Block ルールを置き、意図しない multipart を拒否
- ルールはボディを直接参照しないため WAF の OversizeHandling 影響を受けにくい
- 許可パスは CDK プロパティから拡張可能（`allowedPaths`）

## 検証
- 許可: `POST /upload` に複数 MB のファイル → 200 を期待（アプリ側で受理）
- 拒否: `POST /profile` に 1MB 程度 → 403（Block ルール一致）

