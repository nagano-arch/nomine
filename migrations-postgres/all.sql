-- NOMINE PostgreSQL Migration - All Tables
-- 実行: psql $DATABASE_URL -f migrations-postgres/all.sql

-- 1. Users table
CREATE TABLE IF NOT EXISTS users (
  id SERIAL PRIMARY KEY,
  email VARCHAR(255) UNIQUE NOT NULL,
  password_hash VARCHAR(255) NOT NULL,
  name VARCHAR(255) NOT NULL,
  role VARCHAR(50) NOT NULL CHECK (role IN ('master_admin', 'tenant_admin', 'user')),
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_users_email ON users(email);
CREATE INDEX IF NOT EXISTS idx_users_role ON users(role);

-- 2. Tenants table
CREATE TABLE IF NOT EXISTS tenants (
  id SERIAL PRIMARY KEY,
  name VARCHAR(255) NOT NULL,
  owner_user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_tenants_owner ON tenants(owner_user_id);

-- 3. Tenant Members table
CREATE TABLE IF NOT EXISTS tenant_members (
  id SERIAL PRIMARY KEY,
  tenant_id INTEGER NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  role VARCHAR(50) NOT NULL CHECK (role IN ('admin', 'member')),
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(tenant_id, user_id)
);

CREATE INDEX IF NOT EXISTS idx_tenant_members_tenant ON tenant_members(tenant_id);
CREATE INDEX IF NOT EXISTS idx_tenant_members_user ON tenant_members(user_id);

-- 4. Sessions table
CREATE TABLE IF NOT EXISTS sessions (
  id SERIAL PRIMARY KEY,
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  session_token VARCHAR(255) UNIQUE NOT NULL,
  expires_at TIMESTAMP NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_sessions_token ON sessions(session_token);
CREATE INDEX IF NOT EXISTS idx_sessions_expires ON sessions(expires_at);

-- 5. Stores table
CREATE TABLE IF NOT EXISTS stores (
  id SERIAL PRIMARY KEY,
  tenant_id INTEGER NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  name VARCHAR(255) NOT NULL,
  display_name VARCHAR(255) NOT NULL,
  business_start_time VARCHAR(5) NOT NULL,
  business_end_time VARCHAR(5) NOT NULL,
  enable_instagram_link BOOLEAN DEFAULT false,
  reward_text TEXT,
  template_type VARCHAR(50) DEFAULT 'default',
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_stores_tenant ON stores(tenant_id);

-- 6. Store Tables table
CREATE TABLE IF NOT EXISTS store_tables (
  id SERIAL PRIMARY KEY,
  store_id INTEGER NOT NULL REFERENCES stores(id) ON DELETE CASCADE,
  table_number VARCHAR(50) NOT NULL,
  qr_token VARCHAR(255) UNIQUE NOT NULL,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_store_tables_store ON store_tables(store_id);
CREATE INDEX IF NOT EXISTS idx_store_tables_qr ON store_tables(qr_token);

-- 7. Business Days table
CREATE TABLE IF NOT EXISTS business_days (
  id SERIAL PRIMARY KEY,
  store_id INTEGER NOT NULL REFERENCES stores(id) ON DELETE CASCADE,
  business_date DATE NOT NULL,
  start_datetime TIMESTAMP NOT NULL,
  end_datetime TIMESTAMP NOT NULL,
  is_closed BOOLEAN DEFAULT false,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(store_id, business_date)
);

CREATE INDEX IF NOT EXISTS idx_business_days_store ON business_days(store_id);
CREATE INDEX IF NOT EXISTS idx_business_days_date ON business_days(business_date);

-- 8. Daily Settings table
CREATE TABLE IF NOT EXISTS daily_settings (
  id SERIAL PRIMARY KEY,
  business_day_id INTEGER NOT NULL REFERENCES business_days(id) ON DELETE CASCADE,
  reward_text TEXT,
  enable_instagram_link BOOLEAN DEFAULT false,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_daily_settings_business_day ON daily_settings(business_day_id);

-- 9. Submission Batches table
CREATE TABLE IF NOT EXISTS submission_batches (
  id SERIAL PRIMARY KEY,
  business_day_id INTEGER NOT NULL REFERENCES business_days(id) ON DELETE CASCADE,
  table_id INTEGER NOT NULL REFERENCES store_tables(id) ON DELETE CASCADE,
  qr_token VARCHAR(255) NOT NULL,
  status VARCHAR(50) DEFAULT 'in_progress' CHECK (status IN ('in_progress', 'completed', 'expired')),
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  completed_at TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_submission_batches_business_day ON submission_batches(business_day_id);
CREATE INDEX IF NOT EXISTS idx_submission_batches_table ON submission_batches(table_id);
CREATE INDEX IF NOT EXISTS idx_submission_batches_qr ON submission_batches(qr_token);

-- 10. Submissions table
CREATE TABLE IF NOT EXISTS submissions (
  id SERIAL PRIMARY KEY,
  batch_id INTEGER NOT NULL REFERENCES submission_batches(id) ON DELETE CASCADE,
  store_id INTEGER NOT NULL REFERENCES stores(id) ON DELETE CASCADE,
  file_key VARCHAR(500) NOT NULL,
  media_type VARCHAR(10) NOT NULL CHECK (media_type IN ('photo', 'video')),
  thumbnail_key VARCHAR(500),
  instagram_account VARCHAR(255),
  consent_display BOOLEAN DEFAULT false,
  consent_instagram BOOLEAN DEFAULT false,
  uploaded_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  is_adopted BOOLEAN DEFAULT false,
  adopted_at TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_submissions_batch ON submissions(batch_id);
CREATE INDEX IF NOT EXISTS idx_submissions_store ON submissions(store_id);
CREATE INDEX IF NOT EXISTS idx_submissions_adopted ON submissions(is_adopted);
CREATE INDEX IF NOT EXISTS idx_submissions_uploaded ON submissions(uploaded_at);

-- 11. AI Scores table
CREATE TABLE IF NOT EXISTS ai_scores (
  id SERIAL PRIMARY KEY,
  submission_id INTEGER NOT NULL REFERENCES submissions(id) ON DELETE CASCADE,
  total_score DECIMAL(5,2) NOT NULL,
  detail_json TEXT NOT NULL,
  scored_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_ai_scores_submission ON ai_scores(submission_id);

-- 12. Adoptions table
CREATE TABLE IF NOT EXISTS adoptions (
  id SERIAL PRIMARY KEY,
  submission_id INTEGER NOT NULL REFERENCES submissions(id) ON DELETE CASCADE,
  business_day_id INTEGER NOT NULL REFERENCES business_days(id) ON DELETE CASCADE,
  adopted_by_user_id INTEGER NOT NULL REFERENCES users(id),
  adopted_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  note TEXT
);

CREATE INDEX IF NOT EXISTS idx_adoptions_submission ON adoptions(submission_id);
CREATE INDEX IF NOT EXISTS idx_adoptions_business_day ON adoptions(business_day_id);

-- 13. Template Configs table
CREATE TABLE IF NOT EXISTS template_configs (
  id SERIAL PRIMARY KEY,
  name VARCHAR(100) UNIQUE NOT NULL,
  display_name VARCHAR(255) NOT NULL,
  restaurant_type VARCHAR(100),
  config_json TEXT NOT NULL,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_template_configs_type ON template_configs(restaurant_type);
CREATE INDEX IF NOT EXISTS idx_template_configs_active ON template_configs(is_active);

-- セッションクリーンアップ用の関数
CREATE OR REPLACE FUNCTION cleanup_expired_sessions()
RETURNS void AS $$
BEGIN
  DELETE FROM sessions WHERE expires_at < NOW();
END;
$$ LANGUAGE plpgsql;

-- 48時間後の自動削除チェック用の関数
CREATE OR REPLACE FUNCTION cleanup_old_unadopted_submissions()
RETURNS void AS $$
BEGIN
  DELETE FROM submissions 
  WHERE is_adopted = false 
  AND uploaded_at < NOW() - INTERVAL '48 hours';
END;
$$ LANGUAGE plpgsql;

-- マイグレーション完了
SELECT 'PostgreSQL migration completed successfully!' AS status;
