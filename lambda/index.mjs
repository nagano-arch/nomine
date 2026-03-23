/**
 * AWS Lambda Entry Point for NOMINE API
 * Pure Lambda handler without Hono framework
 */

import { Pool } from 'pg';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';

// PostgreSQL接続プール
let pool = null;

function getPool() {
  if (!pool) {
    pool = new Pool({
      host: process.env.DB_HOST,
      port: parseInt(process.env.DB_PORT || '5432'),
      database: process.env.DB_NAME,
      user: process.env.DB_USER,
      password: process.env.DB_PASSWORD,
      max: 10,
      idleTimeoutMillis: 30000,
      connectionTimeoutMillis: 2000,
      ssl: process.env.DB_SSL === 'true' ? { rejectUnauthorized: false } : false
    });

    pool.on('error', (err) => {
      console.error('Unexpected error on idle PostgreSQL client', err);
    });
  }
  return pool;
}

// CORS ヘッダー
const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization',
  'Content-Type': 'application/json'
};

// レスポンスヘルパー
function response(statusCode, body) {
  return {
    statusCode,
    headers: CORS_HEADERS,
    body: JSON.stringify(body)
  };
}

// JWT検証
function verifyToken(token) {
  try {
    return jwt.verify(token, process.env.JWT_SECRET);
  } catch (error) {
    return null;
  }
}

// ルーティング
async function handleRequest(event) {
  const path = event.path || event.rawPath || '/';
  const method = event.httpMethod || event.requestContext?.http?.method || 'GET';
  const body = event.body ? JSON.parse(event.body) : {};
  const headers = event.headers || {};

  console.log(`${method} ${path}`);

  // OPTIONS リクエスト（CORS プリフライト）
  if (method === 'OPTIONS') {
    return response(200, { message: 'OK' });
  }

  // ヘルスチェック
  if (path === '/health' && method === 'GET') {
    return response(200, {
      status: 'ok',
      timestamp: new Date().toISOString(),
      environment: process.env.STAGE || 'dev'
    });
  }

  // ルートパス
  if (path === '/' && method === 'GET') {
    return response(200, {
      service: 'NOMINE API',
      version: '1.0.0',
      description: 'Restaurant Photo/Video Entry Platform',
      endpoints: {
        health: '/health',
        auth: '/api/auth/*',
        admin: '/api/admin/*',
        stores: '/api/stores/*',
        public: '/api/public/*'
      }
    });
  }

  // 認証API
  if (path.startsWith('/api/auth')) {
    return await handleAuth(path, method, body);
  }

  // 管理者API
  if (path.startsWith('/api/admin')) {
    const token = headers.authorization?.replace('Bearer ', '');
    const user = verifyToken(token);
    
    if (!user || user.role !== 'master_admin') {
      return response(401, { error: 'Unauthorized' });
    }
    
    return await handleAdmin(path, method, body, user);
  }

  // 店舗API
  if (path.startsWith('/api/stores')) {
    const token = headers.authorization?.replace('Bearer ', '');
    const user = verifyToken(token);
    
    if (!user) {
      return response(401, { error: 'Unauthorized' });
    }
    
    return await handleStores(path, method, body, user);
  }

  // 公開API
  if (path.startsWith('/api/public')) {
    return await handlePublic(path, method, body);
  }

  // マイグレーションAPI（一時的）
  if (path === '/api/migrate/run' && method === 'POST') {
    return await handleMigration();
  }

  if (path === '/api/migrate/status' && method === 'GET') {
    return await handleMigrationStatus();
  }

  // 404
  return response(404, { error: 'Not Found' });
}

