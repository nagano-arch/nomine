import { Hono } from 'hono';
import type { Bindings, User, Store, Submission, AIScore } from '../types';
import { authMiddleware } from '../middleware';
import { canAccessStore, canManageStore } from '../rbac';
import { getCurrentBusinessDay, getDailySettings, isBusinessHours } from '../utils/business-day';
import { generateQRToken, safeErrorMessage } from '../utils/validators';

const stores = new Hono<{ Bindings: Bindings }>();

/**
 * 店舗ダッシュボード
 * GET /api/stores/:id/dashboard
 */
stores.get('/:id/dashboard', async (c) => {
  try {
    const storeId = parseInt(c.req.param('id'));
    const user = c.get('user') as User;
    const { DB, MASTER_ADMIN_EMAIL } = c.env;

    // アクセス権チェック
    const hasAccess = await canAccessStore(DB, user, storeId, MASTER_ADMIN_EMAIL);
    if (!hasAccess) {
      return c.json(errorResponse('この店舗にアクセスする権限がありません'), 403);
    }

    // 店舗情報取得
    const store = await DB
      .prepare('SELECT * FROM stores WHERE id = ?')
      .bind(storeId)
      .first<Store>();

    if (!store) {
      return c.json(errorResponse('店舗が見つかりません'), 404);
    }

    // 当日の営業日取得
    const businessDay = await getOrCreateBusinessDay(DB, store);

    // 当日のエントリー統計
    const stats = await DB
      .prepare(`
        SELECT 
          COUNT(*) as total_entries,
          SUM(CASE WHEN submission_type = 'photo' THEN 1 ELSE 0 END) as photo_count,
          SUM(CASE WHEN submission_type = 'video' THEN 1 ELSE 0 END) as video_count,
          SUM(CASE WHEN status = 'adopted' AND submission_type = 'photo' THEN 1 ELSE 0 END) as photo_adopted,
          SUM(CASE WHEN status = 'adopted' AND submission_type = 'video' THEN 1 ELSE 0 END) as video_adopted
        FROM submissions
        WHERE store_id = ? AND business_day_id = ?
      `)
      .bind(storeId, businessDay.id)
      .first();

    // 直近のエントリー取得
    const recentSubmissions = await DB
      .prepare(`
        SELECT 
          s.*,
          st.table_name,
          ai.total_score,
          ai.ai_comment
        FROM submissions s
        LEFT JOIN store_tables st ON s.table_id = st.id
        LEFT JOIN ai_scores ai ON s.id = ai.submission_id
        WHERE s.store_id = ? AND s.business_day_id = ?
        ORDER BY s.created_at DESC
        LIMIT 10
      `)
      .bind(storeId, businessDay.id)
      .all();

    return c.json(
      successResponse({
        store,
        business_day: businessDay,
        stats,
        recent_submissions: recentSubmissions.results || []
      })
    );
  } catch (error) {
    console.error('Dashboard error:', error);
    return c.json(errorResponse('ダッシュボードの取得に失敗しました'), 500);
  }
});

/**
 * エントリー一覧取得
 * GET /api/stores/:id/submissions
 */
stores.get('/:id/submissions', async (c) => {
  try {
    const storeId = parseInt(c.req.param('id'));
    const user = c.get('user') as User;
    const { DB, MASTER_ADMIN_EMAIL } = c.env;

    // クエリパラメータ
    const type = c.req.query('type'); // photo, video
    const status = c.req.query('status'); // pending, adopted
    const businessDayId = c.req.query('business_day_id');

    // アクセス権チェック
    const hasAccess = await canAccessStore(DB, user, storeId, MASTER_ADMIN_EMAIL);
    if (!hasAccess) {
      return c.json(errorResponse('この店舗にアクセスする権限がありません'), 403);
    }

    // クエリ構築
    let query = `
      SELECT 
        s.*,
        st.table_name,
        st.table_code,
        sb.instagram_account,
        ai.sizzle_score,
        ai.composition_score,
        ai.liveliness_score,
        ai.official_fit_score,
        ai.total_score,
        ai.ai_comment,
        a.reward_text as adopted_reward
      FROM submissions s
      LEFT JOIN store_tables st ON s.table_id = st.id
      LEFT JOIN submission_batches sb ON s.batch_id = sb.id
      LEFT JOIN ai_scores ai ON s.id = ai.submission_id
      LEFT JOIN adoptions a ON s.id = a.submission_id
      WHERE s.store_id = ?
    `;

    const params: any[] = [storeId];

    if (type) {
      query += ' AND s.submission_type = ?';
      params.push(type);
    }

    if (status) {
      query += ' AND s.status = ?';
      params.push(status);
    }

    if (businessDayId) {
      query += ' AND s.business_day_id = ?';
      params.push(parseInt(businessDayId));
    }

    query += ' ORDER BY s.created_at DESC LIMIT 100';

    const result = await DB.prepare(query).bind(...params).all();

    return c.json(successResponse({ submissions: result.results || [] }));
  } catch (error) {
    console.error('Get submissions error:', error);
    return c.json(errorResponse('エントリー一覧の取得に失敗しました'), 500);
  }
});

