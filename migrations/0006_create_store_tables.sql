-- Store tables (テーブル・卓)
CREATE TABLE IF NOT EXISTS store_tables (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  store_id INTEGER NOT NULL,
  table_code TEXT NOT NULL,
  table_name TEXT NOT NULL,
  qr_token TEXT UNIQUE NOT NULL,
  is_active INTEGER DEFAULT 1,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (store_id) REFERENCES stores(id) ON DELETE CASCADE,
  UNIQUE(store_id, table_code)
);

-- Create indexes
CREATE INDEX IF NOT EXISTS idx_store_tables_store ON store_tables(store_id);
CREATE INDEX IF NOT EXISTS idx_store_tables_qr_token ON store_tables(qr_token);
CREATE INDEX IF NOT EXISTS idx_store_tables_active ON store_tables(is_active);
