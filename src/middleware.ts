import type { Context, Next } from 'hono';
import type { Bindings, User } from './types';
import { validateSession, getUserById } from './auth';

/**
 * 認証ミドルウェア
 * Authorization ヘッダーからトークンを取得し、セッションを検証
 */
export async function authMiddleware(
  c: Context<{ Bindings: Bindings }>,
  next: Next
) {
  const authHeader = c.req.header('Authorization');

  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return c.json({ error: 'Unauthorized' }, 401);
  }

  const token = authHeader.substring(7);
  const { DB } = c.env;

  // セッションを検証
  const session = await validateSession(DB, token);

  if (!session) {
    return c.json({ error: 'Invalid or expired session' }, 401);
  }

  // ユーザー情報を取得
  const user = await getUserById(DB, session.user_id);

  if (!user) {
    return c.json({ error: 'User not found' }, 401);
  }

  // コンテキストにユーザー情報を保存
  c.set('user', user);
  c.set('token', token);

  await next();
}

/**
 * マスター管理者専用ミドルウェア
 */
export async function masterAdminMiddleware(
  c: Context<{ Bindings: Bindings }>,
  next: Next
) {
  const user = c.get('user') as User | undefined;
  const masterEmail = c.env.MASTER_ADMIN_EMAIL;

  if (!user || user.email !== masterEmail || user.role !== 'master_admin') {
    return c.json({ error: 'Forbidden: Master admin access required' }, 403);
  }

  await next();
}

/**
 * レート制限ミドルウェア（簡易版）
 * 本番環境ではCloudflare Rate Limitingまたは外部サービスを推奨
 */
const requestCounts = new Map<string, { count: number; resetAt: number }>();

export async function rateLimitMiddleware(
  c: Context<{ Bindings: Bindings }>,
  next: Next
) {
  const ip = c.req.header('CF-Connecting-IP') || c.req.header('X-Forwarded-For') || 'unknown';
  const now = Date.now();
  const limit = 60; // 60 requests
  const window = 60 * 1000; // per minute

  const current = requestCounts.get(ip);

  if (current) {
    if (now > current.resetAt) {
      // ウィンドウリセット
      requestCounts.set(ip, { count: 1, resetAt: now + window });
    } else {
      if (current.count >= limit) {
        return c.json(
          {
            error: 'Rate limit exceeded',
            retryAfter: Math.ceil((current.resetAt - now) / 1000)
          },
          429
        );
      }
      current.count++;
    }
  } else {
    requestCounts.set(ip, { count: 1, resetAt: now + window });
  }

  await next();
}

/**
 * CORS ミドルウェア
 */
export async function corsMiddleware(
  c: Context<{ Bindings: Bindings }>,
  next: Next
) {
  // プリフライトリクエスト
  if (c.req.method === 'OPTIONS') {
    return c.json(null, 204, {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type, Authorization',
      'Access-Control-Max-Age': '86400'
    });
  }

  await next();

  // レスポンスヘッダー
  c.header('Access-Control-Allow-Origin', '*');
  c.header('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
  c.header('Access-Control-Allow-Headers', 'Content-Type, Authorization');
}
