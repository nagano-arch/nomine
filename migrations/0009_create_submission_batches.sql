-- Submission batches (エントリーバッチ)
CREATE TABLE IF NOT EXISTS submission_batches (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  store_id INTEGER NOT NULL,
  table_id INTEGER NOT NULL,
  business_day_id INTEGER NOT NULL,
  submission_type TEXT NOT NULL,
  instagram_account TEXT,
  consented_at DATETIME NOT NULL,
  submitted_at DATETIME NOT NULL,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (store_id) REFERENCES stores(id) ON DELETE CASCADE,
  FOREIGN KEY (table_id) REFERENCES store_tables(id) ON DELETE CASCADE,
  FOREIGN KEY (business_day_id) REFERENCES business_days(id) ON DELETE CASCADE
);

-- Create indexes
CREATE INDEX IF NOT EXISTS idx_submission_batches_store ON submission_batches(store_id);
CREATE INDEX IF NOT EXISTS idx_submission_batches_table ON submission_batches(table_id);
CREATE INDEX IF NOT EXISTS idx_submission_batches_business_day ON submission_batches(business_day_id);
CREATE INDEX IF NOT EXISTS idx_submission_batches_type ON submission_batches(submission_type);
CREATE INDEX IF NOT EXISTS idx_submission_batches_submitted_at ON submission_batches(submitted_at);
