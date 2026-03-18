import { Hono } from 'hono';
import { serveStatic } from 'hono/cloudflare-workers';
import type { Bindings } from './types';

// Routes
import auth from './routes/auth';
import admin from './routes/admin';
import stores from './routes/stores';
import settings from './routes/settings';
import publicEntry from './routes/public-entry';

// Middleware
import { corsMiddleware, rateLimitMiddleware } from './middleware';

const app = new Hono<{ Bindings: Bindings }>();

// CORS と Rate Limit を全体に適用
app.use('*', corsMiddleware);
app.use('*', rateLimitMiddleware);

// 静的ファイル配信
app.use('/static/*', serveStatic({ root: './public' }));

// API Routes
app.route('/api/auth', auth);
app.route('/api/admin', admin);
app.route('/api/stores', stores);
app.route('/api/stores', settings);
app.route('/api/public/entry', publicEntry);

// ヘルスチェック
app.get('/api/health', (c) => {
  return c.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// デフォルトルート（消費者向けエントリー画面）
app.get('/entry/:qrToken', (c) => {
  const qrToken = c.req.param('qrToken');
  return c.html(`
    <!DOCTYPE html>
    <html lang="ja">
    <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no">
        <title>NOMINE - 選ばれる一枚を。</title>
        <script src="https://cdn.tailwindcss.com"></script>
        <link href="https://cdn.jsdelivr.net/npm/@fortawesome/fontawesome-free@6.4.0/css/all.min.css" rel="stylesheet">
        <style>
          @import url('https://fonts.googleapis.com/css2?family=Noto+Sans+JP:wght@400;500;700&display=swap');
          
          body {
            font-family: 'Noto Sans JP', sans-serif;
            background: linear-gradient(135deg, #1a1a1a 0%, #2d2d2d 100%);
            min-height: 100vh;
          }

          .nomine-gradient {
            background: linear-gradient(135deg, #f59e0b 0%, #d97706 100%);
          }

          .nomine-card {
            background: rgba(255, 255, 255, 0.98);
            backdrop-filter: blur(10px);
            border-radius: 24px;
            box-shadow: 0 20px 60px rgba(0, 0, 0, 0.3);
          }

          .btn-primary {
            background: linear-gradient(135deg, #f59e0b 0%, #d97706 100%);
            transition: all 0.3s ease;
          }

          .btn-primary:hover {
            transform: translateY(-2px);
            box-shadow: 0 10px 30px rgba(245, 158, 11, 0.4);
          }

          .fade-in {
            animation: fadeIn 0.6s ease-in;
          }

          @keyframes fadeIn {
            from { opacity: 0; transform: translateY(20px); }
            to { opacity: 1; transform: translateY(0); }
          }

          .loading-spinner {
            border: 3px solid rgba(245, 158, 11, 0.2);
            border-top-color: #f59e0b;
            border-radius: 50%;
            width: 40px;
            height: 40px;
            animation: spin 0.8s linear infinite;
          }

          @keyframes spin {
            to { transform: rotate(360deg); }
          }
        </style>
    </head>
    <body>
        <div id="app" class="min-h-screen p-4 py-8"></div>
        
        <script src="https://cdn.jsdelivr.net/npm/axios@1.6.0/dist/axios.min.js"></script>
        <script>
          const QR_TOKEN = '${qrToken}';
          const API_BASE = '/api/public/entry/' + QR_TOKEN;
        </script>
        <script src="/static/consumer-entry.js"></script>
    </body>
    </html>
  `);
});

// 管理画面ログイン
app.get('/admin/login', (c) => {
  return c.html(`
    <!DOCTYPE html>
    <html lang="ja">
    <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>NOMINE - 管理画面ログイン</title>
        <script src="https://cdn.tailwindcss.com"></script>
        <style>
          @import url('https://fonts.googleapis.com/css2?family=Noto+Sans+JP:wght@400;500;700&display=swap');
          body { font-family: 'Noto Sans JP', sans-serif; }
        </style>
    </head>
    <body class="bg-gray-50">
        <div id="app"></div>
        <script src="https://cdn.jsdelivr.net/npm/axios@1.6.0/dist/axios.min.js"></script>
        <script src="/static/admin-login.js"></script>
    </body>
    </html>
  `);
});

// 管理画面ダッシュボード
app.get('/admin/dashboard', (c) => {
  return c.html(`
    <!DOCTYPE html>
    <html lang="ja">
    <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>NOMINE - ダッシュボード</title>
        <script src="https://cdn.tailwindcss.com"></script>
        <link href="https://cdn.jsdelivr.net/npm/@fortawesome/fontawesome-free@6.4.0/css/all.min.css" rel="stylesheet">
        <style>
          @import url('https://fonts.googleapis.com/css2?family=Noto+Sans+JP:wght@400;500;700&display=swap');
          body { font-family: 'Noto Sans JP', sans-serif; }
        </style>
    </head>
    <body class="bg-gray-50">
        <div id="app"></div>
        <script src="https://cdn.jsdelivr.net/npm/axios@1.6.0/dist/axios.min.js"></script>
        <script src="/static/admin-dashboard.js"></script>
    </body>
    </html>
  `);
});

// 404
app.notFound((c) => {
  return c.json({ error: 'Not Found' }, 404);
});

// エラーハンドリング
app.onError((err, c) => {
  console.error('Application error:', err);
  return c.json({ error: 'Internal Server Error', message: err.message }, 500);
});

export default app;