/**
 * エントリー詳細取得
 * GET /api/stores/:id/submissions/:submissionId
 */
stores.get('/:id/submissions/:submissionId', async (c) => {
  try {
    const storeId = parseInt(c.req.param('id'));
    const submissionId = parseInt(c.req.param('submissionId'));
    const user = c.get('user') as User;
    const { DB, MASTER_ADMIN_EMAIL } = c.env;

    // アクセス権チェック
    const hasAccess = await canAccessStore(DB, user, storeId, MASTER_ADMIN_EMAIL);
    if (!hasAccess) {
      return c.json(errorResponse('この店舗にアクセスする権限がありません'), 403);
    }

    const submission = await DB
      .prepare(`
        SELECT 
          s.*,
          st.table_name,
          st.table_code,
          sb.instagram_account,
          ai.sizzle_score,
          ai.composition_score,
          ai.liveliness_score,
          ai.official_fit_score,
          ai.total_score,
          ai.ai_comment,
          a.reward_text as adopted_reward,
          a.adopted_at
        FROM submissions s
        LEFT JOIN store_tables st ON s.table_id = st.id
        LEFT JOIN submission_batches sb ON s.batch_id = sb.id
        LEFT JOIN ai_scores ai ON s.id = ai.submission_id
        LEFT JOIN adoptions a ON s.id = a.submission_id
        WHERE s.id = ? AND s.store_id = ?
      `)
      .bind(submissionId, storeId)
      .first();

    if (!submission) {
      return c.json(errorResponse('エントリーが見つかりません'), 404);
    }

    return c.json(successResponse({ submission }));
  } catch (error) {
    console.error('Get submission error:', error);
    return c.json(errorResponse('エントリー詳細の取得に失敗しました'), 500);
  }
});

/**
 * エントリーを選出（採用）
 * POST /api/stores/:id/submissions/:submissionId/adopt
 */
stores.post('/:id/submissions/:submissionId/adopt', async (c) => {
  try {
    const storeId = parseInt(c.req.param('id'));
    const submissionId = parseInt(c.req.param('submissionId'));
    const user = c.get('user') as User;
    const { DB, MASTER_ADMIN_EMAIL } = c.env;

    // 管理権限チェック
    const canManage = await canManageStore(DB, user, storeId, MASTER_ADMIN_EMAIL);
    if (!canManage) {
      return c.json(errorResponse('この操作を実行する権限がありません'), 403);
    }

    // エントリー情報取得
    const submission = await DB
      .prepare('SELECT * FROM submissions WHERE id = ? AND store_id = ?')
      .bind(submissionId, storeId)
      .first<any>();

    if (!submission) {
      return c.json(errorResponse('エントリーが見つかりません'), 404);
    }

    if (submission.status === 'adopted') {
      return c.json(errorResponse('このエントリーは既に選出されています'), 400);
    }

    // 日次設定取得
    const dailySetting = await DB
      .prepare('SELECT * FROM daily_settings WHERE store_id = ? AND business_day_id = ?')
      .bind(storeId, submission.business_day_id)
      .first<any>();

    if (!dailySetting) {
      return c.json(errorResponse('日次設定が見つかりません'), 404);
    }

    // 上限チェック
    const type = submission.submission_type;
    const limitField = type === 'photo' ? 'photo_adopt_limit' : 'video_adopt_limit';
    const countField = type === 'photo' ? 'photo_adopted_count' : 'video_adopted_count';

    if (dailySetting[countField] >= dailySetting[limitField]) {
      return c.json(
        errorResponse(`本日の${type === 'photo' ? '写真' : '動画'}選出上限に達しています`),
        400
      );
    }

    // トランザクション的に処理
    // 1. エントリーステータス更新
    await DB
      .prepare('UPDATE submissions SET status = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?')
      .bind('adopted', submissionId)
      .run();

    // 2. 選出レコード作成
    const rewardText = type === 'photo' ? dailySetting.photo_reward_text : dailySetting.video_reward_text;
    await DB
      .prepare(
        'INSERT INTO adoptions (submission_id, store_id, reward_type, reward_text, adopted_by, adopted_at) VALUES (?, ?, ?, ?, ?, CURRENT_TIMESTAMP)'
      )
      .bind(submissionId, storeId, type, rewardText, user.id)
      .run();

    // 3. 日次設定のカウント更新
    await DB
      .prepare(`UPDATE daily_settings SET ${countField} = ${countField} + 1 WHERE id = ?`)
      .bind(dailySetting.id)
      .run();

    return c.json(successResponse(null, 'エントリーを選出しました'));
  } catch (error) {
    console.error('Adopt submission error:', error);
    return c.json(errorResponse('選出処理中にエラーが発生しました'), 500);
  }
});

/**
 * 店舗設定取得
 * GET /api/stores/:id/settings
 */
