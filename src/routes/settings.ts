import { Hono } from 'hono';
import type { Bindings, User, Store, StoreTable } from '../types';
import { authMiddleware } from '../middleware';
import { canAccessStore, canManageStore } from '../rbac';
import { generateQRToken, safeErrorMessage } from '../utils/validators';
import QRCode from 'qrcode';

const settings = new Hono<{ Bindings: Bindings }>();

// すべてのルートに認証を適用
settings.use('*', authMiddleware);

/**
 * 店舗設定取得
 */
settings.get('/:id/settings', async (c) => {
  try {
    const storeId = parseInt(c.req.param('id'), 10);
    const { DB, MASTER_ADMIN_EMAIL } = c.env;
    const user = c.get('user') as User;

    const hasAccess = await canAccessStore(DB, user, storeId, MASTER_ADMIN_EMAIL);
    if (!hasAccess) {
      return c.json({ error: 'Forbidden' }, 403);
    }

    const store = await DB.prepare('SELECT * FROM stores WHERE id = ?')
      .bind(storeId)
      .first<Store>();

    if (!store) {
      return c.json({ error: 'Store not found' }, 404);
    }

    // テンプレート設定取得
    const templateConfig = await DB.prepare('SELECT * FROM template_configs WHERE store_id = ?')
      .bind(storeId)
      .first();

    return c.json({
      success: true,
      store,
      template_config: templateConfig
    });
  } catch (error) {
    console.error('Get settings error:', error);
    return c.json({ error: safeErrorMessage(error) }, 500);
  }
});

/**
 * 店舗設定更新
 */
settings.put('/:id/settings', async (c) => {
  try {
    const storeId = parseInt(c.req.param('id'), 10);
    const { DB, MASTER_ADMIN_EMAIL } = c.env;
    const user = c.get('user') as User;

    const canManage = await canManageStore(DB, user, storeId, MASTER_ADMIN_EMAIL);
    if (!canManage) {
      return c.json({ error: 'Forbidden' }, 403);
    }

    const {
      name,
      business_type,
      template_type,
      business_open_time,
      business_close_time,
      photo_reward_text,
      video_reward_text,
      photo_adopt_limit,
      video_adopt_limit
    } = await c.req.json();

    // 更新
    await DB.prepare(`
      UPDATE stores SET
        name = ?,
        business_type = ?,
        template_type = ?,
        business_open_time = ?,
        business_close_time = ?,
        photo_reward_text = ?,
        video_reward_text = ?,
        photo_adopt_limit = ?,
        video_adopt_limit = ?,
        updated_at = datetime('now')
      WHERE id = ?
    `)
      .bind(
        name,
        business_type,
        template_type,
        business_open_time,
        business_close_time,
        photo_reward_text,
        video_reward_text,
        photo_adopt_limit,
        video_adopt_limit,
        storeId
      )
      .run();

    const updated = await DB.prepare('SELECT * FROM stores WHERE id = ?')
      .bind(storeId)
      .first<Store>();

    return c.json({
      success: true,
      store: updated
    });
  } catch (error) {
    console.error('Update settings error:', error);
    return c.json({ error: safeErrorMessage(error) }, 500);
  }
});

/**
 * テーブル一覧取得
 */
settings.get('/:id/tables', async (c) => {
  try {
    const storeId = parseInt(c.req.param('id'), 10);
    const { DB, MASTER_ADMIN_EMAIL } = c.env;
    const user = c.get('user') as User;

    const hasAccess = await canAccessStore(DB, user, storeId, MASTER_ADMIN_EMAIL);
    if (!hasAccess) {
      return c.json({ error: 'Forbidden' }, 403);
    }

    const result = await DB.prepare('SELECT * FROM store_tables WHERE store_id = ? ORDER BY table_code')
      .bind(storeId)
      .all();

    return c.json({
      success: true,
      tables: result.results || []
    });
  } catch (error) {
    console.error('Get tables error:', error);
    return c.json({ error: safeErrorMessage(error) }, 500);
  }
});

