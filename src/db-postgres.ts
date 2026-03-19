/**
 * PostgreSQL Database Connection Module for AWS Lambda
 * RDS PostgreSQL接続とクエリ実行を管理
 */

import { Pool, PoolClient, QueryResult } from 'pg';

// グローバルな接続プールをLambda実行コンテキスト間で再利用
let pool: Pool | null = null;

/**
 * PostgreSQL接続プールの初期化
 */
export function initializePool(): Pool {
  if (!pool) {
    pool = new Pool({
      host: process.env.DB_HOST || 'localhost',
      port: parseInt(process.env.DB_PORT || '5432'),
      database: process.env.DB_NAME || 'nomine',
      user: process.env.DB_USER || 'postgres',
      password: process.env.DB_PASSWORD || '',
      max: 10, // 最大接続数
      idleTimeoutMillis: 30000, // アイドルタイムアウト
      connectionTimeoutMillis: 2000, // 接続タイムアウト
      ssl: process.env.DB_SSL === 'true' ? { rejectUnauthorized: false } : false
    });

    // エラーハンドリング
    pool.on('error', (err) => {
      console.error('Unexpected error on idle PostgreSQL client', err);
    });
  }

  return pool;
}

/**
 * データベース接続プールを取得
 */
export function getPool(): Pool {
  if (!pool) {
    return initializePool();
  }
  return pool;
}

/**
 * 単一クエリの実行
 */
export async function query<T = any>(
  text: string,
  params?: any[]
): Promise<QueryResult<T>> {
  const pool = getPool();
  return pool.query<T>(text, params);
}

/**
 * トランザクション実行
 */
