-- AI scores (AI採点結果)
CREATE TABLE IF NOT EXISTS ai_scores (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  submission_id INTEGER NOT NULL,
  sizzle_score INTEGER NOT NULL DEFAULT 0,
  composition_score INTEGER NOT NULL DEFAULT 0,
  liveliness_score INTEGER NOT NULL DEFAULT 0,
  official_fit_score INTEGER NOT NULL DEFAULT 0,
  total_score INTEGER NOT NULL DEFAULT 0,
  ai_comment TEXT NOT NULL,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (submission_id) REFERENCES submissions(id) ON DELETE CASCADE,
  UNIQUE(submission_id)
);

-- Create indexes
CREATE INDEX IF NOT EXISTS idx_ai_scores_submission ON ai_scores(submission_id);
CREATE INDEX IF NOT EXISTS idx_ai_scores_total_score ON ai_scores(total_score);
