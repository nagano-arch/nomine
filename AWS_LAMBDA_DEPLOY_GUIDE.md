# 🚀 NOMINE - AWS Lambda デプロイ完全ガイド（初心者向け）

## 📌 この文書の目的

AWSアカウントを作成したばかりのあなたが、NOMINEアプリケーションをAWS Lambdaにデプロイして運用開始するまでの**完全な手順**を説明します。

---

## ✅ 完了済み項目

以下はすでに実装・準備が完了しています：

- ✅ TypeScript + Honoで書かれた完全なバックエンドコード
- ✅ PostgreSQL対応のデータベース接続モジュール
- ✅ S3ファイルアップロード機能
- ✅ Lambda関数エントリーポイント
- ✅ AWS SAMテンプレート
- ✅ デプロイスクリプト
- ✅ データベースマイグレーションファイル
- ✅ 管理画面・消費者画面のフロントエンド

**つまり、コード開発は完了しており、あとはAWSにデプロイするだけです！**

---

## 🎯 デプロイ後の完成形

デプロイ完了後、以下が利用可能になります：

1. **APIエンドポイント**: `https://xxxxx.execute-api.ap-northeast-1.amazonaws.com/dev/`
2. **管理画面**: `{APIエンドポイント}/admin/login`
3. **QRコードエントリー**: `{APIエンドポイント}/entry/{qr_token}`
4. **データベース**: PostgreSQL（Amazon RDS）
5. **ファイルストレージ**: S3 + CloudFront CDN

---

## 📝 デプロイ手順（ステップバイステップ）

### ステップ0: 必要なツールのインストール

まず、ローカル環境（あなたのPC）に必要なツールをインストールします。

#### 0-1. AWS CLIのインストール

**macOS の場合:**
```bash
brew install awscli
```

**Linux の場合:**
```bash
curl "https://awscli.amazonaws.com/awscli-exe-linux-x86_64.zip" -o "awscliv2.zip"
unzip awscliv2.zip
sudo ./aws/install
```

