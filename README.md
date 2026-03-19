# NOMINE（ノミネ）

> **選ばれる一枚を。**

飲食店向け顧客参加型UGC収集SaaS

---

## 🎯 プロジェクト概要

**NOMINE**は、飲食店が来店客から高品質な写真・動画を収集し、公式SNS素材として活用できる革新的なSaaSプラットフォームです。

### コンセプト

- 来店客が撮影した写真・動画を「エントリー」
- 店舗が公式素材として「選出」
- 選ばれた客には特典を提供
- AI採点で品質を可視化し、参加体験を向上

---

## ✨ 主な機能

### 消費者向け機能

- **QRコードエントリー**: テーブルQRから即座にアクセス
- **AI採点システム**: 写真・動画を自動評価（シズル感・構図・臨場感・公式適性）
- **共通アルバム**: 当日の全エントリーを閲覧可能
- **Instagram連携**: アカウント入力で公式投稿時にタグ付け可能
- **営業時間外制御**: 営業時間のみエントリー受付

### 店舗管理機能

- **ダッシュボード**: 当日のエントリー状況をリアルタイム把握
- **投稿管理**: エントリー一覧・詳細確認・選出
- **テーブル管理**: QRコード発行・管理
- **設定管理**: 営業時間・特典内容・選出上限の設定
- **マルチテナント対応**: 複数店舗を一元管理

### システム機能

- **営業日ロジック**: 24時超えの営業時間に対応
- **自動削除**: 未選出素材は48時間後に自動削除
- **権限管理**: マスター管理者・店舗管理者・一般メンバーの3階層
- **セキュアな認証**: JWT + bcrypt によるセッション管理

---

## 🛠 技術スタック

### 🚀 **AWS Lambda版（推奨 - 日本展開向け）**

- **Runtime**: AWS Lambda (Node.js 20.x)
- **Framework**: Hono (高速・軽量Webフレームワーク)
- **Database**: Amazon RDS PostgreSQL 16
- **Storage**: Amazon S3 + CloudFront CDN
- **API**: Amazon API Gateway
- **Auth**: JWT + bcrypt
- **Deployment**: AWS SAM (Serverless Application Model)

### ☁️ **Cloudflare Workers版（グローバル展開向け）**

- **Runtime**: Cloudflare Workers
- **Framework**: Hono
- **Database**: Cloudflare D1 (SQLite)
- **Storage**: Cloudflare R2
- **Deployment**: Wrangler CLI

---

## 📚 ドキュメント

- **[AWS Lambda完全移行ガイド](./AWS_LAMBDA_GUIDE.md)** - RDS、S3、API Gatewayのセットアップ手順
- **[技術仕様書](./TECHNICAL_SPEC.md)** - 詳細なシステム設計
- **[実装ガイド](./IMPLEMENTATION_GUIDE.md)** - 開発者向けガイド
- **[プロジェクトサマリー](./PROJECT_SUMMARY.md)** - 概要とロードマップ

---

## 🚀 クイックスタート

### AWS Lambda版のセットアップ

1. **前提条件**
```bash
# AWS CLIインストール
brew install awscli

# AWS SAM CLIインストール
brew install aws-sam-cli

# 認証設定
aws configure
```

2. **プロジェクトセットアップ**
```bash
# リポジトリクローン
git clone https://github.com/your-org/nomine.git
cd nomine

# 依存関係インストール
npm install

# 環境変数設定
cp .env.example .env
# .envファイルを編集してDB接続情報とJWT_SECRETを設定
```

3. **RDSデータベース作成**
```bash
# AWS_LAMBDA_GUIDE.mdの手順に従ってRDSインスタンスを作成
# マイグレーション実行
npm run db:migrate:postgres
```

4. **デプロイ**
```bash
# ビルド & デプロイ
npm run deploy:lambda:dev

# または手動デプロイ
sam build
sam deploy --guided
```

