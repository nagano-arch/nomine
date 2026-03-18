-- マスター管理者アカウント作成
INSERT INTO users (email, password_hash, role, name) VALUES 
('master@nomine.local', '$2a$10$YourHashedPasswordHere', 'master_admin', 'Master Admin');

-- テスト用テナントとオーナー作成
INSERT INTO users (email, password_hash, role, name) VALUES 
('owner@test-restaurant.com', '$2a$10$YourHashedPasswordHere', 'user', 'Test Restaurant Owner');

INSERT INTO tenants (name, owner_id, created_by_master, status) VALUES 
('テスト飲食店', 2, 0, 'active');

INSERT INTO tenant_members (tenant_id, user_id, role) VALUES 
(1, 2, 'tenant_admin');

-- テスト用店舗作成
INSERT INTO stores (
  tenant_id, 
  name, 
  business_type, 
  template_type, 
  business_open_time, 
  business_close_time,
  photo_reward_text,
  video_reward_text,
  photo_adopt_limit,
  video_adopt_limit,
  is_active
) VALUES (
  1,
  '焼肉レストラン NOMINE',
  'yakiniku',
  'yakiniku',
  '17:00',
  '25:00',
  'ドリンク1杯サービス',
  'デザート盛り合わせサービス',
  3,
  1,
  1
);

-- テーブル（卓）作成
INSERT INTO store_tables (store_id, table_code, table_name, qr_token, is_active) VALUES
(1, 'T01', 'テーブル1', 'test-qr-token-table-01', 1),
(1, 'T02', 'テーブル2', 'test-qr-token-table-02', 1),
(1, 'T03', 'テーブル3', 'test-qr-token-table-03', 1),
(1, 'T04', 'テーブル4', 'test-qr-token-table-04', 1),
(1, 'C01', 'カウンター1', 'test-qr-token-counter-01', 1),
(1, 'C02', 'カウンター2', 'test-qr-token-counter-02', 1);

-- テンプレート設定作成
INSERT INTO template_configs (
  store_id,
  template_type,
  primary_color,
  sub_color,
  headline_text,
  sub_text
) VALUES (
  1,
  'yakiniku',
  '#1a1a1a',
  '#f59e0b',
  'このお店の"公式写真"に、あなたの一枚が選ばれるかも',
  '選ばれた方には、特別なサービスをご用意しています'
);
