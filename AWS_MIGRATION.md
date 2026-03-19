# NOMINE - AWS Lambda移行ガイド

## 📋 移行の全体像

### 変更点
1. **Cloudflare Workers → AWS Lambda**
2. **Cloudflare D1 (SQLite) → AWS RDS PostgreSQL**
3. **デプロイ方法変更**

### アーキテクチャ

```
┌─────────────────────────────────────────┐
│     API Gateway (REST API)              │
│     https://your-api.execute-api.       │
│     ap-northeast-1.amazonaws.com        │
└─────────────┬───────────────────────────┘
              │
┌─────────────▼───────────────────────────┐
│     AWS Lambda Functions                │
│     - Node.js 18.x                      │
│     - 既存のHonoコードをほぼそのまま    │
└─────────────┬───────────────────────────┘
              │
┌─────────────▼───────────────────────────┐
│     RDS PostgreSQL                      │
│     - 東京リージョン (ap-northeast-1)   │
│     - 既存のSQLiteスキーマを移植        │
└─────────────────────────────────────────┘
```

## ステップ1: 必要なパッケージをインストール

```bash
cd /home/user/webapp

# AWS Lambda用パッケージ
npm install @vendia/serverless-express aws-lambda

# PostgreSQL用パッケージ
npm install pg

# 開発用
npm install --save-dev @types/aws-lambda @types/pg
```

## ステップ2: データベースをPostgreSQLに変更

### マイグレーションファイルの修正
SQLiteからPostgreSQLへの構文変更が必要です。

主な変更点：
- `INTEGER PRIMARY KEY AUTOINCREMENT` → `SERIAL PRIMARY KEY`
- `DATETIME` → `TIMESTAMP`
- `TEXT` → `VARCHAR` or `TEXT`

## ステップ3: Lambda用エントリーポイント作成

`src/lambda.ts` を作成して、Honoアプリケーションを
Lambda対応にラップします。

## ステップ4: RDS PostgreSQLセットアップ

AWS Consoleで以下を設定：
1. RDS PostgreSQLインスタンス作成
2. セキュリティグループ設定
3. データベース初期化

## ステップ5: API Gateway設定

Lambda Functionを作成後、API Gatewayと連携。

## ステップ6: デプロイ

Lambdaにコードをアップロードして完了。

---

次のステップに進みますか？