5. **動作確認**
```bash
# APIエンドポイント取得
API_ENDPOINT=$(aws cloudformation describe-stacks \
  --stack-name nomine-dev \
  --query "Stacks[0].Outputs[?OutputKey=='ApiEndpoint'].OutputValue" \
  --output text)

# ヘルスチェック
curl $API_ENDPOINT/health
```

---

## 📦 プロジェクト構造

```
nomine/
├── src/
│   ├── lambda.ts              # Lambda エントリーポイント
│   ├── db-postgres.ts         # PostgreSQL接続モジュール
│   ├── s3.ts                  # S3統合モジュール
│   ├── auth.ts                # 認証ロジック
│   ├── rbac.ts                # 権限管理
│   ├── middleware.ts          # Honoミドルウェア
│   ├── types.ts               # TypeScript型定義
│   ├── routes/                # APIルート
│   │   ├── auth.ts            # 認証API
│   │   ├── admin.ts           # 管理者API
│   │   ├── stores.ts          # 店舗管理API
│   │   ├── settings.ts        # 設定API
│   │   └── public-entry.ts    # 公開エントリーAPI
│   ├── utils/                 # ユーティリティ
│   │   ├── validators.ts      # バリデーション
│   │   ├── business-day.ts    # 営業日ロジック
│   │   └── score.ts           # AI採点ロジック
│   └── ui/                    # フロントエンド（HTML生成）
│       ├── admin/             # 管理画面
│       ├── consumer/          # 消費者画面
│       └── shared/            # 共通コンポーネント
├── public/static/             # 静的ファイル
│   ├── consumer-entry.js      # 消費者UI JavaScript
│   ├── admin-login.js         # 管理画面ログイン
│   └── admin-dashboard.js     # 管理画面ダッシュボード
├── migrations-postgres/       # PostgreSQLマイグレーション
│   ├── 0001_create_users.sql
│   ├── 0002_create_tenants.sql
│   └── ...
├── scripts/
│   └── deploy.sh              # デプロイスクリプト
├── template.yaml              # AWS SAM テンプレート
├── package.json
├── tsconfig.json
└── README.md

## 🛠 技術スタック（旧版）

### フロントエンド

- **UI Framework**: TailwindCSS + Vanilla JavaScript
- **アイコン**: Font Awesome 6
- **QRコード**: qrcode.js

### バックエンド

- **Framework**: Hono (Cloudflare Workers)
- **Runtime**: Cloudflare Workers
- **Language**: TypeScript

### データベース

- **Database**: Cloudflare D1 (SQLite)
- **Migrations**: Wrangler D1 Migrations

### 認証

- **JWT**: jsonwebtoken
- **Password Hashing**: bcryptjs

### インフラ

- **Hosting**: Cloudflare Pages
- **CDN**: Cloudflare CDN
- **Edge Computing**: Cloudflare Workers

---

## 📁 プロジェクト構造

```
webapp/
├── src/
│   ├── index.tsx                  # メインエントリーポイント
│   ├── auth.ts                    # 認証ロジック
│   ├── rbac.ts                    # 権限制御
│   ├── middleware.ts              # 認証・CORS・レート制限
│   ├── types.ts                   # TypeScript型定義
│   ├── routes/                    # APIルート
│   │   ├── auth.ts               # 認証API
│   │   ├── stores.ts             # 店舗管理API
│   │   └── public-entry.ts       # 消費者向けAPI
│   ├── services/                  # ビジネスロジック
│   ├── utils/                     # ユーティリティ
│   │   ├── business-day.ts       # 営業日ロジック
│   │   ├── score.ts              # AI採点ロジック
│   │   └── validators.ts         # バリデーション
│   └── ui/                        # UI/HTMLテンプレート
│       ├── consumer/              # 消費者向け画面
│       │   ├── entry.ts          # エントリー画面
│       │   └── album.ts          # アルバム画面
│       ├── admin/                 # 管理画面
│       │   ├── login.ts          # ログイン
│       │   ├── register.ts       # 新規登録
│       │   ├── dashboard.ts      # ダッシュボード
│       │   ├── submissions.ts    # 投稿管理
│       │   ├── settings.ts       # 設定
│       │   └── tables.ts         # テーブル管理
│       └── shared/                # 共通コンポーネント
│           └── layout.ts         # レイアウト・ヘルパー
├── migrations/                    # DBマイグレーション
│   ├── 0001_create_users.sql
│   ├── 0002_create_tenants.sql
│   ├── 0003_create_tenant_members.sql
│   ├── 0004_create_sessions.sql
│   ├── 0005_create_stores.sql
│   ├── 0006_create_store_tables.sql
│   ├── 0007_create_business_days.sql
│   ├── 0008_create_daily_settings.sql
│   ├── 0009_create_submission_batches.sql
│   ├── 0010_create_submissions.sql
│   ├── 0011_create_ai_scores.sql
│   ├── 0012_create_adoptions.sql
│   └── 0013_create_template_configs.sql
├── public/                        # 静的ファイル
├── dist/                          # ビルド出力
├── .dev.vars                      # ローカル環境変数
├── wrangler.jsonc                 # Cloudflare設定
├── vite.config.ts                 # Viteビルド設定
├── ecosystem.config.cjs           # PM2設定
├── package.json
└── README.md
```

---

## 🚀 セットアップ

### 1. 環境変数設定

`.dev.vars`ファイルを作成：

```bash
JWT_SECRET=your-super-secret-jwt-key-change-in-production-min-32-chars
MASTER_ADMIN_EMAIL=master-admin@nomine.local
SESSION_EXPIRY_DAYS=7
```

### 2. D1データベース作成

```bash
# 本番用データベース作成
npm run db:create

