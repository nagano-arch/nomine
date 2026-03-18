// ロール定義
export enum Role {
  MASTER_ADMIN = 'master_admin',
  TENANT_ADMIN = 'tenant_admin',
  USER = 'user'
}

// ステータス
export enum Status {
  ACTIVE = 'active',
  INACTIVE = 'inactive',
  PENDING = 'pending',
  ADOPTED = 'adopted'
}

// 業態タイプ
export enum BusinessType {
  IZAKAYA = 'izakaya',
  YAKINIKU = 'yakiniku',
  CAFE = 'cafe',
  FINE_DINING = 'fine_dining',
  BAR = 'bar'
}

// エントリータイプ
export enum SubmissionType {
  PHOTO = 'photo',
  VIDEO = 'video'
}

// User
export interface User {
  id: number;
  email: string;
  password_hash: string;
  role: Role;
  name?: string;
  created_at: string;
  updated_at: string;
}

// Tenant
export interface Tenant {
  id: number;
  name: string;
  owner_id: number;
  created_by_master: number;
  status: string;
  created_at: string;
  updated_at: string;
}

// TenantMember
export interface TenantMember {
  id: number;
  tenant_id: number;
  user_id: number;
  role: Role;
  created_at: string;
}

// Session
export interface Session {
  id: number;
  user_id: number;
  token: string;
  expires_at: string;
  created_at: string;
}

// Store
export interface Store {
  id: number;
  tenant_id: number;
  name: string;
  business_type: BusinessType;
  template_type: BusinessType;
  business_open_time: string;
  business_close_time: string;
  photo_reward_text: string;
  video_reward_text: string;
  photo_adopt_limit: number;
  video_adopt_limit: number;
  is_active: number;
  created_at: string;
  updated_at: string;
}

// StoreTable
export interface StoreTable {
  id: number;
  store_id: number;
  table_code: string;
  table_name: string;
  qr_token: string;
  is_active: number;
  created_at: string;
  updated_at: string;
}

// BusinessDay
export interface BusinessDay {
  id: number;
  store_id: number;
  business_date: string;
  start_at: string;
  end_at: string;
  created_at: string;
}

// DailySetting
export interface DailySetting {
  id: number;
  store_id: number;
  business_day_id: number;
  photo_reward_text: string;
  video_reward_text: string;
  photo_adopt_limit: number;
  video_adopt_limit: number;
  photo_adopted_count: number;
  video_adopted_count: number;
  created_at: string;
  updated_at: string;
}

// SubmissionBatch
export interface SubmissionBatch {
  id: number;
  store_id: number;
  table_id: number;
  business_day_id: number;
  submission_type: SubmissionType;
  instagram_account?: string;
  consented_at: string;
  submitted_at: string;
  created_at: string;
}

// Submission
export interface Submission {
  id: number;
  batch_id: number;
  store_id: number;
  table_id: number;
  business_day_id: number;
  submission_type: SubmissionType;
  file_url: string;
  thumbnail_url?: string;
  file_size?: number;
  mime_type?: string;
  status: string;
  created_at: string;
  updated_at: string;
}

// AIScore
export interface AIScore {
  id: number;
  submission_id: number;
  sizzle_score: number;
  composition_score: number;
  liveliness_score: number;
  official_fit_score: number;
  total_score: number;
  ai_comment: string;
  created_at: string;
}

// Adoption
export interface Adoption {
  id: number;
  submission_id: number;
  store_id: number;
  reward_type: string;
  reward_text: string;
  adopted_by: number;
  adopted_at: string;
  created_at: string;
}

// TemplateConfig
export interface TemplateConfig {
  id: number;
  store_id: number;
  template_type: BusinessType;
  primary_color: string;
  sub_color: string;
  headline_text: string;
  sub_text: string;
  created_at: string;
  updated_at: string;
}

// Context types
export interface AuthContext {
  user: User;
  tenant?: Tenant;
  tenantMember?: TenantMember;
}

export type Bindings = {
  DB: D1Database;
  JWT_SECRET: string;
  MASTER_ADMIN_EMAIL: string;
  SESSION_EXPIRY_DAYS: string;
};
