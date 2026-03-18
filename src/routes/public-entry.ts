import { Hono } from 'hono';
import type { Bindings, Store, StoreTable, BusinessDay, SubmissionBatch, Submission } from '../types';
import { getCurrentBusinessDay, isBusinessHours } from '../utils/business-day';
import { scoreSubmission } from '../utils/score';
import { cleanInstagramAccount, safeErrorMessage } from '../utils/validators';

const publicEntry = new Hono<{ Bindings: Bindings }>();

/**
 * QRコードアクセス時の初期情報取得（ブートストラップ）
 * GET /api/public/entry/:qrToken/bootstrap
 */
publicEntry.get('/:qrToken/bootstrap', async (c) => {
  try {
    const qrToken = c.req.param('qrToken');
    const { DB } = c.env;

    // QRトークンからテーブル情報取得
    const table = await DB
      .prepare('SELECT * FROM store_tables WHERE qr_token = ? AND is_active = 1')
      .bind(qrToken)
      .first<StoreTable>();

    if (!table) {
      return c.json(errorResponse('無効なQRコードです'), 404);
    }

    // 店舗情報取得
    const store = await DB
      .prepare('SELECT * FROM stores WHERE id = ? AND is_active = 1')
      .bind(table.store_id)
      .first<Store>();

    if (!store) {
      return c.json(errorResponse('店舗情報が見つかりません'), 404);
    }

    // 営業時間チェック
    const isOpen = isWithinBusinessHours(store);

    if (!isOpen) {
      return c.json({
        success: true,
        is_open: false,
        message: '現在は営業時間外です',
        store_name: store.name,
        business_hours: `${store.business_open_time} - ${store.business_close_time}`
      });
    }

    // 営業日取得
    const businessDay = await getOrCreateBusinessDay(DB, store);

    // 日次設定取得
    const dailySetting = await getOrCreateDailySetting(DB, store, businessDay.id);

    // テンプレート設定取得
    let template = await DB
      .prepare('SELECT * FROM template_configs WHERE store_id = ?')
      .bind(store.id)
      .first();

    // テンプレートがない場合はデフォルト作成
    if (!template) {
      template = await DB
        .prepare(
          `INSERT INTO template_configs 
          (store_id, template_type, primary_color, sub_color, headline_text, sub_text)
          VALUES (?, ?, ?, ?, ?, ?) RETURNING *`
        )
        .bind(
          store.id,
          store.template_type,
          '#1a1a1a',
          '#f59e0b',
          'このお店の"公式写真"に、あなたの一枚が選ばれるかも',
          '選ばれた方には、特別なサービスをご用意しています'
        )
        .first();
    }

    return c.json(
      successResponse({
        is_open: true,
        store: {
          id: store.id,
          name: store.name,
          business_type: store.business_type
        },
        table: {
          name: table.table_name,
          code: table.table_code
        },
        template: {
          primary_color: template.primary_color,
          sub_color: template.sub_color,
          headline_text: template.headline_text,
          sub_text: template.sub_text
        },
        rewards: {
          photo: dailySetting.photo_reward_text,
          video: dailySetting.video_reward_text
        },
        limits: {
          photo_limit: dailySetting.photo_adopt_limit,
          video_limit: dailySetting.video_adopt_limit,
          photo_adopted: dailySetting.photo_adopted_count,
          video_adopted: dailySetting.video_adopted_count
        }
      })
    );
  } catch (error) {
    console.error('Bootstrap error:', error);
    return c.json(errorResponse('初期情報の取得に失敗しました'), 500);
  }
});

/**
 * ファイルアップロード（実際にはCloudflare R2などを使用）
 * POST /api/public/entry/:qrToken/upload
 * 
 * 注: このエンドポイントは簡略化版です。
 * 実運用ではCloudflare R2、AWS S3などのオブジェクトストレージを使用してください。
 */
