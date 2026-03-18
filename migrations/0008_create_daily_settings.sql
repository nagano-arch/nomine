-- Daily settings (日次設定)
CREATE TABLE IF NOT EXISTS daily_settings (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  store_id INTEGER NOT NULL,
  business_day_id INTEGER NOT NULL,
  photo_reward_text TEXT NOT NULL,
  video_reward_text TEXT NOT NULL,
  photo_adopt_limit INTEGER NOT NULL DEFAULT 3,
  video_adopt_limit INTEGER NOT NULL DEFAULT 1,
  photo_adopted_count INTEGER NOT NULL DEFAULT 0,
  video_adopted_count INTEGER NOT NULL DEFAULT 0,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (store_id) REFERENCES stores(id) ON DELETE CASCADE,
  FOREIGN KEY (business_day_id) REFERENCES business_days(id) ON DELETE CASCADE,
  UNIQUE(store_id, business_day_id)
);

-- Create indexes
CREATE INDEX IF NOT EXISTS idx_daily_settings_store ON daily_settings(store_id);
CREATE INDEX IF NOT EXISTS idx_daily_settings_business_day ON daily_settings(business_day_id);