/**
 * テーブル作成
 */
settings.post('/:id/tables', async (c) => {
  try {
    const storeId = parseInt(c.req.param('id'), 10);
    const { DB, MASTER_ADMIN_EMAIL } = c.env;
    const user = c.get('user') as User;

    const canManage = await canManageStore(DB, user, storeId, MASTER_ADMIN_EMAIL);
    if (!canManage) {
      return c.json({ error: 'Forbidden' }, 403);
    }

    const { table_code, table_name } = await c.req.json();

    if (!table_code || !table_name) {
      return c.json({ error: 'Table code and name are required' }, 400);
    }

    // QRトークン生成
    const qrToken = generateQRToken();

    const table = await DB.prepare(
      'INSERT INTO store_tables (store_id, table_code, table_name, qr_token) VALUES (?, ?, ?, ?) RETURNING *'
    )
      .bind(storeId, table_code, table_name, qrToken)
      .first<StoreTable>();

    return c.json({
      success: true,
      table
    }, 201);
  } catch (error) {
    console.error('Create table error:', error);
    return c.json({ error: safeErrorMessage(error) }, 500);
  }
});

/**
 * テーブルQRコード取得
 */
settings.get('/:id/tables/:tableId/qr', async (c) => {
  try {
    const storeId = parseInt(c.req.param('id'), 10);
    const tableId = parseInt(c.req.param('tableId'), 10);
    const { DB, MASTER_ADMIN_EMAIL } = c.env;
    const user = c.get('user') as User;

    const hasAccess = await canAccessStore(DB, user, storeId, MASTER_ADMIN_EMAIL);
    if (!hasAccess) {
      return c.json({ error: 'Forbidden' }, 403);
    }

    const table = await DB.prepare('SELECT * FROM store_tables WHERE id = ? AND store_id = ?')
      .bind(tableId, storeId)
      .first<StoreTable>();

    if (!table) {
      return c.json({ error: 'Table not found' }, 404);
    }

    // QRコードURL生成（実際のドメインに置き換え）
    const qrUrl = `https://nomine.app/entry/${table.qr_token}`;

    // QRコード画像生成
    const qrImage = await QRCode.toDataURL(qrUrl, {
      width: 512,
      margin: 2,
      color: {
        dark: '#000000',
        light: '#FFFFFF'
      }
    });

    return c.json({
      success: true,
      table,
      qr_url: qrUrl,
      qr_image: qrImage
    });
  } catch (error) {
    console.error('Get QR code error:', error);
    return c.json({ error: safeErrorMessage(error) }, 500);
  }
});

/**
 * テーブルQRトークン再発行
 */
settings.post('/:id/tables/:tableId/regenerate-qr', async (c) => {
  try {
    const storeId = parseInt(c.req.param('id'), 10);
    const tableId = parseInt(c.req.param('tableId'), 10);
    const { DB, MASTER_ADMIN_EMAIL } = c.env;
    const user = c.get('user') as User;

    const canManage = await canManageStore(DB, user, storeId, MASTER_ADMIN_EMAIL);
    if (!canManage) {
      return c.json({ error: 'Forbidden' }, 403);
    }

    // 新しいQRトークン生成
    const qrToken = generateQRToken();

    await DB.prepare('UPDATE store_tables SET qr_token = ?, updated_at = datetime("now") WHERE id = ? AND store_id = ?')
      .bind(qrToken, tableId, storeId)
      .run();

    const updated = await DB.prepare('SELECT * FROM store_tables WHERE id = ?')
      .bind(tableId)
      .first<StoreTable>();

    return c.json({
      success: true,
      table: updated
    });
  } catch (error) {
    console.error('Regenerate QR error:', error);
    return c.json({ error: safeErrorMessage(error) }, 500);
  }
});

export default settings;