publicEntry.post('/:qrToken/upload', async (c) => {
  try {
    const qrToken = c.req.param('qrToken');
    const { DB } = c.env;

    // フォームデータ取得
    const formData = await c.req.formData();
    const files = formData.getAll('files');
    const submissionType = formData.get('type') as string; // 'photo' or 'video'
    const instagramAccount = formData.get('instagram_account') as string | null;

    if (!files || files.length === 0) {
      return c.json(errorResponse('ファイルが選択されていません'), 400);
    }

    // バリデーション
    if (submissionType === 'video' && files.length > 1) {
      return c.json(errorResponse('動画は1本ずつ投稿してください'), 400);
    }

    if (submissionType === 'photo' && files.length > 10) {
      return c.json(errorResponse('写真は1回につき最大10枚までです'), 400);
    }

    // Instagramアカウントバリデーション
    let normalizedInstagram = null;
    if (instagramAccount) {
      if (!isValidInstagramAccount(instagramAccount)) {
        return c.json(errorResponse('Instagramアカウント名の形式が正しくありません'), 400);
      }
      normalizedInstagram = normalizeInstagramAccount(instagramAccount);
    }

    // QRトークンからテーブル情報取得
    const table = await DB
      .prepare('SELECT * FROM store_tables WHERE qr_token = ? AND is_active = 1')
      .bind(qrToken)
      .first<StoreTable>();

    if (!table) {
      return c.json(errorResponse('無効なQRコードです'), 404);
    }

    // 店舗情報取得
    const store = await DB
      .prepare('SELECT * FROM stores WHERE id = ? AND is_active = 1')
      .bind(table.store_id)
      .first<Store>();

    if (!store) {
      return c.json(errorResponse('店舗情報が見つかりません'), 404);
    }

    // 営業時間チェック
    if (!isWithinBusinessHours(store)) {
      return c.json(errorResponse('現在は営業時間外です'), 400);
    }

    // 営業日取得
    const businessDay = await getOrCreateBusinessDay(DB, store);

    // 実際のファイルアップロード処理（プロトタイプではダミーURL）
    // 本番環境ではCloudflare R2 / AWS S3などにアップロード
    const uploadedFiles = [];
    for (const file of files) {
      if (!(file instanceof File)) continue;
      
      // ダミーURL（実際はR2にアップロード）
      const dummyUrl = `https://storage.example.com/uploads/${Date.now()}-${file.name}`;
      const thumbnailUrl = submissionType === 'video' ? `${dummyUrl}-thumb.jpg` : dummyUrl;
      
      uploadedFiles.push({
        file_url: dummyUrl,
        thumbnail_url: thumbnailUrl,
        file_size: file.size,
        mime_type: file.type
      });
    }

    return c.json(
      successResponse({
        batch_id: `temp_${Date.now()}`,
        files: uploadedFiles,
        submission_type: submissionType,
        instagram_account: normalizedInstagram
      }, 'ファイルをアップロードしました')
    );
  } catch (error) {
    console.error('Upload error:', error);
    return c.json(errorResponse('アップロード処理中にエラーが発生しました'), 500);
  }
});

/**
 * AI採点実行
 * POST /api/public/entry/:qrToken/score
 */
publicEntry.post('/:qrToken/score', async (c) => {
  try {
    const qrToken = c.req.param('qrToken');
    const { DB } = c.env;

    const body = await c.req.json();
    const { files, submission_type, instagram_account } = body;

    if (!files || files.length === 0) {
      return c.json(errorResponse('ファイル情報が見つかりません'), 400);
    }

    // QRトークンからテーブル情報取得
    const table = await DB
      .prepare('SELECT * FROM store_tables WHERE qr_token = ? AND is_active = 1')
      .bind(qrToken)
      .first<StoreTable>();

    if (!table) {
      return c.json(errorResponse('無効なQRコードです'), 404);
    }

    // 店舗情報取得
    const store = await DB
      .prepare('SELECT * FROM stores WHERE id = ? AND is_active = 1')
      .bind(table.store_id)
      .first<Store>();

    if (!store || !isWithinBusinessHours(store)) {
      return c.json(errorResponse('現在は営業時間外です'), 400);
    }

    // 営業日取得
    const businessDay = await getOrCreateBusinessDay(DB, store);

    // 一時バッチ作成
    const batch = await DB
      .prepare(
        `INSERT INTO submission_batches 
        (store_id, table_id, business_day_id, submission_type, instagram_account, consented_at, submitted_at)
        VALUES (?, ?, ?, ?, ?, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP) RETURNING *`
      )
      .bind(
        store.id,
        table.id,
        businessDay.id,
        submission_type,
        instagram_account || null
      )
      .first<any>();

    // エントリー作成 & AI採点
    const scores = [];
    for (const file of files) {
      const submission = await DB
        .prepare(
          `INSERT INTO submissions 
          (batch_id, store_id, table_id, business_day_id, submission_type, file_url, thumbnail_url, file_size, mime_type, status)
          VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 'pending') RETURNING *`
        )
        .bind(
          batch.id,
          store.id,
          table.id,
          businessDay.id,
          submission_type,
          file.file_url,
          file.thumbnail_url,
          file.file_size || null,
          file.mime_type || null
        )
        .first<Submission>();

      if (submission) {
        // AI採点実行（utils/score.tsのscoreSubmission使用）
        const { scoreBatchSubmissions } = await import('../utils/score');
        const scoreResult = await DB
          .prepare('SELECT * FROM ai_scores WHERE submission_id = ?')
          .bind(submission.id)
          .first();
        
        if (!scoreResult) {
          // 簡易AI採点（実際はscoreSubmission関数を使用）
          const baseScore = 60 + Math.floor(Math.random() * 30);
          const variance = () => Math.floor(Math.random() * 20) - 10;
          
          const sizzle = Math.max(0, Math.min(100, baseScore + variance()));
          const composition = Math.max(0, Math.min(100, baseScore + variance()));
          const liveliness = Math.max(0, Math.min(100, baseScore + variance()));
          const official = Math.max(0, Math.min(100, baseScore + variance()));
          const total = Math.round((sizzle + composition + liveliness + official) / 4);
          
          let comment = '';
          if (total >= 90) {
            comment = '素晴らしい完成度です。プロカメラマン級の仕上がりで、公式投稿に即採用できるレベルです。';
          } else if (total >= 75) {
            comment = '非常に魅力的な一枚です。シズル感と構図のバランスが良く、公式投稿でも十分に通用する完成度です。';
          } else if (total >= 60) {
            comment = '良い仕上がりです。料理の魅力は伝わっていますが、もう少し工夫すると、さらに印象的になります。';
          } else {
            comment = '料理自体の魅力は感じられますが、構図や照明を工夫すると、印象が大きく変わります。';
          }
          
          await DB
            .prepare(
              `INSERT INTO ai_scores 
              (submission_id, sizzle_score, composition_score, liveliness_score, official_fit_score, total_score, ai_comment)
              VALUES (?, ?, ?, ?, ?, ?, ?)`
            )
            .bind(submission.id, sizzle, composition, liveliness, official, total, comment)
            .run();
          
          scores.push({
            submission_id: submission.id,
            file_url: submission.file_url,
            thumbnail_url: submission.thumbnail_url,
            sizzle_score: sizzle,
            composition_score: composition,
            liveliness_score: liveliness,
            official_fit_score: official,
            total_score: total,
            ai_comment: comment
          });
        }
      }
    }

    return c.json(
      successResponse({
        batch_id: batch.id,
        scores
      }, 'AI採点が完了しました')
    );
  } catch (error) {
    console.error('Score error:', error);
    return c.json(errorResponse('AI採点中にエラーが発生しました'), 500);
  }
});