// 認証ハンドラー
async function handleAuth(path, method, body) {
  const pool = getPool();

  // ログイン
  if (path === '/api/auth/login' && method === 'POST') {
    const { email, password } = body;

    if (!email || !password) {
      return response(400, { error: 'Email and password are required' });
    }

    try {
      const result = await pool.query(
        'SELECT * FROM users WHERE email = $1',
        [email]
      );

      if (result.rows.length === 0) {
        return response(401, { error: 'Invalid credentials' });
      }

      const user = result.rows[0];
      
      // デバッグログ
      console.log('User found:', { id: user.id, email: user.email, role: user.role });
      console.log('Password hash preview:', user.password_hash.substring(0, 20) + '...');
      console.log('Input password:', password);
      
      const isValid = await bcrypt.compare(password, user.password_hash);
      console.log('Password valid:', isValid);

      if (!isValid) {
        return response(401, { error: 'Invalid credentials' });
      }

      // JWTトークン生成
      const token = jwt.sign(
        {
          id: user.id,
          email: user.email,
          role: user.role
        },
        process.env.JWT_SECRET,
        { expiresIn: `${process.env.SESSION_EXPIRY_DAYS || 7}d` }
      );

      return response(200, {
        token,
        user: {
          id: user.id,
          email: user.email,
          name: user.name,
          role: user.role
        }
      });
    } catch (error) {
      console.error('Login error:', error);
      return response(500, { error: 'Internal server error' });
    }
  }

  // ユーザー登録
  if (path === '/api/auth/register' && method === 'POST') {
    const { email, password, name } = body;

    if (!email || !password || !name) {
      return response(400, { error: 'Email, password, and name are required' });
    }

    try {
      // パスワードハッシュ化
      const passwordHash = await bcrypt.hash(password, 10);

      const result = await pool.query(
        'INSERT INTO users (email, password_hash, name, role) VALUES ($1, $2, $3, $4) RETURNING id, email, name, role',
        [email, passwordHash, name, 'user']
      );

      return response(201, {
        user: result.rows[0]
      });
    } catch (error) {
      console.error('Register error:', error);
      
      if (error.code === '23505') { // Unique violation
        return response(409, { error: 'Email already exists' });
      }
      
      return response(500, { error: 'Internal server error' });
    }
  }

  return response(404, { error: 'Not Found' });
}

// 管理者ハンドラー
async function handleAdmin(path, method, body, user) {
  const pool = getPool();

  // ユーザー一覧
  if (path === '/api/admin/users' && method === 'GET') {
    try {
      const result = await pool.query(
        'SELECT id, email, name, role, created_at FROM users ORDER BY created_at DESC'
      );

      return response(200, {
        users: result.rows
      });
    } catch (error) {
      console.error('Get users error:', error);
      return response(500, { error: 'Internal server error' });
    }
  }

  // テナント一覧
  if (path === '/api/admin/tenants' && method === 'GET') {
    try {
      const result = await pool.query(`
        SELECT t.*, u.email as owner_email, u.name as owner_name
        FROM tenants t
        JOIN users u ON t.owner_user_id = u.id
        ORDER BY t.created_at DESC
      `);

      return response(200, {
        tenants: result.rows
      });
    } catch (error) {
      console.error('Get tenants error:', error);
      return response(500, { error: 'Internal server error' });
    }
  }

  return response(404, { error: 'Not Found' });
}

// 店舗ハンドラー
async function handleStores(path, method, body, user) {
  const pool = getPool();

  // 店舗一覧
  if (path === '/api/stores' && method === 'GET') {
    try {
      let query = 'SELECT * FROM stores ORDER BY created_at DESC';
      let params = [];

      // 一般ユーザーは自分のテナントの店舗のみ
      if (user.role !== 'master_admin') {
        query = `
          SELECT s.* FROM stores s
          JOIN tenants t ON s.tenant_id = t.id
          JOIN tenant_members tm ON t.id = tm.tenant_id
          WHERE tm.user_id = $1
          ORDER BY s.created_at DESC
        `;
        params = [user.id];
      }

      const result = await pool.query(query, params);

      return response(200, {
        stores: result.rows
      });
    } catch (error) {
      console.error('Get stores error:', error);
      return response(500, { error: 'Internal server error' });
    }
  }

  return response(404, { error: 'Not Found' });
}

// 公開ハンドラー
async function handlePublic(path, method, body) {
  return response(200, { message: 'Public API' });
}

// マイグレーションハンドラー
async function handleMigration() {
  // マイグレーションは既に完了しているので、スキップ
  return response(200, {
    success: true,
    message: 'Migration already completed via CloudShell',
    timestamp: new Date().toISOString()
  });
}

async function handleMigrationStatus() {
  const pool = getPool();
  
  try {
    const result = await pool.query(`
      SELECT table_name 
      FROM information_schema.tables 
      WHERE table_schema = 'public' 
      ORDER BY table_name
    `);

    return response(200, {
      success: true,
      tables: result.rows.map(row => row.table_name),
      tableCount: result.rows.length,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    console.error('Migration status error:', error);
    return response(500, { error: 'Internal server error' });
  }
}

// Lambda Handler
export const handler = async (event, context) => {
  // コンテキストの再利用を有効化
  context.callbackWaitsForEmptyEventLoop = false;

  try {
    return await handleRequest(event);
  } catch (error) {
    console.error('Lambda handler error:', error);
    return response(500, {
      error: 'Internal Server Error',
      message: error.message
    });
  }
};
