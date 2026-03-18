import type { Store, BusinessDay } from '../types';

/**
 * 営業時間を24時間超え対応でパース
 * 例: "25:00" -> 25
 */
function parseBusinessHour(time: string): number {
  const [hour, minute] = time.split(':').map(Number);
  return hour + minute / 60;
}

/**
 * 現在時刻から営業日を判定
 */
export function getCurrentBusinessDate(store: Store, now: Date = new Date()): string {
  const openHour = parseBusinessHour(store.business_open_time);
  const closeHour = parseBusinessHour(store.business_close_time);

  const currentHour = now.getHours() + now.getMinutes() / 60;

  // 深夜営業の場合（例: 17:00-25:00）
  if (closeHour > 24) {
    // 0:00-1:00の場合は前日の営業日
    if (currentHour < closeHour - 24) {
      const yesterday = new Date(now);
      yesterday.setDate(yesterday.getDate() - 1);
      return yesterday.toISOString().split('T')[0];
    }
  }

  // 営業開始前は前日の営業日とみなす
  if (currentHour < openHour) {
    const yesterday = new Date(now);
    yesterday.setDate(yesterday.getDate() - 1);
    return yesterday.toISOString().split('T')[0];
  }

  return now.toISOString().split('T')[0];
}

/**
 * 営業時間内かどうかチェック
 */
export function isWithinBusinessHours(store: Store, now: Date = new Date()): boolean {
  const openHour = parseBusinessHour(store.business_open_time);
  const closeHour = parseBusinessHour(store.business_close_time);

  const currentHour = now.getHours() + now.getMinutes() / 60;

  // 深夜営業の場合
  if (closeHour > 24) {
    // 0:00-1:00の範囲
    if (currentHour < closeHour - 24) {
      return true;
    }
    // 17:00-23:59の範囲
    if (currentHour >= openHour) {
      return true;
    }
    return false;
  }

  // 通常営業
  return currentHour >= openHour && currentHour < closeHour;
}

/**
 * 営業日レコードを取得または作成
 */
export async function getOrCreateBusinessDay(
  db: D1Database,
  store: Store,
  now: Date = new Date()
): Promise<BusinessDay> {
  const businessDate = getCurrentBusinessDate(store, now);

  // 既存の営業日を取得
  let businessDay = await db
    .prepare('SELECT * FROM business_days WHERE store_id = ? AND business_date = ?')
    .bind(store.id, businessDate)
    .first<BusinessDay>();

  if (businessDay) {
    return businessDay;
  }

  // 営業日の開始・終了時刻を計算
  const startAt = new Date(businessDate + 'T' + store.business_open_time + ':00');
  
  let endAt: Date;
  const closeHour = parseBusinessHour(store.business_close_time);
  
  if (closeHour >= 24) {
    // 翌日にまたがる場合
    const nextDay = new Date(businessDate);
    nextDay.setDate(nextDay.getDate() + 1);
    const adjustedHour = closeHour - 24;
    const hours = Math.floor(adjustedHour);
    const minutes = Math.round((adjustedHour - hours) * 60);
    endAt = new Date(
      nextDay.getFullYear(),
      nextDay.getMonth(),
      nextDay.getDate(),
      hours,
      minutes,
      0
    );
  } else {
    endAt = new Date(businessDate + 'T' + store.business_close_time + ':00');
  }

  // 新規営業日を作成
  businessDay = await db
    .prepare(
      'INSERT INTO business_days (store_id, business_date, start_at, end_at) VALUES (?, ?, ?, ?) RETURNING *'
    )
    .bind(store.id, businessDate, startAt.toISOString(), endAt.toISOString())
    .first<BusinessDay>();

  if (!businessDay) {
    throw new Error('Failed to create business day');
  }

  return businessDay;
}

/**
 * 営業日の日次設定を取得または作成
 */
export async function getOrCreateDailySetting(
  db: D1Database,
  store: Store,
  businessDayId: number
) {
  // 既存の設定を取得
  let setting = await db
    .prepare('SELECT * FROM daily_settings WHERE store_id = ? AND business_day_id = ?')
    .bind(store.id, businessDayId)
    .first();

  if (setting) {
    return setting;
  }

  // 新規設定を作成（店舗のデフォルト値を使用）
  setting = await db
    .prepare(
      `INSERT INTO daily_settings 
      (store_id, business_day_id, photo_reward_text, video_reward_text, 
       photo_adopt_limit, video_adopt_limit, photo_adopted_count, video_adopted_count)
      VALUES (?, ?, ?, ?, ?, ?, 0, 0) RETURNING *`
    )
    .bind(
      store.id,
      businessDayId,
      store.photo_reward_text,
      store.video_reward_text,
      store.photo_adopt_limit,
      store.video_adopt_limit
    )
    .first();

  if (!setting) {
    throw new Error('Failed to create daily setting');
  }

  return setting;
}

/**
 * 古いエントリーを削除（48時間経過、未選出のみ）
 */
export async function cleanupOldSubmissions(
  db: D1Database,
  storeId: number
): Promise<number> {
  const cutoffDate = new Date();
  cutoffDate.setHours(cutoffDate.getHours() - 48);

  const result = await db
    .prepare(
      `DELETE FROM submissions 
       WHERE store_id = ? 
       AND status = 'pending' 
       AND created_at < ?`
    )
    .bind(storeId, cutoffDate.toISOString())
    .run();

  return result.meta.changes || 0;
}
