import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import type { User, Session, Bindings } from './types';

/**
 * パスワードをハッシュ化
 */
export async function hashPassword(password: string): Promise<string> {
  return bcrypt.hash(password, 10);
}

/**
 * パスワードを検証
 */
export async function verifyPassword(password: string, hash: string): Promise<boolean> {
  return bcrypt.compare(password, hash);
}

/**
 * JWTトークンを生成
 */
export function generateToken(userId: number, secret: string): string {
  return jwt.sign({ userId }, secret, { expiresIn: '7d' });
}

/**
 * JWTトークンを検証
 */
export function verifyToken(token: string, secret: string): { userId: number } | null {
  try {
    const decoded = jwt.verify(token, secret) as { userId: number };
    return decoded;
  } catch (error) {
    return null;
  }
}

/**
 * セッションを作成
 */
export async function createSession(
  db: D1Database,
  userId: number,
  token: string,
  expiryDays: number
): Promise<Session> {
  const expiresAt = new Date();
  expiresAt.setDate(expiresAt.getDate() + expiryDays);

  const result = await db
    .prepare(
      'INSERT INTO sessions (user_id, token, expires_at) VALUES (?, ?, ?) RETURNING *'
    )
    .bind(userId, token, expiresAt.toISOString())
    .first<Session>();

  if (!result) {
    throw new Error('Failed to create session');
  }

  return result;
}

/**
 * セッションを検証
 */
export async function validateSession(
  db: D1Database,
  token: string
): Promise<Session | null> {
  const session = await db
    .prepare('SELECT * FROM sessions WHERE token = ? AND expires_at > datetime("now")')
    .bind(token)
    .first<Session>();

  return session;
}

/**
 * セッションを削除
 */
export async function deleteSession(db: D1Database, token: string): Promise<void> {
  await db.prepare('DELETE FROM sessions WHERE token = ?').bind(token).run();
}

/**
 * ユーザーを取得
 */
export async function getUserById(db: D1Database, userId: number): Promise<User | null> {
  return await db
    .prepare('SELECT * FROM users WHERE id = ?')
    .bind(userId)
    .first<User>();
}

/**
 * メールアドレスでユーザーを取得
 */
export async function getUserByEmail(db: D1Database, email: string): Promise<User | null> {
  return await db
    .prepare('SELECT * FROM users WHERE email = ?')
    .bind(email)
    .first<User>();
}

/**
 * ユーザーを作成
 */
export async function createUser(
  db: D1Database,
  email: string,
  password: string,
  role: string = 'user',
  name?: string
): Promise<User> {
  const passwordHash = await hashPassword(password);

  const result = await db
    .prepare(
      'INSERT INTO users (email, password_hash, role, name) VALUES (?, ?, ?, ?) RETURNING *'
    )
    .bind(email, passwordHash, role, name || null)
    .first<User>();

  if (!result) {
    throw new Error('Failed to create user');
  }

  return result;
}
