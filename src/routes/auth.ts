import { Hono } from 'hono';
import type { Bindings, User } from '../types';
import {
  createUser,
  getUserByEmail,
  verifyPassword,
  generateToken,
  createSession,
  validateSession,
  deleteSession,
  getUserById
} from '../auth';
import { isValidEmail, isValidPassword, safeErrorMessage } from '../utils/validators';

const auth = new Hono<{ Bindings: Bindings }>();

/**
 * 新規登録
 * POST /api/auth/register
 */
auth.post('/register', async (c) => {
  try {
    const { email, password, name } = await c.req.json();

    // バリデーション
    if (!email || !isValidEmail(email)) {
      return c.json(errorResponse('有効なメールアドレスを入力してください'), 400);
    }

    if (!password || !isValidPassword(password)) {
      return c.json(errorResponse('パスワードは8文字以上である必要があります'), 400);
    }

    const { DB, JWT_SECRET, SESSION_EXPIRY_DAYS } = c.env;

    // メールアドレス重複チェック
    const existing = await getUserByEmail(DB, email);
    if (existing) {
      return c.json(errorResponse('このメールアドレスは既に登録されています'), 400);
    }

    // ユーザー作成
    const user = await createUser(DB, email, password, 'tenant_admin', name);

    // テナントを作成
    const tenant = await DB
      .prepare('INSERT INTO tenants (name, owner_id, status) VALUES (?, ?, ?) RETURNING *')
      .bind(name || `${email}の店舗`, user.id, 'active')
      .first();

    if (!tenant) {
      return c.json(errorResponse('テナントの作成に失敗しました'), 500);
    }

    // テナントメンバーに追加
    await DB
      .prepare('INSERT INTO tenant_members (tenant_id, user_id, role) VALUES (?, ?, ?)')
      .bind(tenant.id, user.id, 'tenant_admin')
      .run();

    // JWTトークン生成
    const token = generateToken(user.id, JWT_SECRET);

    // セッション作成
    const expiryDays = parseInt(SESSION_EXPIRY_DAYS || '7');
    await createSession(DB, user.id, token, expiryDays);

    return c.json(
      successResponse(
        {
          token,
          user: {
            id: user.id,
            email: user.email,
            name: user.name,
            role: user.role
          },
          tenant: {
            id: tenant.id,
            name: tenant.name
          }
        },
        '登録が完了しました'
      ),
      201
    );
  } catch (error) {
    console.error('Register error:', error);
    return c.json(errorResponse('登録処理中にエラーが発生しました'), 500);
  }
});

/**
 * ログイン
 * POST /api/auth/login
 */
auth.post('/login', async (c) => {
  try {
    const { email, password } = await c.req.json();

    if (!email || !password) {
      return c.json(errorResponse('メールアドレスとパスワードを入力してください'), 400);
    }

    const { DB, JWT_SECRET, SESSION_EXPIRY_DAYS, MASTER_ADMIN_EMAIL } = c.env;

    // ユーザー取得
    const user = await getUserByEmail(DB, email);
    if (!user) {
      return c.json(errorResponse('メールアドレスまたはパスワードが正しくありません'), 401);
    }

    // パスワード検証
    const isValid = await verifyPassword(password, user.password_hash);
    if (!isValid) {
      return c.json(errorResponse('メールアドレスまたはパスワードが正しくありません'), 401);
    }

    // マスター管理者判定
    const isMaster = email === MASTER_ADMIN_EMAIL;

    // JWTトークン生成
    const token = generateToken(user.id, JWT_SECRET);

    // セッション作成
    const expiryDays = parseInt(SESSION_EXPIRY_DAYS || '7');
    await createSession(DB, user.id, token, expiryDays);

    // テナント情報取得
    let tenants = [];
    if (!isMaster) {
      const result = await DB
        .prepare(`
          SELECT t.* FROM tenants t
          INNER JOIN tenant_members tm ON t.id = tm.tenant_id
          WHERE tm.user_id = ?
        `)
        .bind(user.id)
        .all();
      tenants = result.results || [];
    }

    return c.json(
      successResponse({
        token,
        user: {
          id: user.id,
          email: user.email,
          name: user.name,
          role: user.role,
          is_master: isMaster
        },
        tenants
      })
    );
  } catch (error) {
    console.error('Login error:', error);
    return c.json(errorResponse('ログイン処理中にエラーが発生しました'), 500);
  }
});

/**
 * ログアウト
 * POST /api/auth/logout
 */
auth.post('/logout', async (c) => {
  try {
    const token = c.get('token') as string;
    if (!token) {
      return c.json(errorResponse('トークンが見つかりません'), 400);
    }

    const { DB } = c.env;
    await deleteSession(DB, token);

    return c.json(successResponse(null, 'ログアウトしました'));
  } catch (error) {
    console.error('Logout error:', error);
    return c.json(errorResponse('ログアウト処理中にエラーが発生しました'), 500);
  }
});

/**
 * 現在のユーザー情報取得
 * GET /api/auth/me
 */
auth.get('/me', async (c) => {
  try {
    const user = c.get('user') as User;
    const { DB, MASTER_ADMIN_EMAIL } = c.env;

    const isMaster = user.email === MASTER_ADMIN_EMAIL;

    // テナント情報取得
    let tenants = [];
    if (!isMaster) {
      const result = await DB
        .prepare(`
          SELECT t.* FROM tenants t
          INNER JOIN tenant_members tm ON t.id = tm.tenant_id
          WHERE tm.user_id = ?
        `)
        .bind(user.id)
        .all();
      tenants = result.results || [];
    }

    return c.json(
      successResponse({
        user: {
          id: user.id,
          email: user.email,
          name: user.name,
          role: user.role,
          is_master: isMaster
        },
        tenants
      })
    );
  } catch (error) {
    console.error('Get me error:', error);
    return c.json(errorResponse('ユーザー情報の取得に失敗しました'), 500);
  }
});

export default auth;
