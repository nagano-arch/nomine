#!/bin/bash
# NOMINE デプロイスクリプト（AWS Lambda + SAM）

set -e  # エラー時に即座に終了

echo "🚀 NOMINE AWS Lambda デプロイを開始します..."

# カラー設定
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# 環境変数チェック
echo "📋 環境変数をチェックしています..."

if [ -z "$DB_HOST" ]; then
    echo -e "${RED}❌ DB_HOST が設定されていません${NC}"
    exit 1
fi

if [ -z "$JWT_SECRET" ]; then
    echo -e "${RED}❌ JWT_SECRET が設定されていません${NC}"
    exit 1
fi

echo -e "${GREEN}✅ 環境変数チェック完了${NC}"

# ステージ選択
STAGE=${1:-dev}
echo -e "${YELLOW}📦 デプロイステージ: ${STAGE}${NC}"

# 依存関係インストール
echo "📦 依存関係をインストールしています..."
npm ci --production

# TypeScriptコンパイル
echo "🔨 TypeScriptをコンパイルしています..."
npm run build

# SAMビルド
echo "🏗️  SAM アプリケーションをビルドしています..."
sam build --use-container

# SAMデプロイ
echo "🚀 AWS Lambda にデプロイしています..."
sam deploy \
  --stack-name "nomine-${STAGE}" \
  --region ap-northeast-1 \
  --capabilities CAPABILITY_IAM \
  --parameter-overrides \
    Stage=${STAGE} \
    DBHost=${DB_HOST} \
    DBName=${DB_NAME:-nomine} \
    DBUser=${DB_USER:-postgres} \
    DBPassword=${DB_PASSWORD} \
    JWTSecret=${JWT_SECRET} \
    S3BucketName=${S3_BUCKET_NAME:-nomine-uploads-${STAGE}} \
  --no-confirm-changeset

# デプロイ完了
echo -e "${GREEN}✅ デプロイ完了！${NC}"

# エンドポイント取得
API_ENDPOINT=$(aws cloudformation describe-stacks \
  --stack-name "nomine-${STAGE}" \
  --query "Stacks[0].Outputs[?OutputKey=='ApiEndpoint'].OutputValue" \
  --output text)

echo ""
echo "========================================="
echo -e "${GREEN}🎉 デプロイ成功！${NC}"
echo "========================================="
echo "📍 API エンドポイント:"
echo "   ${API_ENDPOINT}"
echo ""
echo "🧪 ヘルスチェック:"
echo "   curl ${API_ENDPOINT}/health"
echo ""
echo "📖 ドキュメント:"
echo "   ${API_ENDPOINT}/"
echo "========================================="
