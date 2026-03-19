/**
 * AWS Lambda Entry Point
 * Hono + Serverless Express統合
 */

import serverlessExpress from '@vendia/serverless-express';
import { APIGatewayProxyEvent, APIGatewayProxyResult, Context } from 'aws-lambda';
import { Hono } from 'hono';
import { cors } from 'hono/cors';

// ルートのインポート
import auth from './routes/auth';
import admin from './routes/admin';
import stores from './routes/stores';
import settings from './routes/settings';
import publicEntry from './routes/public-entry';
import migrate from './routes/migrate';

// PostgreSQL初期化
import { initializePool, closePool } from './db-postgres';

// Honoアプリケーションの作成
const app = new Hono();

// CORS設定
app.use('/*', cors({
  origin: '*', // 本番環境では適切なオリジンに制限してください
  allowMethods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowHeaders: ['Content-Type', 'Authorization'],
  maxAge: 86400
}));

// ヘルスチェック
app.get('/health', (c) => {
  return c.json({
    status: 'ok',
    timestamp: new Date().toISOString(),
    environment: process.env.NODE_ENV || 'development'
  });
});

// APIルートの登録
app.route('/api/auth', auth);
app.route('/api/admin', admin);
app.route('/api/stores', stores);
app.route('/api/stores', settings);
app.route('/api/public/entry', publicEntry);
app.route('/api/migrate', migrate); // 一時的なマイグレーションエンドポイント

// デフォルトルート（消費者向けエントリー画面）
app.get('/entry/:qrToken', (c) => {
  const qrToken = c.req.param('qrToken');
  
  return c.html(`
    <!DOCTYPE html>
    <html lang="ja">
    <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>NOMINE - 選ばれる一枚を。</title>
        <script src="https://cdn.tailwindcss.com"></script>
        <link href="https://cdn.jsdelivr.net/npm/@fortawesome/fontawesome-free@6.4.0/css/all.min.css" rel="stylesheet">
        <link href="https://fonts.googleapis.com/css2?family=Noto+Sans+JP:wght@400;700&display=swap" rel="stylesheet">
        <style>
            body { font-family: 'Noto Sans JP', sans-serif; }
        </style>
    </head>
    <body class="bg-gray-900 text-white min-h-screen">
        <div id="app" data-qr-token="${qrToken}"></div>
        <script src="https://cdn.jsdelivr.net/npm/axios@1.6.0/dist/axios.min.js"></script>
        <script src="/static/consumer-entry.js"></script>
    </body>
    </html>
  `);
});

// ルートパス
app.get('/', (c) => {
  return c.json({
    service: 'NOMINE',
    version: '1.0.0',
    description: '選ばれる一枚を - Photo/Video Entry Platform for Restaurants',
    endpoints: {
      health: '/health',
      entry: '/entry/:qrToken',
      api: {
        auth: '/api/auth/*',
        admin: '/api/admin/*',
        stores: '/api/stores/*',
        public: '/api/public/entry/*'
      }
    }
  });
});

// 404ハンドラー
app.notFound((c) => {
  return c.json({ error: 'Not Found' }, 404);
});

// エラーハンドラー
app.onError((err, c) => {
  console.error('Error:', err);
  return c.json({
    error: 'Internal Server Error',
    message: err.message
  }, 500);
});

// Serverless Expressのラッパー作成
let serverlessExpressInstance: any;

function setupServerlessExpress() {
  // Honoアプリケーションをfetchハンドラーとしてエクスポート
  const handler = async (event: any) => {
    const request = new Request(
      `https://${event.headers.Host || 'localhost'}${event.path}`,
      {
        method: event.httpMethod,
        headers: new Headers(event.headers || {}),
        body: event.body ? event.body : undefined
      }
    );

    const response = await app.fetch(request);
    
    return {
      statusCode: response.status,
      headers: Object.fromEntries(response.headers.entries()),
      body: await response.text()
    };
  };

  return handler;
}

/**
 * Lambda Handler（メインエントリーポイント）
 */
export const handler = async (
  event: APIGatewayProxyEvent,
  context: Context
): Promise<APIGatewayProxyResult> => {
  // コンテキストの再利用を有効化（接続プールの最適化）
  context.callbackWaitsForEmptyEventLoop = false;

  try {
    // PostgreSQL接続プールを初期化
    initializePool();

    // Honoアプリケーションを実行
    const request = new Request(
      `https://${event.headers.Host || event.headers.host || 'localhost'}${event.path || event.rawPath || '/'}`,
      {
        method: event.httpMethod || event.requestContext?.http?.method || 'GET',
        headers: new Headers(event.headers || {}),
        body: event.body ? (event.isBase64Encoded ? Buffer.from(event.body, 'base64').toString() : event.body) : undefined
      }
    );

    const response = await app.fetch(request);
    
    const responseBody = await response.text();
    
    return {
      statusCode: response.status,
      headers: Object.fromEntries(response.headers.entries()),
      body: responseBody,
      isBase64Encoded: false
    };
  } catch (error) {
    console.error('Lambda handler error:', error);
    
    return {
      statusCode: 500,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        error: 'Internal Server Error',
        message: error instanceof Error ? error.message : 'Unknown error'
      })
    };
  }
};

// ローカルテスト用（オプション）
if (process.env.NODE_ENV === 'development') {
  const port = parseInt(process.env.PORT || '3000');
  console.log(`Starting local server on port ${port}...`);
  
  import('@hono/node-server').then(({ serve }) => {
    serve({
      fetch: app.fetch,
      port
    });
    console.log(`✅ Server running at http://localhost:${port}`);
  });
}
