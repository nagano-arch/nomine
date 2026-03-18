-- Tenant members table (テナント所属メンバー)
CREATE TABLE IF NOT EXISTS tenant_members (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  tenant_id INTEGER NOT NULL,
  user_id INTEGER NOT NULL,
  role TEXT NOT NULL DEFAULT 'user',
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (tenant_id) REFERENCES tenants(id) ON DELETE CASCADE,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
  UNIQUE(tenant_id, user_id)
);

-- Create indexes
CREATE INDEX IF NOT EXISTS idx_tenant_members_tenant ON tenant_members(tenant_id);
CREATE INDEX IF NOT EXISTS idx_tenant_members_user ON tenant_members(user_id);
