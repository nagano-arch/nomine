-- Adoptions (選出・採用)
CREATE TABLE IF NOT EXISTS adoptions (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  submission_id INTEGER NOT NULL,
  store_id INTEGER NOT NULL,
  reward_type TEXT NOT NULL,
  reward_text TEXT NOT NULL,
  adopted_by INTEGER NOT NULL,
  adopted_at DATETIME NOT NULL,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (submission_id) REFERENCES submissions(id) ON DELETE CASCADE,
  FOREIGN KEY (store_id) REFERENCES stores(id) ON DELETE CASCADE,
  FOREIGN KEY (adopted_by) REFERENCES users(id),
  UNIQUE(submission_id)
);

-- Create indexes
CREATE INDEX IF NOT EXISTS idx_adoptions_submission ON adoptions(submission_id);
CREATE INDEX IF NOT EXISTS idx_adoptions_store ON adoptions(store_id);
CREATE INDEX IF NOT EXISTS idx_adoptions_adopted_at ON adoptions(adopted_at);
