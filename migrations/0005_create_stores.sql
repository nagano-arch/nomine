-- Stores table (店舗)
CREATE TABLE IF NOT EXISTS stores (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  tenant_id INTEGER NOT NULL,
  name TEXT NOT NULL,
  business_type TEXT NOT NULL DEFAULT 'izakaya',
  template_type TEXT NOT NULL DEFAULT 'izakaya',
  business_open_time TEXT NOT NULL DEFAULT '17:00',
  business_close_time TEXT NOT NULL DEFAULT '25:00',
  photo_reward_text TEXT NOT NULL DEFAULT 'ドリンク1杯サービス',
  video_reward_text TEXT NOT NULL DEFAULT 'おすすめ一品サービス',
  photo_adopt_limit INTEGER NOT NULL DEFAULT 3,
  video_adopt_limit INTEGER NOT NULL DEFAULT 1,
  is_active INTEGER DEFAULT 1,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (tenant_id) REFERENCES tenants(id) ON DELETE CASCADE
);

-- Create indexes
CREATE INDEX IF NOT EXISTS idx_stores_tenant ON stores(tenant_id);
CREATE INDEX IF NOT EXISTS idx_stores_active ON stores(is_active);