stores.get('/:id/settings', async (c) => {
  try {
    const storeId = parseInt(c.req.param('id'));
    const user = c.get('user') as User;
    const { DB, MASTER_ADMIN_EMAIL } = c.env;

    const hasAccess = await canAccessStore(DB, user, storeId, MASTER_ADMIN_EMAIL);
    if (!hasAccess) {
      return c.json(errorResponse('この店舗にアクセスする権限がありません'), 403);
    }

    const store = await DB
      .prepare('SELECT * FROM stores WHERE id = ?')
      .bind(storeId)
      .first<Store>();

    if (!store) {
      return c.json(errorResponse('店舗が見つかりません'), 404);
    }

    // テンプレート設定取得
    const template = await DB
      .prepare('SELECT * FROM template_configs WHERE store_id = ?')
      .bind(storeId)
      .first();

    return c.json(successResponse({ store, template }));
  } catch (error) {
    console.error('Get settings error:', error);
    return c.json(errorResponse('設定の取得に失敗しました'), 500);
  }
});

/**
 * 店舗設定更新
 * PUT /api/stores/:id/settings
 */
stores.put('/:id/settings', async (c) => {
  try {
    const storeId = parseInt(c.req.param('id'));
    const user = c.get('user') as User;
    const { DB, MASTER_ADMIN_EMAIL } = c.env;

    const canManage = await canManageStore(DB, user, storeId, MASTER_ADMIN_EMAIL);
    if (!canManage) {
      return c.json(errorResponse('この操作を実行する権限がありません'), 403);
    }

    const body = await c.req.json();

    // 更新可能なフィールド
    const updates: string[] = [];
    const params: any[] = [];

    if (body.name) {
      updates.push('name = ?');
      params.push(body.name);
    }
    if (body.business_type) {
      updates.push('business_type = ?');
      params.push(body.business_type);
    }
    if (body.business_open_time) {
      updates.push('business_open_time = ?');
      params.push(body.business_open_time);
    }
    if (body.business_close_time) {
      updates.push('business_close_time = ?');
      params.push(body.business_close_time);
    }
    if (body.photo_reward_text) {
      updates.push('photo_reward_text = ?');
      params.push(body.photo_reward_text);
    }
    if (body.video_reward_text) {
      updates.push('video_reward_text = ?');
      params.push(body.video_reward_text);
    }
    if (body.photo_adopt_limit !== undefined) {
      updates.push('photo_adopt_limit = ?');
      params.push(body.photo_adopt_limit);
    }
    if (body.video_adopt_limit !== undefined) {
      updates.push('video_adopt_limit = ?');
      params.push(body.video_adopt_limit);
    }

    if (updates.length === 0) {
      return c.json(errorResponse('更新する項目がありません'), 400);
    }

    updates.push('updated_at = CURRENT_TIMESTAMP');
    params.push(storeId);

    await DB
      .prepare(`UPDATE stores SET ${updates.join(', ')} WHERE id = ?`)
      .bind(...params)
      .run();

    return c.json(successResponse(null, '設定を更新しました'));
  } catch (error) {
    console.error('Update settings error:', error);
    return c.json(errorResponse('設定の更新に失敗しました'), 500);
  }
});

/**
 * テーブル一覧取得
 * GET /api/stores/:id/tables
 */
stores.get('/:id/tables', async (c) => {
  try {
    const storeId = parseInt(c.req.param('id'));
    const user = c.get('user') as User;
    const { DB, MASTER_ADMIN_EMAIL } = c.env;

    const hasAccess = await canAccessStore(DB, user, storeId, MASTER_ADMIN_EMAIL);
    if (!hasAccess) {
      return c.json(errorResponse('この店舗にアクセスする権限がありません'), 403);
    }

    const result = await DB
      .prepare('SELECT * FROM store_tables WHERE store_id = ? ORDER BY table_code')
      .bind(storeId)
      .all();

    return c.json(successResponse({ tables: result.results || [] }));
  } catch (error) {
    console.error('Get tables error:', error);
    return c.json(errorResponse('テーブル一覧の取得に失敗しました'), 500);
  }
});

/**
 * テーブル作成
 * POST /api/stores/:id/tables
 */
stores.post('/:id/tables', async (c) => {
  try {
    const storeId = parseInt(c.req.param('id'));
    const user = c.get('user') as User;
    const { DB, MASTER_ADMIN_EMAIL } = c.env;

    const canManage = await canManageStore(DB, user, storeId, MASTER_ADMIN_EMAIL);
    if (!canManage) {
      return c.json(errorResponse('この操作を実行する権限がありません'), 403);
    }

    const { table_code, table_name } = await c.req.json();

    if (!table_code || !table_name) {
      return c.json(errorResponse('テーブルコードとテーブル名は必須です'), 400);
    }

    // QRトークン生成
    const qrToken = generateQRToken();

    const table = await DB
      .prepare(
        'INSERT INTO store_tables (store_id, table_code, table_name, qr_token) VALUES (?, ?, ?, ?) RETURNING *'
      )
      .bind(storeId, table_code, table_name, qrToken)
      .first();

    return c.json(successResponse({ table }, 'テーブルを作成しました'), 201);
  } catch (error) {
    console.error('Create table error:', error);
    return c.json(errorResponse('テーブルの作成に失敗しました'), 500);
  }
});

export default stores;