export async function transaction<T>(
  callback: (client: PoolClient) => Promise<T>
): Promise<T> {
  const pool = getPool();
  const client = await pool.connect();

  try {
    await client.query('BEGIN');
    const result = await callback(client);
    await client.query('COMMIT');
    return result;
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
}

/**
 * Lambda終了時のクリーンアップ
 */
export async function closePool(): Promise<void> {
  if (pool) {
    await pool.end();
    pool = null;
  }
}

// ========================
// ユーザー関連クエリ
// ========================

export interface User {
  id: number;
  email: string;
  password_hash: string;
  name: string;
  role: 'master_admin' | 'tenant_admin' | 'user';
  created_at: string;
  updated_at: string;
}

export async function getUserByEmail(email: string): Promise<User | null> {
  const result = await query<User>(
    'SELECT * FROM users WHERE email = $1 LIMIT 1',
    [email]
  );
  return result.rows[0] || null;
}

export async function getUserById(id: number): Promise<User | null> {
  const result = await query<User>(
    'SELECT * FROM users WHERE id = $1 LIMIT 1',
    [id]
  );
  return result.rows[0] || null;
}

export async function createUser(
  email: string,
  password_hash: string,
  name: string,
  role: 'master_admin' | 'tenant_admin' | 'user' = 'user'
): Promise<User> {
  const result = await query<User>(
    `INSERT INTO users (email, password_hash, name, role)
     VALUES ($1, $2, $3, $4)
     RETURNING *`,
    [email, password_hash, name, role]
  );
  return result.rows[0];
}

// ========================
// セッション関連クエリ
// ========================

export interface Session {
  id: number;
  user_id: number;
  session_token: string;
  expires_at: string;
  created_at: string;
}

export async function createSession(
  userId: number,
  sessionToken: string,
  expiresAt: Date
): Promise<Session> {
  const result = await query<Session>(
    `INSERT INTO sessions (user_id, session_token, expires_at)
     VALUES ($1, $2, $3)
     RETURNING *`,
    [userId, sessionToken, expiresAt.toISOString()]
  );
  return result.rows[0];
}

export async function getSessionByToken(token: string): Promise<Session | null> {
  const result = await query<Session>(
    `SELECT * FROM sessions 
     WHERE session_token = $1 AND expires_at > NOW()
     LIMIT 1`,
    [token]
  );
  return result.rows[0] || null;
}

export async function deleteSession(token: string): Promise<void> {
  await query('DELETE FROM sessions WHERE session_token = $1', [token]);
}

export async function cleanupExpiredSessions(): Promise<void> {
  await query('DELETE FROM sessions WHERE expires_at < NOW()');
}

// ========================
// テナント関連クエリ
// ========================

export interface Tenant {
  id: number;
  name: string;
  owner_user_id: number;
  created_at: string;
  updated_at: string;
}

export async function getTenantById(id: number): Promise<Tenant | null> {
  const result = await query<Tenant>(
    'SELECT * FROM tenants WHERE id = $1 LIMIT 1',
    [id]
  );
  return result.rows[0] || null;
}

export async function createTenant(name: string, ownerUserId: number): Promise<Tenant> {
  const result = await query<Tenant>(
    `INSERT INTO tenants (name, owner_user_id)
     VALUES ($1, $2)
     RETURNING *`,
    [name, ownerUserId]
  );
  return result.rows[0];
}

export async function getAllTenants(): Promise<Tenant[]> {
  const result = await query<Tenant>('SELECT * FROM tenants ORDER BY created_at DESC');
  return result.rows;
}

// ========================
// テナントメンバー関連クエリ
// ========================

export interface TenantMember {
  id: number;
  tenant_id: number;
  user_id: number;
  role: 'admin' | 'member';
  created_at: string;
}

export async function getTenantMembersByUserId(userId: number): Promise<TenantMember[]> {
  const result = await query<TenantMember>(
    'SELECT * FROM tenant_members WHERE user_id = $1',
    [userId]
  );
  return result.rows;
}

export async function addTenantMember(
  tenantId: number,
  userId: number,
  role: 'admin' | 'member' = 'member'
): Promise<TenantMember> {
  const result = await query<TenantMember>(
    `INSERT INTO tenant_members (tenant_id, user_id, role)
     VALUES ($1, $2, $3)
     RETURNING *`,
    [tenantId, userId, role]
  );
  return result.rows[0];
}

// ========================
// 店舗関連クエリ
// ========================

export interface Store {
  id: number;
  tenant_id: number;
  name: string;
  display_name: string;
  business_start_time: string;
  business_end_time: string;
  enable_instagram_link: boolean;
  reward_text: string | null;
  template_type: string;
  created_at: string;
  updated_at: string;
}

export async function getStoreById(id: number): Promise<Store | null> {
  const result = await query<Store>(
    'SELECT * FROM stores WHERE id = $1 LIMIT 1',
    [id]
  );
  return result.rows[0] || null;
}

export async function getStoresByTenantId(tenantId: number): Promise<Store[]> {
  const result = await query<Store>(
    'SELECT * FROM stores WHERE tenant_id = $1 ORDER BY created_at DESC',
    [tenantId]
  );
  return result.rows;
}

export async function createStore(storeData: {
  tenant_id: number;
  name: string;
  display_name: string;
  business_start_time: string;
  business_end_time: string;
  template_type?: string;
}): Promise<Store> {
  const result = await query<Store>(
    `INSERT INTO stores 
     (tenant_id, name, display_name, business_start_time, business_end_time, template_type)
     VALUES ($1, $2, $3, $4, $5, $6)
     RETURNING *`,
    [
      storeData.tenant_id,
      storeData.name,
      storeData.display_name,
      storeData.business_start_time,
      storeData.business_end_time,
      storeData.template_type || 'default'
    ]
  );
  return result.rows[0];
}

// ========================
// 投稿（Submission）関連クエリ
// ========================

export interface Submission {
  id: number;
  batch_id: number;
  store_id: number;
  file_key: string;
  media_type: 'photo' | 'video';
  thumbnail_key: string | null;
  instagram_account: string | null;
  consent_display: boolean;
  consent_instagram: boolean;
  uploaded_at: string;
  is_adopted: boolean;
  adopted_at: string | null;
}

export async function getSubmissionsByBatchId(batchId: number): Promise<Submission[]> {
  const result = await query<Submission>(
    'SELECT * FROM submissions WHERE batch_id = $1 ORDER BY uploaded_at DESC',
    [batchId]
  );
  return result.rows;
}

export async function createSubmission(data: {
  batch_id: number;
  store_id: number;
  file_key: string;
  media_type: 'photo' | 'video';
  thumbnail_key?: string;
  instagram_account?: string;
  consent_display: boolean;
  consent_instagram: boolean;
}): Promise<Submission> {
  const result = await query<Submission>(
    `INSERT INTO submissions 
     (batch_id, store_id, file_key, media_type, thumbnail_key, 
      instagram_account, consent_display, consent_instagram)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
     RETURNING *`,
    [
      data.batch_id,
      data.store_id,
      data.file_key,
      data.media_type,
      data.thumbnail_key || null,
      data.instagram_account || null,
      data.consent_display,
      data.consent_instagram
    ]
  );
  return result.rows[0];
}

export async function markSubmissionAsAdopted(submissionId: number): Promise<void> {
  await query(
    `UPDATE submissions 
     SET is_adopted = true, adopted_at = NOW()
     WHERE id = $1`,
    [submissionId]
  );
}

// ========================
// 営業日関連クエリ
// ========================

export interface BusinessDay {
  id: number;
  store_id: number;
  business_date: string;
  start_datetime: string;
  end_datetime: string;
  is_closed: boolean;
  created_at: string;
}

export async function getOrCreateBusinessDay(
  storeId: number,
  businessDate: string,
  startDatetime: string,
  endDatetime: string
): Promise<BusinessDay> {
  // 既存の営業日を検索
  const existing = await query<BusinessDay>(
    'SELECT * FROM business_days WHERE store_id = $1 AND business_date = $2 LIMIT 1',
    [storeId, businessDate]
  );

  if (existing.rows.length > 0) {
    return existing.rows[0];
  }

  // 新規作成
  const result = await query<BusinessDay>(
    `INSERT INTO business_days 
     (store_id, business_date, start_datetime, end_datetime, is_closed)
     VALUES ($1, $2, $3, $4, false)
     RETURNING *`,
    [storeId, businessDate, startDatetime, endDatetime]
  );
  return result.rows[0];
}

// ========================
// AI採点関連クエリ
// ========================

export interface AIScore {
  id: number;
  submission_id: number;
  total_score: number;
  detail_json: string;
  scored_at: string;
}

export async function saveAIScore(
  submissionId: number,
  totalScore: number,
  detailJson: object
): Promise<AIScore> {
  const result = await query<AIScore>(
    `INSERT INTO ai_scores (submission_id, total_score, detail_json)
     VALUES ($1, $2, $3)
     RETURNING *`,
    [submissionId, totalScore, JSON.stringify(detailJson)]
  );
  return result.rows[0];
}

export async function getAIScoreBySubmissionId(submissionId: number): Promise<AIScore | null> {
  const result = await query<AIScore>(
    'SELECT * FROM ai_scores WHERE submission_id = $1 LIMIT 1',
    [submissionId]
  );
  return result.rows[0] || null;
}
