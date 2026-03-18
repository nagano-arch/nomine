-- Business days (営業日)
CREATE TABLE IF NOT EXISTS business_days (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  store_id INTEGER NOT NULL,
  business_date DATE NOT NULL,
  start_at DATETIME NOT NULL,
  end_at DATETIME NOT NULL,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (store_id) REFERENCES stores(id) ON DELETE CASCADE,
  UNIQUE(store_id, business_date)
);

-- Create indexes
CREATE INDEX IF NOT EXISTS idx_business_days_store ON business_days(store_id);
CREATE INDEX IF NOT EXISTS idx_business_days_date ON business_days(business_date);
CREATE INDEX IF NOT EXISTS idx_business_days_period ON business_days(start_at, end_at);
