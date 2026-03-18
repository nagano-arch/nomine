-- Template configs (テンプレート設定)
CREATE TABLE IF NOT EXISTS template_configs (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  store_id INTEGER NOT NULL,
  template_type TEXT NOT NULL DEFAULT 'izakaya',
  primary_color TEXT NOT NULL DEFAULT '#1a1a1a',
  sub_color TEXT NOT NULL DEFAULT '#f59e0b',
  headline_text TEXT NOT NULL DEFAULT 'このお店の"公式写真"に、あなたの一枚が選ばれるかも',
  sub_text TEXT NOT NULL DEFAULT '選ばれた方には、特別なサービスをご用意しています',
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (store_id) REFERENCES stores(id) ON DELETE CASCADE,
  UNIQUE(store_id)
);

-- Create indexes
CREATE INDEX IF NOT EXISTS idx_template_configs_store ON template_configs(store_id);
CREATE INDEX IF NOT EXISTS idx_template_configs_template_type ON template_configs(template_type);
