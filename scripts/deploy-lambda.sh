#!/bin/bash
# Lambda デプロイスクリプト

set -e

echo "🚀 NOMINE Lambda デプロイ開始..."

# プロジェクトディレクトリに移動
cd "$(dirname "$0")/.."

# Lambda ディレクトリに移動
cd lambda

# 依存関係をインストール
echo "📦 依存関係をインストール中..."
npm install --production

# ZIP ファイルを作成
echo "📦 Lambda パッケージを作成中..."
zip -r ../lambda-package.zip . -x "*.git*" "node_modules/.cache/*"

cd ..

# Lambda 関数を更新
echo "🚀 Lambda 関数を更新中..."
aws lambda update-function-code \
  --function-name nomine-api-dev \
  --zip-file fileb://lambda-package.zip \
  --region ap-northeast-1

echo "✅ デプロイ完了！"
echo "📝 API エンドポイント: https://upy8u8lpx6.execute-api.ap-northeast-1.amazonaws.com/Prod"
