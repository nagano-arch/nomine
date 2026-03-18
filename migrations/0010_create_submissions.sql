-- Submissions (個別エントリー)
CREATE TABLE IF NOT EXISTS submissions (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  batch_id INTEGER NOT NULL,
  store_id INTEGER NOT NULL,
  table_id INTEGER NOT NULL,
  business_day_id INTEGER NOT NULL,
  submission_type TEXT NOT NULL,
  file_url TEXT NOT NULL,
  thumbnail_url TEXT,
  file_size INTEGER,
  mime_type TEXT,
  status TEXT NOT NULL DEFAULT 'pending',
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (batch_id) REFERENCES submission_batches(id) ON DELETE CASCADE,
  FOREIGN KEY (store_id) REFERENCES stores(id) ON DELETE CASCADE,
  FOREIGN KEY (table_id) REFERENCES store_tables(id) ON DELETE CASCADE,
  FOREIGN KEY (business_day_id) REFERENCES business_days(id) ON DELETE CASCADE
);

-- Create indexes
CREATE INDEX IF NOT EXISTS idx_submissions_batch ON submissions(batch_id);
CREATE INDEX IF NOT EXISTS idx_submissions_store ON submissions(store_id);
CREATE INDEX IF NOT EXISTS idx_submissions_table ON submissions(table_id);
CREATE INDEX IF NOT EXISTS idx_submissions_business_day ON submissions(business_day_id);
CREATE INDEX IF NOT EXISTS idx_submissions_type ON submissions(submission_type);
CREATE INDEX IF NOT EXISTS idx_submissions_status ON submissions(status);
CREATE INDEX IF NOT EXISTS idx_submissions_created_at ON submissions(created_at);