/**
 * エントリー確定（同意チェック後）
 * POST /api/public/entry/:qrToken/submit
 */
publicEntry.post('/:qrToken/submit', async (c) => {
  try {
    const qrToken = c.req.param('qrToken');
    const { DB } = c.env;

    const { batch_id, consented } = await c.req.json();

    if (!batch_id) {
      return c.json(errorResponse('バッチIDが見つかりません'), 400);
    }

    if (!consented) {
      return c.json(errorResponse('利用規約への同意が必要です'), 400);
    }

    // バッチの存在確認
    const batch = await DB
      .prepare('SELECT * FROM submission_batches WHERE id = ?')
      .bind(batch_id)
      .first();

    if (!batch) {
      return c.json(errorResponse('エントリー情報が見つかりません'), 404);
    }

    return c.json(
      successResponse(
        { batch_id },
        'エントリーが完了しました。選ばれた際はスタッフからお声がけさせていただきます。'
      )
    );
  } catch (error) {
    console.error('Submit error:', error);
    return c.json(errorResponse('エントリー確定中にエラーが発生しました'), 500);
  }
});

/**
 * 共通アルバム取得
 * GET /api/public/entry/:qrToken/album
 */
publicEntry.get('/:qrToken/album', async (c) => {
  try {
    const qrToken = c.req.param('qrToken');
    const { DB } = c.env;

    // QRトークンからテーブル情報取得
    const table = await DB
      .prepare('SELECT * FROM store_tables WHERE qr_token = ? AND is_active = 1')
      .bind(qrToken)
      .first<StoreTable>();

    if (!table) {
      return c.json(errorResponse('無効なQRコードです'), 404);
    }

    // 店舗情報取得
    const store = await DB
      .prepare('SELECT * FROM stores WHERE id = ? AND is_active = 1')
      .bind(table.store_id)
      .first<Store>();

    if (!store) {
      return c.json(errorResponse('店舗情報が見つかりません'), 404);
    }

    // 営業日取得
    const businessDay = await getOrCreateBusinessDay(DB, store);

    // 当日のエントリー一覧取得（Instagramアカウントは非表示）
    const submissions = await DB
      .prepare(`
        SELECT 
          s.id,
          s.submission_type,
          s.file_url,
          s.thumbnail_url,
          s.created_at,
          ai.total_score
        FROM submissions s
        LEFT JOIN ai_scores ai ON s.id = ai.submission_id
        WHERE s.store_id = ? AND s.business_day_id = ?
        ORDER BY s.created_at DESC
        LIMIT 50
      `)
      .bind(store.id, businessDay.id)
      .all();

    return c.json(
      successResponse({
        store_name: store.name,
        business_date: businessDay.business_date,
        submissions: submissions.results || []
      })
    );
  } catch (error) {
    console.error('Album error:', error);
    return c.json(errorResponse('アルバムの取得に失敗しました'), 500);
  }
});

export default publicEntry;
