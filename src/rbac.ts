import type { User, Tenant, TenantMember, Role } from './types';

/**
 * マスター管理者かどうかチェック
 */
export function isMasterAdmin(user: User, masterEmail: string): boolean {
  return user.email === masterEmail && user.role === 'master_admin';
}

/**
 * テナント管理者かどうかチェック
 */
export function isTenantAdmin(tenantMember?: TenantMember): boolean {
  return tenantMember?.role === 'tenant_admin';
}

/**
 * 指定されたテナントにアクセス可能かチェック
 */
export async function canAccessTenant(
  db: D1Database,
  user: User,
  tenantId: number,
  masterEmail: string
): Promise<boolean> {
  // マスター管理者は全テナントアクセス可能
  if (isMasterAdmin(user, masterEmail)) {
    return true;
  }

  // テナントメンバーシップを確認
  const member = await db
    .prepare('SELECT * FROM tenant_members WHERE user_id = ? AND tenant_id = ?')
    .bind(user.id, tenantId)
    .first<TenantMember>();

  return !!member;
}

/**
 * 指定されたテナントを管理可能かチェック
 */
export async function canManageTenant(
  db: D1Database,
  user: User,
  tenantId: number,
  masterEmail: string
): Promise<boolean> {
  // マスター管理者は全テナント管理可能
  if (isMasterAdmin(user, masterEmail)) {
    return true;
  }

  // テナント管理者権限を確認
  const member = await db
    .prepare('SELECT * FROM tenant_members WHERE user_id = ? AND tenant_id = ?')
    .bind(user.id, tenantId)
    .first<TenantMember>();

  return isTenantAdmin(member);
}

/**
 * 指定された店舗にアクセス可能かチェック
 */
export async function canAccessStore(
  db: D1Database,
  user: User,
  storeId: number,
  masterEmail: string
): Promise<boolean> {
  // マスター管理者は全店舗アクセス可能
  if (isMasterAdmin(user, masterEmail)) {
    return true;
  }

  // 店舗が所属するテナントを取得
  const store = await db
    .prepare('SELECT tenant_id FROM stores WHERE id = ?')
    .bind(storeId)
    .first<{ tenant_id: number }>();

  if (!store) {
    return false;
  }

  // テナントへのアクセス権を確認
  return canAccessTenant(db, user, store.tenant_id, masterEmail);
}

/**
 * 指定された店舗を管理可能かチェック
 */
export async function canManageStore(
  db: D1Database,
  user: User,
  storeId: number,
  masterEmail: string
): Promise<boolean> {
  // マスター管理者は全店舗管理可能
  if (isMasterAdmin(user, masterEmail)) {
    return true;
  }

  // 店舗が所属するテナントを取得
  const store = await db
    .prepare('SELECT tenant_id FROM stores WHERE id = ?')
    .bind(storeId)
    .first<{ tenant_id: number }>();

  if (!store) {
    return false;
  }

  // テナント管理者権限を確認
  return canManageTenant(db, user, store.tenant_id, masterEmail);
}

/**
 * ユーザーのテナントメンバーシップを取得
 */
export async function getUserTenantMembership(
  db: D1Database,
  userId: number,
  tenantId: number
): Promise<TenantMember | null> {
  return await db
    .prepare('SELECT * FROM tenant_members WHERE user_id = ? AND tenant_id = ?')
    .bind(userId, tenantId)
    .first<TenantMember>();
}

/**
 * ユーザーが所属するすべてのテナントを取得
 */
export async function getUserTenants(
  db: D1Database,
  userId: number
): Promise<Tenant[]> {
  const result = await db
    .prepare(`
      SELECT t.* FROM tenants t
      INNER JOIN tenant_members tm ON t.id = tm.tenant_id
      WHERE tm.user_id = ?
      ORDER BY t.created_at DESC
    `)
    .bind(userId)
    .all<Tenant>();

  return result.results || [];
}
