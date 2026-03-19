# 🚀 NOMINE - AWS Lambda 完全移行ガイド

## 📋 目次

1. [概要](#概要)
2. [必要なAWSサービス](#必要なawsサービス)
3. [事前準備](#事前準備)
4. [手順1: RDS PostgreSQLのセットアップ](#手順1-rds-postgresqlのセットアップ)
5. [手順2: S3バケットの作成](#手順2-s3バケットの作成)
6. [手順3: Lambda関数のデプロイ](#手順3-lambda関数のデプロイ)
7. [手順4: API Gatewayの設定](#手順4-api-gatewayの設定)
8. [手順5: データベースマイグレーション](#手順5-データベースマイグレーション)
9. [手順6: CloudFrontの設定（オプション）](#手順6-cloudfrontの設定オプション)
10. [手順7: モニタリングとロギング](#手順7-モニタリングとロギング)
11. [料金見積もり](#料金見積もり)
12. [トラブルシューティング](#トラブルシューティング)

---

## 概要

**NOMINE**は飲食店向けの写真・動画投稿プラットフォームです。Cloudflare Workers + D1からAWS Lambda + RDS PostgreSQLに移行することで、より柔軟なデータベース管理と日本リージョンでの高速レスポンスを実現します。

### アーキテクチャ変更

**移行前（Cloudflare Workers）**
- Cloudflare Workers（エッジコンピューティング）
- Cloudflare D1（SQLite）
- Cloudflare R2（オブジェクトストレージ）

**移行後（AWS Lambda）**
- AWS Lambda（サーバーレスコンピューティング）
- Amazon RDS PostgreSQL（リレーショナルデータベース）
- Amazon S3 + CloudFront（ストレージ + CDN）
- API Gateway（HTTPエンドポイント）

### 主な利点

✅ **日本リージョン（東京）でのホスティング** - レイテンシ最小化  
✅ **PostgreSQLの豊富な機能** - 全文検索、JSON型、トランザクション  
✅ **AWSエコシステム** - Cognito、SES、CloudWatch等との連携  
✅ **スケーラビリティ** - RDS読み取りレプリカ、Lambda並列実行  
✅ **セキュリティ** - VPC、IAMロール、Secrets Manager

---

## 必要なAWSサービス

| サービス | 用途 | 月額料金目安 |
|---------|------|------------|
| **Lambda** | APIサーバー実行 | ¥500〜 |
| **RDS PostgreSQL** | データベース | ¥3,000〜 |
| **S3** | 画像・動画ストレージ | ¥500〜 |
| **API Gateway** | HTTPエンドポイント | ¥300〜 |
| **CloudFront** | CDN（オプション） | ¥500〜 |
| **CloudWatch** | ログ・モニタリング | ¥300〜 |
| **合計** | - | **¥5,100〜** |

---

## 事前準備

### 1. AWSアカウント

- [AWSコンソール](https://aws.amazon.com/jp/)でアカウント作成（既に完了✅）
- 支払い方法を登録
- ルートユーザーでログイン

### 2. AWS CLIのインストール

```bash
# macOS
brew install awscli

# Linux
curl "https://awscli.amazonaws.com/awscli-exe-linux-x86_64.zip" -o "awscliv2.zip"
unzip awscliv2.zip
sudo ./aws/install

# Windows
# https://awscli.amazonaws.com/AWSCLIV2.msi からインストーラーをダウンロード
```

### 3. AWS CLI認証設定

```bash
aws configure
```

入力項目：
- **AWS Access Key ID**: AWSコンソールで発行
- **AWS Secret Access Key**: AWSコンソールで発行
- **Default region name**: `ap-northeast-1`（東京リージョン）
- **Default output format**: `json`

### 4. AWS SAMのインストール

```bash
# macOS
brew install aws-sam-cli

# Linux
wget https://github.com/aws/aws-sam-cli/releases/latest/download/aws-sam-cli-linux-x86_64.zip
unzip aws-sam-cli-linux-x86_64.zip -d sam-installation
sudo ./sam-installation/install

# インストール確認
sam --version
```

### 5. 必要なツール

```bash
# PostgreSQLクライアント
sudo apt-get install postgresql-client  # Linux
brew install postgresql@16              # macOS

# Node.js 20.x
nvm install 20
nvm use 20
```

---

## 手順1: RDS PostgreSQLのセットアップ

### 1-1. セキュリティグループの作成

```bash
# VPCのデフォルトIDを取得
VPC_ID=$(aws ec2 describe-vpcs --filters "Name=isDefault,Values=true" --query "Vpcs[0].VpcId" --output text)

# セキュリティグループを作成
SG_ID=$(aws ec2 create-security-group \
  --group-name nomine-rds-sg \
  --description "Security group for NOMINE RDS PostgreSQL" \
  --vpc-id $VPC_ID \
  --output text --query 'GroupId')

echo "Security Group ID: $SG_ID"

# Lambda用のインバウンドルール追加（PostgreSQL 5432ポート）
aws ec2 authorize-security-group-ingress \
  --group-id $SG_ID \
  --protocol tcp \
  --port 5432 \
  --cidr 0.0.0.0/0
```

**⚠️ セキュリティ注意**: 本番環境では`0.0.0.0/0`ではなく、Lambdaのセキュリティグループを指定してください。

### 1-2. RDSインスタンスの作成

```bash
# DBパスワード生成（安全な文字列）
DB_PASSWORD=$(openssl rand -base64 32 | tr -d "=+/" | cut -c1-25)
echo "Generated DB Password: $DB_PASSWORD"
echo "⚠️ このパスワードを安全に保存してください！"

# RDSインスタンス作成
aws rds create-db-instance \
  --db-instance-identifier nomine-db \
  --db-instance-class db.t3.micro \
  --engine postgres \
  --engine-version 16.4 \
  --master-username postgres \
  --master-user-password "$DB_PASSWORD" \
  --allocated-storage 20 \
  --storage-type gp3 \
  --vpc-security-group-ids $SG_ID \
  --publicly-accessible \
  --backup-retention-period 7 \
  --preferred-backup-window "03:00-04:00" \
  --preferred-maintenance-window "mon:04:00-mon:05:00" \
  --enable-cloudwatch-logs-exports postgresql \
  --region ap-northeast-1

echo "✅ RDSインスタンス作成開始（完了まで約10分）"
```

### 1-3. RDSエンドポイントの確認

```bash
# ステータス確認（available になるまで待つ）
aws rds describe-db-instances \
  --db-instance-identifier nomine-db \
  --query "DBInstances[0].DBInstanceStatus" \
  --output text

# エンドポイント取得
DB_HOST=$(aws rds describe-db-instances \
  --db-instance-identifier nomine-db \
  --query "DBInstances[0].Endpoint.Address" \
  --output text)

echo "DB Host: $DB_HOST"
```

### 1-4. 接続テスト

```bash
# PostgreSQL接続テスト
psql -h $DB_HOST -U postgres -d postgres

# パスワードを入力してログイン成功を確認
# \q で終了
```

---

## 手順2: S3バケットの作成

### 2-1. S3バケット作成

```bash
# バケット名（グローバルでユニークである必要がある）
BUCKET_NAME="nomine-uploads-$(date +%s)"

# S3バケット作成
aws s3 mb s3://$BUCKET_NAME --region ap-northeast-1

echo "✅ S3バケット作成完了: $BUCKET_NAME"
```

### 2-2. CORS設定

```bash
cat > cors.json <<EOF
{
  "CORSRules": [
    {
      "AllowedOrigins": ["*"],
      "AllowedMethods": ["GET", "PUT", "POST", "DELETE"],
      "AllowedHeaders": ["*"],
      "MaxAgeSeconds": 3600
    }
  ]
}
EOF

aws s3api put-bucket-cors \
  --bucket $BUCKET_NAME \
  --cors-configuration file://cors.json
```

### 2-3. ライフサイクルポリシー（48時間後に未選出投稿を削除）

```bash
cat > lifecycle.json <<EOF
{
  "Rules": [
    {
      "Id": "DeleteOldUnadoptedSubmissions",
      "Status": "Enabled",
      "Prefix": "stores/",
      "Expiration": {
        "Days": 2
      }
    }
  ]
}
EOF

aws s3api put-bucket-lifecycle-configuration \
  --bucket $BUCKET_NAME \
  --lifecycle-configuration file://lifecycle.json
```

---

## 手順3: Lambda関数のデプロイ

### 3-1. 環境変数設定

```bash
# プロジェクトルートで .env ファイル作成
cat > .env <<EOF
NODE_ENV=production
DB_HOST=$DB_HOST
DB_PORT=5432
DB_NAME=nomine
DB_USER=postgres
DB_PASSWORD=$DB_PASSWORD
DB_SSL=true
JWT_SECRET=$(openssl rand -base64 32)
SESSION_EXPIRY_DAYS=7
S3_BUCKET_NAME=$BUCKET_NAME
AWS_REGION=ap-northeast-1
EOF

echo "✅ 環境変数ファイル作成完了"
```

### 3-2. ビルド

```bash
cd /home/user/webapp

# 依存関係インストール
npm install

# TypeScriptコンパイル
npm run build:lambda
```

### 3-3. SAMデプロイ

```bash
# 初回デプロイ
sam deploy \
  --stack-name nomine-dev \
  --region ap-northeast-1 \
  --capabilities CAPABILITY_IAM \
  --parameter-overrides \
    Stage=dev \
    DBHost=$DB_HOST \
    DBName=nomine \
    DBUser=postgres \
    DBPassword=$DB_PASSWORD \
    JWTSecret=$(cat .env | grep JWT_SECRET | cut -d'=' -f2) \
    S3BucketName=$BUCKET_NAME \
  --guided

# 2回目以降は --guided 不要
sam deploy
```

### 3-4. デプロイ結果確認

```bash
# APIエンドポイント取得
API_ENDPOINT=$(aws cloudformation describe-stacks \
  --stack-name nomine-dev \
  --query "Stacks[0].Outputs[?OutputKey=='ApiEndpoint'].OutputValue" \
  --output text)

echo "API Endpoint: $API_ENDPOINT"

# ヘルスチェック
curl $API_ENDPOINT/health
```

---

## 手順4: API Gatewayの設定

### 4-1. カスタムドメイン設定（オプション）

```bash
# AWS Certificate Managerで証明書発行
aws acm request-certificate \
  --domain-name api.your-domain.com \
  --validation-method DNS \
  --region ap-northeast-1

# Route 53でDNS検証レコード追加

# API Gatewayにカスタムドメイン設定
aws apigateway create-domain-name \
  --domain-name api.your-domain.com \
  --certificate-arn arn:aws:acm:ap-northeast-1:xxx:certificate/xxx \
  --endpoint-configuration types=REGIONAL
```

### 4-2. レート制限設定

```bash
# 使用量プランの作成
aws apigateway create-usage-plan \
  --name nomine-usage-plan \
  --throttle burstLimit=100,rateLimit=50 \
  --quota limit=100000,period=MONTH
```

---

## 手順5: データベースマイグレーション

### 5-1. PostgreSQLマイグレーション実行

```bash
# データベース接続
export DATABASE_URL="postgresql://postgres:$DB_PASSWORD@$DB_HOST:5432/nomine?sslmode=require"

# マイグレーション実行
npm run db:migrate:postgres

# または手動実行
psql $DATABASE_URL -f migrations-postgres/0001_create_users.sql
psql $DATABASE_URL -f migrations-postgres/0002_create_tenants.sql
# ... 全てのマイグレーションファイルを実行
```

### 5-2. シードデータ投入

```bash
psql $DATABASE_URL -f seed.sql
```

### 5-3. 接続確認

```bash
psql $DATABASE_URL -c "SELECT COUNT(*) FROM users;"
psql $DATABASE_URL -c "SELECT COUNT(*) FROM tenants;"
```

---

## 手順6: CloudFrontの設定（オプション）

CloudFrontを使うことで、S3の静的ファイルを世界中で高速配信できます。

### 6-1. CloudFront Distribution作成

```bash
# ディストリビューション設定ファイル作成
cat > cloudfront-config.json <<EOF
{
  "CallerReference": "nomine-$(date +%s)",
  "Origins": {
    "Quantity": 1,
    "Items": [
      {
        "Id": "S3-$BUCKET_NAME",
        "DomainName": "$BUCKET_NAME.s3.ap-northeast-1.amazonaws.com",
        "S3OriginConfig": {
          "OriginAccessIdentity": ""
        }
      }
    ]
  },
  "DefaultCacheBehavior": {
    "TargetOriginId": "S3-$BUCKET_NAME",
    "ViewerProtocolPolicy": "redirect-to-https",
    "AllowedMethods": {
      "Quantity": 3,
      "Items": ["GET", "HEAD", "OPTIONS"]
    },
    "Compress": true,
    "MinTTL": 0,
    "DefaultTTL": 86400,
    "MaxTTL": 31536000
  },
  "Enabled": true
}
EOF

# CloudFront作成
aws cloudfront create-distribution --distribution-config file://cloudfront-config.json
```

### 6-2. CloudFront URLの取得

```bash
CLOUDFRONT_DOMAIN=$(aws cloudfront list-distributions \
  --query "DistributionList.Items[?Origins.Items[?Id=='S3-$BUCKET_NAME']].DomainName" \
  --output text)

echo "CloudFront Domain: $CLOUDFRONT_DOMAIN"
```

### 6-3. Lambda環境変数にCloudFront追加

```bash
aws lambda update-function-configuration \
  --function-name nomine-api-dev \
  --environment "Variables={CLOUDFRONT_DOMAIN=$CLOUDFRONT_DOMAIN}"
```

---

## 手順7: モニタリングとロギング

### 7-1. CloudWatch Logsの確認

```bash
# Lambda関数のログストリーム取得
aws logs tail /aws/lambda/nomine-api-dev --follow
```

### 7-2. CloudWatch Alarmsの設定

```bash
# エラー率アラーム
aws cloudwatch put-metric-alarm \
  --alarm-name nomine-lambda-errors \
  --alarm-description "Lambda function error rate" \
  --metric-name Errors \
  --namespace AWS/Lambda \
  --statistic Sum \
  --period 300 \
  --threshold 10 \
  --comparison-operator GreaterThanThreshold \
  --evaluation-periods 1 \
  --dimensions Name=FunctionName,Value=nomine-api-dev

# レイテンシアラーム
aws cloudwatch put-metric-alarm \
  --alarm-name nomine-lambda-duration \
  --alarm-description "Lambda function duration" \
  --metric-name Duration \
  --namespace AWS/Lambda \
  --statistic Average \
  --period 300 \
  --threshold 3000 \
  --comparison-operator GreaterThanThreshold \
  --evaluation-periods 2 \
  --dimensions Name=FunctionName,Value=nomine-api-dev
```

---

## 料金見積もり

### 想定トラフィック
- 月間アクティブユーザー: 1,000人
- 月間投稿数: 10,000件
- 月間API呼び出し: 100,000リクエスト
- ストレージ: 50GB

### 月額料金（東京リージョン）

| サービス | 料金 |
|---------|------|
| **Lambda** | 無料枠内（100万リクエスト/月まで無料） |
| **RDS t3.micro** | ¥2,500〜 |
| **S3ストレージ（50GB）** | ¥150 |
| **S3リクエスト** | ¥50 |
| **API Gateway（10万リクエスト）** | ¥400 |
| **CloudFront（10GB転送）** | ¥100 |
| **CloudWatch** | ¥300 |
| **データ転送** | ¥200 |
| **合計** | **約¥3,700/月** |

### コスト削減のポイント

1. **RDSの最適化**
   - 開発環境は夜間停止（¥50/月削減）
   - Reserved Instanceで30%割引
   
2. **S3ライフサイクルポリシー**
   - 48時間後に未選出投稿を自動削除
   
3. **Lambdaコールドスタート対策**
   - プロビジョニング同時実行数を設定（推奨しない - 料金増）
   - 代わりに、接続プール最適化で対応

---

## トラブルシューティング

### 問題1: Lambda接続タイムアウト

**症状**: `Task timed out after 30.00 seconds`

**原因**: RDSへの接続が確立できない

**解決策**:
```bash
# 1. セキュリティグループ確認
aws ec2 describe-security-groups --group-ids $SG_ID

# 2. LambdaをVPC内に配置
# template.yamlで VpcConfig を設定
```

### 問題2: データベース接続エラー

**症状**: `ECONNREFUSED` or `password authentication failed`

**原因**: 接続情報が間違っている

**解決策**:
```bash
# 環境変数確認
aws lambda get-function-configuration \
  --function-name nomine-api-dev \
  --query 'Environment'

# 正しいパスワードで更新
aws lambda update-function-configuration \
  --function-name nomine-api-dev \
  --environment "Variables={DB_PASSWORD=correct-password}"
```

### 問題3: S3アップロードエラー

**症状**: `Access Denied`

**原因**: Lambda実行ロールにS3権限がない

**解決策**:
```bash
# Lambda実行ロールにS3ポリシー追加
aws iam attach-role-policy \
  --role-name nomine-lambda-role \
  --policy-arn arn:aws:iam::aws:policy/AmazonS3FullAccess
```

### 問題4: CORS エラー

**症状**: `Access to fetch at ... from origin ... has been blocked by CORS policy`

**解決策**:
```bash
# S3バケットのCORS設定を確認
aws s3api get-bucket-cors --bucket $BUCKET_NAME

# API GatewayでCORSを有効化（template.yamlで設定済み）
```

---

## 次のステップ

✅ RDSセットアップ完了  
✅ Lambda関数デプロイ完了  
✅ S3バケット作成完了  
✅ API Gateway設定完了  

### 推奨: 追加機能

1. **CI/CD パイプライン**
   - GitHub Actions で自動デプロイ
   
2. **セキュリティ強化**
   - AWS Secrets Manager でパスワード管理
   - WAF（Web Application Firewall）導入
   
3. **バックアップ自動化**
   - RDS自動バックアップ（7日保持）
   - S3バケット versioning 有効化

4. **モニタリング強化**
   - X-Ray でトレーシング
   - CloudWatch Insightsでログ分析

---

## 参考リンク

- [AWS Lambda公式ドキュメント](https://docs.aws.amazon.com/lambda/)
- [Amazon RDS PostgreSQL](https://docs.aws.amazon.com/AmazonRDS/latest/UserGuide/CHAP_PostgreSQL.html)
- [AWS SAMドキュメント](https://docs.aws.amazon.com/serverless-application-model/)
- [Hono公式ドキュメント](https://hono.dev/)

---

**作成日**: 2026-03-19  
**バージョン**: 1.0.0  
**メンテナー**: NOMINE開発チーム