# wrangler.jsom の database_id を更新

# マイグレーション実行（ローカル）
npm run db:migrate:local

# マイグレーション実行（本番）
npm run db:migrate:prod
```

### 3. ローカル開発

```bash
# ビルド
npm run build

# PM2でサービス起動
npm run clean-port
pm2 start ecosystem.config.cjs

# ログ確認
pm2 logs nomine --nostream

# 動作確認
curl http://localhost:3000
```

### 4. 本番デプロイ

```bash
# Cloudflare Pagesへデプロイ
npm run deploy:prod
```

---

## 🔑 初期アカウント

### マスター管理者

- **Email**: `master-admin@nomine.local` (変更可能)
- **Role**: `master_admin`
- **権限**: 全店舗管理・全ユーザー管理

### 店舗管理者

- 新規登録画面から作成
- **Role**: `tenant_admin`
- **権限**: 自店舗管理・自店舗メンバー管理

---

## 📊 データベース設計

### 主要テーブル

| テーブル名 | 説明 |
|---|---|
| `users` | ユーザーアカウント |
| `tenants` | テナント（店舗グループ） |
| `tenant_members` | テナントメンバーシップ |
| `sessions` | JWT認証セッション |
| `stores` | 店舗情報 |
| `store_tables` | テーブル・卓情報 |
| `business_days` | 営業日管理 |
| `daily_settings` | 日次設定 |
| `submission_batches` | エントリーバッチ |
| `submissions` | 個別エントリー |
| `ai_scores` | AI採点結果 |
| `adoptions` | 選出レコード |
| `template_configs` | テンプレート設定 |

---

## 🎨 UI/UXの特徴

### 消費者画面

- **モダンでミニマル**: Instagramライクなデザイン
- **高速**: 1秒台での初回表示
- **直感的**: 説明不要のシンプルな導線
- **ブランドトーン**: "選ばれる体験"を損なわない文言
- **レスポンシブ**: スマホファーストで最適化

### 管理画面

- **見やすい**: 大きめカードUI・余白広め
- **分かりやすい**: リテラシーが低くても迷わない
- **ハイセンス**: ダサい業務システムにしない
- **効率的**: 1画面で状況把握可能

---

## 🔐 セキュリティ

- **パスワード**: bcrypt salt rounds 10
- **JWT**: 7日間有効期限
- **セッション**: DB管理・自動期限切れ
- **CORS**: 適切な設定
- **Rate Limit**: 1分60リクエスト
- **SQLインジェクション対策**: パラメータバインディング
- **XSS対策**: 適切なエスケープ

---

## 📝 API エンドポイント

### 認証API

- `POST /api/auth/register` - 新規登録
- `POST /api/auth/login` - ログイン
- `POST /api/auth/logout` - ログアウト
- `GET /api/auth/me` - ユーザー情報取得

### 店舗管理API

- `GET /api/stores/:id/dashboard` - ダッシュボード
- `GET /api/stores/:id/submissions` - エントリー一覧
- `GET /api/stores/:id/submissions/:submissionId` - エントリー詳細
- `POST /api/stores/:id/submissions/:submissionId/adopt` - 選出
- `GET /api/stores/:id/settings` - 設定取得
- `PUT /api/stores/:id/settings` - 設定更新
- `GET /api/stores/:id/tables` - テーブル一覧
- `POST /api/stores/:id/tables` - テーブル作成

### 消費者向けAPI

- `GET /api/public/entry/:qrToken/bootstrap` - 初期情報取得
- `POST /api/public/entry/:qrToken/upload` - ファイルアップロード
- `POST /api/public/entry/:qrToken/score` - AI採点
- `POST /api/public/entry/:qrToken/submit` - エントリー確定
- `GET /api/public/entry/:qrToken/album` - 共通アルバム

---

## 🚧 既知の課題と今後の改善

### ⚠️ 重要な実装課題

#### 1. **認証ライブラリの互換性問題**

現在、`bcryptjs`と`jsonwebtoken`がCloudflare Workers環境で動作しない問題があります。

**解決策**:
- Web Crypto APIを使用したパスワードハッシュ化
- JWTは`jose`ライブラリに置き換え

```bash
# 代替ライブラリのインストール
npm uninstall bcryptjs jsonwebtoken @types/bcryptjs @types/jsonwebtoken
npm install jose
```

#### 2. **ファイルアップロード実装**

現在はダミーURLを返していますが、実運用では以下が必要：

**推奨実装**:
- Cloudflare R2でファイルストレージ
- 署名付きURL for アップロード
- サムネイル生成（Cloudflare Images）

#### 3. **AI採点の精度向上**

現在はルールベース+ランダム要素ですが、実運用では：

**推奨実装**:
- Cloudflare AI Workers
- OpenAI Vision API
- Google Cloud Vision API

#### 4. **QRコード生成**

`qrcode`ライブラリもNode.js依存のため、代替が必要：

**解決策**:
- `qrcode`をCDNから読み込み（フロントエンドのみ）
- または外部QR生成APIを使用

### 📋 機能拡張の余地

- [ ] 初期設定ウィザード
- [ ] メール通知機能
- [ ] 詳細な分析ダッシュボード
- [ ] 複数言語対応
- [ ] モバイルアプリ
- [ ] リアルタイム通知（Cloudflare Durable Objects）

---

## 📖 使い方

### 店舗管理者の流れ

1. `/admin/register` から新規登録
2. `/admin/dashboard` でダッシュボード確認
3. `/admin/tables` でテーブル追加 & QRコード発行
4. `/admin/settings` で営業時間・特典設定
5. `/admin/submissions` でエントリー確認・選出

### 消費者の流れ

1. テーブルのQRコードをスキャン
2. `/entry/:qrToken` でエントリー画面表示
3. 写真または動画を選択してアップロード
4. Instagram アカウント入力（任意）
5. AI採点結果を確認
6. 利用規約に同意してエントリー
7. `/entry/:qrToken/album` で共通アルバム閲覧

---

## 🎓 学習リソース

- [Hono Documentation](https://hono.dev/)
- [Cloudflare Workers Docs](https://developers.cloudflare.com/workers/)
- [Cloudflare D1 Database](https://developers.cloudflare.com/d1/)
- [TailwindCSS](https://tailwindcss.com/)

---

## 📄 ライセンス

このプロジェクトはプロトタイプ実装です。商用利用の際は適切なライセンス設定を行ってください。

---

## 🙋 サポート

質問や問題がある場合は、プロジェクトのIssueを作成してください。

---

**NOMINE - 選ばれる一枚を。**
