import { Hono } from 'hono';
import type { Bindings, User, Tenant } from '../types';
import { authMiddleware, masterAdminMiddleware } from '../middleware';
import { createUser } from '../auth';
import { safeErrorMessage } from '../utils/validators';

const admin = new Hono<{ Bindings: Bindings }>();

// すべてのルートに認証を適用
admin.use('*', authMiddleware);
admin.use('*', masterAdminMiddleware);

/**
 * すべてのテナント一覧取得
 */
admin.get('/tenants', async (c) => {
  try {
    const { DB } = c.env;

    const result = await DB.prepare(`
      SELECT t.*, u.email as owner_email, u.name as owner_name
      FROM tenants t
      LEFT JOIN users u ON t.owner_id = u.id
      ORDER BY t.created_at DESC
    `).all();

    return c.json({
      success: true,
      tenants: result.results || []
    });
  } catch (error) {
    console.error('Get tenants error:', error);
    return c.json({ error: safeErrorMessage(error) }, 500);
  }
});

/**
 * 新規テナント作成
 */
admin.post('/tenants', async (c) => {
  try {
    const { name, ownerEmail, ownerPassword, ownerName } = await c.req.json();

    if (!name || !ownerEmail || !ownerPassword) {
      return c.json({ error: 'Name, owner email, and password are required' }, 400);
    }

    const { DB } = c.env;
    const user = c.get('user') as User;

    // オーナーユーザーを作成
    const owner = await createUser(DB, ownerEmail, ownerPassword, 'user', ownerName);

    // テナント作成
    const tenant = await DB.prepare(
      'INSERT INTO tenants (name, owner_id, created_by_master) VALUES (?, ?, 1) RETURNING *'
    )
      .bind(name, owner.id)
      .first<Tenant>();

    if (!tenant) {
      throw new Error('Failed to create tenant');
    }

    // テナントメンバーに追加（tenant_admin）
    await DB.prepare(
      'INSERT INTO tenant_members (tenant_id, user_id, role) VALUES (?, ?, ?)'
    )
      .bind(tenant.id, owner.id, 'tenant_admin')
      .run();

    return c.json({
      success: true,
      tenant,
      owner: {
        id: owner.id,
        email: owner.email,
        name: owner.name
      }
    }, 201);
  } catch (error) {
    console.error('Create tenant error:', error);
    return c.json({ error: safeErrorMessage(error) }, 500);
  }
});

/**
 * テナント削除
 */
admin.delete('/tenants/:id', async (c) => {
  try {
    const tenantId = parseInt(c.req.param('id'), 10);

    if (isNaN(tenantId)) {
      return c.json({ error: 'Invalid tenant ID' }, 400);
    }

    const { DB } = c.env;

    // テナント削除（CASCADE で関連データも削除される）
    const result = await DB.prepare('DELETE FROM tenants WHERE id = ?')
      .bind(tenantId)
      .run();

    if (result.meta.changes === 0) {
      return c.json({ error: 'Tenant not found' }, 404);
    }

    return c.json({ success: true, message: 'Tenant deleted successfully' });
  } catch (error) {
    console.error('Delete tenant error:', error);
    return c.json({ error: safeErrorMessage(error) }, 500);
  }
});

/**
 * すべてのユーザー一覧取得
 */
admin.get('/users', async (c) => {
  try {
    const { DB } = c.env;

    const result = await DB.prepare(`
      SELECT id, email, role, name, created_at, updated_at
      FROM users
      ORDER BY created_at DESC
    `).all();

    return c.json({
      success: true,
      users: result.results || []
    });
  } catch (error) {
    console.error('Get users error:', error);
    return c.json({ error: safeErrorMessage(error) }, 500);
  }
});

export default admin;