**Windows の場合:**
- [AWS CLI Installer](https://awscli.amazonaws.com/AWSCLIV2.msi)をダウンロードして実行

#### 0-2. AWS SAM CLIのインストール

**macOS の場合:**
```bash
brew install aws-sam-cli
```

**Linux の場合:**
```bash
wget https://github.com/aws/aws-sam-cli/releases/latest/download/aws-sam-cli-linux-x86_64.zip
unzip aws-sam-cli-linux-x86_64.zip -d sam-installation
sudo ./sam-installation/install
```

**Windows の場合:**
- [AWS SAM CLI Installer](https://github.com/aws/aws-sam-cli/releases/latest)からダウンロード

#### 0-3. PostgreSQLクライアントのインストール（オプション）

データベース操作用：

**macOS:**
```bash
brew install postgresql@16
```

**Linux:**
```bash
sudo apt-get install postgresql-client
```

#### 0-4. インストール確認

```bash
aws --version
# AWS CLI 2.x 以上

sam --version
# SAM CLI 1.x 以上

psql --version
# psql 16.x 以上
```

---

### ステップ1: AWS認証情報の設定

#### 1-1. IAMユーザーの作成

1. [AWSコンソール](https://console.aws.amazon.com/)にログイン
2. サービス検索で「IAM」を検索して開く
3. 左メニューの「ユーザー」をクリック
4. 「ユーザーを作成」ボタンをクリック
5. ユーザー名に `nomine-deployer` を入力
6. 「次へ」をクリック
7. 「ポリシーを直接アタッチする」を選択
8. 以下のポリシーを検索して選択：
   - `AdministratorAccess`（開発環境用、本番環境では最小権限に変更）
9. 「次へ」→「ユーザーを作成」

#### 1-2. アクセスキーの作成

1. 作成したユーザー `nomine-deployer` をクリック
2. 「セキュリティ認証情報」タブをクリック
3. 「アクセスキーを作成」ボタンをクリック
4. 「コマンドラインインターフェイス（CLI）」を選択
5. 確認チェックボックスにチェック
6. 「次へ」→「アクセスキーを作成」
7. **表示された Access Key ID と Secret Access Key をメモ**（後で使用）

#### 1-3. AWS CLI設定

ターミナルで以下を実行：

```bash
aws configure
```

入力内容：
```
AWS Access Key ID [None]: AKIA************  # 先ほどメモしたキー
AWS Secret Access Key [None]: **********************  # シークレットキー
Default region name [None]: ap-northeast-1  # 東京リージョン
Default output format [None]: json
```

#### 1-4. 設定確認

```bash
aws sts get-caller-identity
```

アカウント情報が表示されれば成功です。

---

### ステップ2: RDS PostgreSQLデータベースの作成

#### 2-1. セキュリティグループの作成

```bash
# デフォルトVPCのIDを取得
VPC_ID=$(aws ec2 describe-vpcs --filters "Name=isDefault,Values=true" --query "Vpcs[0].VpcId" --output text)

echo "VPC ID: $VPC_ID"

# セキュリティグループを作成
SG_ID=$(aws ec2 create-security-group \
  --group-name nomine-rds-sg \
  --description "Security group for NOMINE RDS PostgreSQL" \
  --vpc-id $VPC_ID \
  --output text --query 'GroupId')

echo "Security Group ID: $SG_ID"

# PostgreSQLポート(5432)を開放
aws ec2 authorize-security-group-ingress \
  --group-id $SG_ID \
  --protocol tcp \
  --port 5432 \
  --cidr 0.0.0.0/0

echo "✅ セキュリティグループ作成完了"
```

#### 2-2. データベースパスワード生成

```bash
# 安全なパスワードを生成
DB_PASSWORD=$(openssl rand -base64 32 | tr -d "=+/" | cut -c1-25)

echo "===================="
echo "🔑 データベースパスワード"
echo "$DB_PASSWORD"
echo "===================="
echo "⚠️  このパスワードを安全な場所に保存してください！"
echo ""

# .envファイルに保存
echo "DB_PASSWORD=$DB_PASSWORD" >> .env.local
```

#### 2-3. RDSインスタンス作成

```bash
# RDSインスタンスを作成（約10分かかります）
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

echo "✅ RDSインスタンス作成開始（完了まで約10分待ってください）"
```

#### 2-4. 作成完了を待つ

```bash
# ステータス確認（available になるまで待つ）
watch -n 30 'aws rds describe-db-instances \
  --db-instance-identifier nomine-db \
  --query "DBInstances[0].DBInstanceStatus" \
  --output text'

# Ctrl+C で終了
```

`available` と表示されたら次へ進みます。

#### 2-5. エンドポイント取得

```bash
# データベースエンドポイントを取得
DB_HOST=$(aws rds describe-db-instances \
  --db-instance-identifier nomine-db \
  --query "DBInstances[0].Endpoint.Address" \
  --output text)

echo "===================="
echo "📍 データベースエンドポイント"
echo "$DB_HOST"
echo "===================="

# .envファイルに保存
echo "DB_HOST=$DB_HOST" >> .env.local
```

#### 2-6. データベース接続テスト

```bash
# PostgreSQL接続テスト
psql -h $DB_HOST -U postgres -d postgres

# パスワードを入力（先ほどメモしたDB_PASSWORD）
# 接続成功したら \q で終了
```

---

### ステップ3: S3バケットの作成

#### 3-1. バケット名を決定

```bash
# ユニークなバケット名を生成（S3バケット名は全世界でユニークである必要がある）
BUCKET_NAME="nomine-uploads-$(date +%s)"

echo "S3 Bucket Name: $BUCKET_NAME"

# .envファイルに保存
echo "S3_BUCKET_NAME=$BUCKET_NAME" >> .env.local
```

#### 3-2. S3バケット作成

```bash
# S3バケットを作成
aws s3 mb s3://$BUCKET_NAME --region ap-northeast-1

echo "✅ S3バケット作成完了"
```

#### 3-3. CORS設定

```bash
# CORS設定ファイルを作成
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

# CORSを適用
aws s3api put-bucket-cors \
  --bucket $BUCKET_NAME \
  --cors-configuration file://cors.json

echo "✅ CORS設定完了"
```

#### 3-4. ライフサイクルポリシー（48時間後自動削除）

```bash
# ライフサイクルルールを作成
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

# ライフサイクルを適用
aws s3api put-bucket-lifecycle-configuration \
  --bucket $BUCKET_NAME \
  --lifecycle-configuration file://lifecycle.json

echo "✅ ライフサイクルポリシー設定完了"
```

---

### ステップ4: 環境変数設定

#### 4-1. JWT秘密鍵生成

```bash
# JWT秘密鍵を生成
JWT_SECRET=$(openssl rand -base64 32)

echo "JWT Secret: $JWT_SECRET"

# .envファイルに保存
echo "JWT_SECRET=$JWT_SECRET" >> .env.local
```

#### 4-2. 環境変数ファイル作成

```bash
# プロジェクトルートで .env ファイル作成
cd /home/user/webapp

cat > .env <<EOF
NODE_ENV=production
DB_HOST=$DB_HOST
DB_PORT=5432
DB_NAME=nomine
DB_USER=postgres
DB_PASSWORD=$DB_PASSWORD
DB_SSL=true
JWT_SECRET=$JWT_SECRET
SESSION_EXPIRY_DAYS=7
S3_BUCKET_NAME=$BUCKET_NAME
AWS_REGION=ap-northeast-1
EOF

echo "✅ 環境変数ファイル作成完了"
cat .env
```

---

### ステップ5: データベースマイグレーション

#### 5-1. データベース接続URL作成

```bash
export DATABASE_URL="postgresql://postgres:$DB_PASSWORD@$DB_HOST:5432/nomine?sslmode=require"

echo "Database URL: $DATABASE_URL"
```

#### 5-2. マイグレーション実行

```bash
# データベース作成
psql "$DATABASE_URL" -c "CREATE DATABASE IF NOT EXISTS nomine;"

# マイグレーション実行
psql "$DATABASE_URL" -f migrations-postgres/all.sql

echo "✅ データベースマイグレーション完了"
```

#### 5-3. シードデータ投入

```bash
# テストデータを投入
psql "$DATABASE_URL" -f seed.sql

echo "✅ シードデータ投入完了"
```

#### 5-4. 確認

```bash
# テーブル一覧確認
psql "$DATABASE_URL" -c "\dt"

# ユーザー数確認
psql "$DATABASE_URL" -c "SELECT COUNT(*) FROM users;"
```

---

### ステップ6: Lambda関数のデプロイ

#### 6-1. 依存関係インストール

```bash
cd /home/user/webapp

# 本番用依存関係のみインストール
npm ci --production

echo "✅ 依存関係インストール完了"
```

#### 6-2. TypeScriptビルド

```bash
# TypeScriptをJavaScriptにコンパイル
npm run build

echo "✅ ビルド完了"
```

#### 6-3. SAM初回デプロイ

```bash
# SAMビルド
sam build

# SAMデプロイ（ガイド付き）
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
    JWTSecret=$JWT_SECRET \
    S3BucketName=$BUCKET_NAME \
  --guided
```

**ガイドでの入力例:**
```
Confirm changes before deploy [Y/n]: Y
Allow SAM CLI IAM role creation [Y/n]: Y
Disable rollback [y/N]: N
Save arguments to configuration file [Y/n]: Y
SAM configuration file [samconfig.toml]: (Enter)
SAM configuration environment [default]: (Enter)
```

#### 6-4. デプロイ完了確認

```bash
# デプロイ完了確認
aws cloudformation describe-stacks \
  --stack-name nomine-dev \
  --query "Stacks[0].StackStatus" \
  --output text

# CREATE_COMPLETE と表示されればOK
```

---

### ステップ7: エンドポイント取得とテスト

#### 7-1. APIエンドポイント取得

```bash
# APIエンドポイントを取得
API_ENDPOINT=$(aws cloudformation describe-stacks \
  --stack-name nomine-dev \
  --query "Stacks[0].Outputs[?OutputKey=='ApiEndpoint'].OutputValue" \
  --output text)

echo "========================================="
echo "🎉 デプロイ成功！"
echo "========================================="
echo "📍 API Endpoint:"
echo "   $API_ENDPOINT"
echo ""
echo "🏠 管理画面:"
echo "   ${API_ENDPOINT}/admin/login"
echo ""
echo "📱 QRエントリー:"
echo "   ${API_ENDPOINT}/entry/{qr_token}"
echo "========================================="
```

#### 7-2. ヘルスチェック

```bash
# ヘルスチェックエンドポイントをテスト
curl -i $API_ENDPOINT/health

# 期待される出力:
# HTTP/1.1 200 OK
# {"status":"ok","timestamp":"...","environment":"production"}
```

#### 7-3. 管理画面アクセス

ブラウザで以下にアクセス：

```
https://xxxxx.execute-api.ap-northeast-1.amazonaws.com/dev/admin/login
```

**テスト管理者アカウント（seed.sqlで作成済み）:**
- Email: `admin@nomine.com`
- Password: `admin123`

---

### ステップ8: 運用設定（オプション）

#### 8-1. CloudWatch Logs確認

```bash
# Lambdaログを確認
aws logs tail /aws/lambda/nomine-api-dev --follow
```

#### 8-2. CloudWatch Alarmsの設定

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
```

#### 8-3. 本番環境デプロイ

開発環境でテストが完了したら、本番環境にデプロイ：

```bash
# 本番用RDSインスタンス作成
aws rds create-db-instance \
  --db-instance-identifier nomine-db-prod \
  --db-instance-class db.t3.small \
  --engine postgres \
  --engine-version 16.4 \
  --master-username postgres \
  --master-user-password "$PROD_DB_PASSWORD" \
  --allocated-storage 100 \
  --storage-type gp3 \
  --multi-az \
  --backup-retention-period 30

# 本番用Lambda関数デプロイ
sam deploy \
  --stack-name nomine-production \
  --parameter-overrides Stage=production
```

---

## 🎯 完了チェックリスト

デプロイ完了後、以下を確認してください：

- [ ] ヘルスチェックが成功する（`curl $API_ENDPOINT/health`）
- [ ] 管理画面にログインできる
- [ ] データベースに接続できる
- [ ] S3バケットが作成されている
- [ ] Lambda関数が正常に動作している
- [ ] CloudWatch Logsにログが出力されている

---

## 💰 料金見積もり

**月額約¥3,700〜（開発環境）**

- Lambda: 無料枠内
- RDS t3.micro: ¥2,500
- S3: ¥200
- API Gateway: ¥400
- CloudWatch: ¥300
- データ転送: ¥300

**節約のポイント:**
- 開発環境のRDSは夜間停止
- S3ライフサイクルポリシーで古いファイルを自動削除
- Lambda関数のメモリサイズを最適化

---

## 🛠 トラブルシューティング

### 問題1: `aws: command not found`

**解決策:** AWS CLIをインストール（ステップ0参照）

### 問題2: `permission denied`

**解決策:** IAMユーザーに適切な権限を付与

### 問題3: Lambda接続タイムアウト

**原因:** RDSセキュリティグループの設定ミス

**解決策:**
```bash
# セキュリティグループのインバウンドルールを確認
aws ec2 describe-security-groups --group-ids $SG_ID
```

### 問題4: データベース接続エラー

**原因:** パスワード間違い、SSL設定

**解決策:**
```bash
# 環境変数を再確認
cat .env

# PostgreSQL接続テスト
psql -h $DB_HOST -U postgres -d nomine
```

---

## 📞 サポート

問題が解決しない場合は、以下を確認してください：

1. **CloudWatch Logs**: Lambda関数のエラーログ
2. **RDSログ**: データベース接続エラー
3. **S3アクセスログ**: ファイルアップロードエラー

---

## 🎉 次のステップ

デプロイが完了したら：

1. カスタムドメインの設定
2. SSL証明書の発行（AWS Certificate Manager）
3. Route 53でDNS設定
4. CI/CDパイプラインの構築（GitHub Actions）
5. モニタリングとアラートの強化

---

**作成日**: 2026-03-19  
**バージョン**: 1.0.0  
**対象者**: AWS初心者〜中級者
