-- 全テーブルを一度に作成するPostgreSQL用マイグレーションファイル

-- 1. Users
CREATE TABLE IF NOT EXISTS users (
  id SERIAL PRIMARY KEY,
  email VARCHAR(255) UNIQUE NOT NULL,
  password_hash VARCHAR(255) NOT NULL,
  role VARCHAR(50) NOT NULL DEFAULT 'user',
  name VARCHAR(255),
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_users_email ON users(email);
CREATE INDEX IF NOT EXISTS idx_users_role ON users(role);

-- 2. Tenants
CREATE TABLE IF NOT EXISTS tenants (
  id SERIAL PRIMARY KEY,
  name VARCHAR(255) NOT NULL,
  owner_id INTEGER NOT NULL,
  created_by_master INTEGER DEFAULT 0,
  status VARCHAR(50) NOT NULL DEFAULT 'active',
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (owner_id) REFERENCES users(id)
);

CREATE INDEX IF NOT EXISTS idx_tenants_owner ON tenants(owner_id);
CREATE INDEX IF NOT EXISTS idx_tenants_status ON tenants(status);

-- 3. Tenant Members
CREATE TABLE IF NOT EXISTS tenant_members (
  id SERIAL PRIMARY KEY,
  tenant_id INTEGER NOT NULL,
  user_id INTEGER NOT NULL,
  role VARCHAR(50) NOT NULL DEFAULT 'user',
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (tenant_id) REFERENCES tenants(id) ON DELETE CASCADE,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
  UNIQUE(tenant_id, user_id)
);

CREATE INDEX IF NOT EXISTS idx_tenant_members_tenant ON tenant_members(tenant_id);
CREATE INDEX IF NOT EXISTS idx_tenant_members_user ON tenant_members(user_id);

-- 4. Sessions
CREATE TABLE IF NOT EXISTS sessions (
  id SERIAL PRIMARY KEY,
  user_id INTEGER NOT NULL,
  token VARCHAR(500) UNIQUE NOT NULL,
  expires_at TIMESTAMP NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_sessions_token ON sessions(token);
CREATE INDEX IF NOT EXISTS idx_sessions_user ON sessions(user_id);
CREATE INDEX IF NOT EXISTS idx_sessions_expires ON sessions(expires_at);

-- 5. Stores
CREATE TABLE IF NOT EXISTS stores (
  id SERIAL PRIMARY KEY,
  tenant_id INTEGER NOT NULL,
  name VARCHAR(255) NOT NULL,
  business_type VARCHAR(50) NOT NULL DEFAULT 'izakaya',
  template_type VARCHAR(50) NOT NULL DEFAULT 'izakaya',
  business_open_time VARCHAR(10) NOT NULL DEFAULT '17:00',
  business_close_time VARCHAR(10) NOT NULL DEFAULT '25:00',
  photo_reward_text TEXT NOT NULL DEFAULT 'ドリンク1杯サービス',
  video_reward_text TEXT NOT NULL DEFAULT 'おすすめ一品サービス',
  photo_adopt_limit INTEGER NOT NULL DEFAULT 3,
  video_adopt_limit INTEGER NOT NULL DEFAULT 1,
  is_active INTEGER DEFAULT 1,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (tenant_id) REFERENCES tenants(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_stores_tenant ON stores(tenant_id);
CREATE INDEX IF NOT EXISTS idx_stores_active ON stores(is_active);

-- 6. Store Tables
CREATE TABLE IF NOT EXISTS store_tables (
  id SERIAL PRIMARY KEY,
  store_id INTEGER NOT NULL,
  table_code VARCHAR(50) NOT NULL,
  table_name VARCHAR(255) NOT NULL,
  qr_token VARCHAR(255) UNIQUE NOT NULL,
  is_active INTEGER DEFAULT 1,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (store_id) REFERENCES stores(id) ON DELETE CASCADE,
  UNIQUE(store_id, table_code)
);

CREATE INDEX IF NOT EXISTS idx_store_tables_store ON store_tables(store_id);
CREATE INDEX IF NOT EXISTS idx_store_tables_qr_token ON store_tables(qr_token);
CREATE INDEX IF NOT EXISTS idx_store_tables_active ON store_tables(is_active);

-- 7. Business Days
CREATE TABLE IF NOT EXISTS business_days (
  id SERIAL PRIMARY KEY,
  store_id INTEGER NOT NULL,
  business_date DATE NOT NULL,
  start_at TIMESTAMP NOT NULL,
  end_at TIMESTAMP NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (store_id) REFERENCES stores(id) ON DELETE CASCADE,
  UNIQUE(store_id, business_date)
);

CREATE INDEX IF NOT EXISTS idx_business_days_store ON business_days(store_id);
CREATE INDEX IF NOT EXISTS idx_business_days_date ON business_days(business_date);
CREATE INDEX IF NOT EXISTS idx_business_days_period ON business_days(start_at, end_at);

-- 8. Daily Settings
CREATE TABLE IF NOT EXISTS daily_settings (
  id SERIAL PRIMARY KEY,
  store_id INTEGER NOT NULL,
  business_day_id INTEGER NOT NULL,
  photo_reward_text TEXT NOT NULL,
  video_reward_text TEXT NOT NULL,
  photo_adopt_limit INTEGER NOT NULL DEFAULT 3,
  video_adopt_limit INTEGER NOT NULL DEFAULT 1,
  photo_adopted_count INTEGER NOT NULL DEFAULT 0,
  video_adopted_count INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (store_id) REFERENCES stores(id) ON DELETE CASCADE,
  FOREIGN KEY (business_day_id) REFERENCES business_days(id) ON DELETE CASCADE,
  UNIQUE(store_id, business_day_id)
);

CREATE INDEX IF NOT EXISTS idx_daily_settings_store ON daily_settings(store_id);
CREATE INDEX IF NOT EXISTS idx_daily_settings_business_day ON daily_settings(business_day_id);

-- 9. Submission Batches
CREATE TABLE IF NOT EXISTS submission_batches (
  id SERIAL PRIMARY KEY,
  store_id INTEGER NOT NULL,
  table_id INTEGER NOT NULL,
  business_day_id INTEGER NOT NULL,
  submission_type VARCHAR(20) NOT NULL,
  instagram_account VARCHAR(255),
  consented_at TIMESTAMP NOT NULL,
  submitted_at TIMESTAMP NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (store_id) REFERENCES stores(id) ON DELETE CASCADE,
  FOREIGN KEY (table_id) REFERENCES store_tables(id) ON DELETE CASCADE,
  FOREIGN KEY (business_day_id) REFERENCES business_days(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_submission_batches_store ON submission_batches(store_id);
CREATE INDEX IF NOT EXISTS idx_submission_batches_table ON submission_batches(table_id);
CREATE INDEX IF NOT EXISTS idx_submission_batches_business_day ON submission_batches(business_day_id);
CREATE INDEX IF NOT EXISTS idx_submission_batches_type ON submission_batches(submission_type);
CREATE INDEX IF NOT EXISTS idx_submission_batches_submitted_at ON submission_batches(submitted_at);

-- 10. Submissions
CREATE TABLE IF NOT EXISTS submissions (
  id SERIAL PRIMARY KEY,
  batch_id INTEGER NOT NULL,
  store_id INTEGER NOT NULL,
  table_id INTEGER NOT NULL,
  business_day_id INTEGER NOT NULL,
  submission_type VARCHAR(20) NOT NULL,
  file_url TEXT NOT NULL,
  thumbnail_url TEXT,
  file_size BIGINT,
  mime_type VARCHAR(100),
  status VARCHAR(50) NOT NULL DEFAULT 'pending',
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (batch_id) REFERENCES submission_batches(id) ON DELETE CASCADE,
  FOREIGN KEY (store_id) REFERENCES stores(id) ON DELETE CASCADE,
  FOREIGN KEY (table_id) REFERENCES store_tables(id) ON DELETE CASCADE,
  FOREIGN KEY (business_day_id) REFERENCES business_days(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_submissions_batch ON submissions(batch_id);
CREATE INDEX IF NOT EXISTS idx_submissions_store ON submissions(store_id);
CREATE INDEX IF NOT EXISTS idx_submissions_table ON submissions(table_id);
CREATE INDEX IF NOT EXISTS idx_submissions_business_day ON submissions(business_day_id);
CREATE INDEX IF NOT EXISTS idx_submissions_type ON submissions(submission_type);
CREATE INDEX IF NOT EXISTS idx_submissions_status ON submissions(status);
CREATE INDEX IF NOT EXISTS idx_submissions_created_at ON submissions(created_at);

-- 11. AI Scores
CREATE TABLE IF NOT EXISTS ai_scores (
  id SERIAL PRIMARY KEY,
  submission_id INTEGER NOT NULL,
  sizzle_score INTEGER NOT NULL DEFAULT 0,
  composition_score INTEGER NOT NULL DEFAULT 0,
  liveliness_score INTEGER NOT NULL DEFAULT 0,
  official_fit_score INTEGER NOT NULL DEFAULT 0,
  total_score INTEGER NOT NULL DEFAULT 0,
  ai_comment TEXT NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (submission_id) REFERENCES submissions(id) ON DELETE CASCADE,
  UNIQUE(submission_id)
);

CREATE INDEX IF NOT EXISTS idx_ai_scores_submission ON ai_scores(submission_id);
CREATE INDEX IF NOT EXISTS idx_ai_scores_total_score ON ai_scores(total_score);

-- 12. Adoptions
CREATE TABLE IF NOT EXISTS adoptions (
  id SERIAL PRIMARY KEY,
  submission_id INTEGER NOT NULL,
  store_id INTEGER NOT NULL,
  reward_type VARCHAR(50) NOT NULL,
  reward_text TEXT NOT NULL,
  adopted_by INTEGER NOT NULL,
  adopted_at TIMESTAMP NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (submission_id) REFERENCES submissions(id) ON DELETE CASCADE,
  FOREIGN KEY (store_id) REFERENCES stores(id) ON DELETE CASCADE,
  FOREIGN KEY (adopted_by) REFERENCES users(id),
  UNIQUE(submission_id)
);

CREATE INDEX IF NOT EXISTS idx_adoptions_submission ON adoptions(submission_id);
CREATE INDEX IF NOT EXISTS idx_adoptions_store ON adoptions(store_id);
CREATE INDEX IF NOT EXISTS idx_adoptions_adopted_at ON adoptions(adopted_at);

-- 13. Template Configs
CREATE TABLE IF NOT EXISTS template_configs (
  id SERIAL PRIMARY KEY,
  store_id INTEGER NOT NULL,
  template_type VARCHAR(50) NOT NULL DEFAULT 'izakaya',
  primary_color VARCHAR(20) NOT NULL DEFAULT '#1a1a1a',
  sub_color VARCHAR(20) NOT NULL DEFAULT '#f59e0b',
  headline_text TEXT NOT NULL DEFAULT 'このお店の"公式写真"に、あなたの一枚が選ばれるかも',
  sub_text TEXT NOT NULL DEFAULT '選ばれた方には、特別なサービスをご用意しています',
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (store_id) REFERENCES stores(id) ON DELETE CASCADE,
  UNIQUE(store_id)
);

CREATE INDEX IF NOT EXISTS idx_template_configs_store ON template_configs(store_id);
CREATE INDEX IF NOT EXISTS idx_template_configs_template_type ON template_configs(template_type);
