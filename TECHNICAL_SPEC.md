# NOMINE 技術仕様書

## アーキテクチャ概要

### システム構成

```
┌─────────────────────────────────────────────────┐
│          Cloudflare Workers / Pages             │
│                                                 │
│  ┌───────────────────────────────────────────┐ │
│  │         Hono Application                   │ │
│  │                                            │ │
│  │  ┌──────────┐  ┌──────────┐  ┌─────────┐ │ │
│  │  │   Auth   │  │  Admin   │  │  Public │ │ │
│  │  │  Routes  │  │  Routes  │  │  Routes │ │ │
│  │  └──────────┘  └──────────┘  └─────────┘ │ │
│  │                                            │ │
│  │  ┌──────────────────────────────────────┐ │ │
│  │  │       Business Logic Layer          │ │ │
│  │  │  - 営業日管理                          │ │ │
│  │  │  - AI採点                             │ │ │
│  │  │  - 権限管理                            │ │ │
│  │  └──────────────────────────────────────┘ │ │
│  └────────────────┬───────────────────────────┘ │
│                   │                             │
│  ┌────────────────▼───────────────────────────┐ │
│  │        Cloudflare D1 Database              │ │
│  │         (SQLite distributed)               │ │
│  └───────────────────────────────────────────────┘ │
└─────────────────────────────────────────────────┘

         ┌────────────────────┐
         │   Frontend Apps    │
         ├────────────────────┤
         │  Consumer Entry    │  ← QRコード経由
         │  Admin Dashboard   │  ← 認証あり
         └────────────────────┘
```

## データベース設計詳細

### ERダイアグラム

```
users ──┬─────────── tenants
        │             │
        │             │
        └──── tenant_members
                      │
                      │
              ┌───────┴────────┐
              │                │
           stores         sessions
              │
              ├── store_tables
              ├── business_days ──── daily_settings
              └── template_configs
                  │
                  │
          submission_batches
                  │
                  ├── submissions ──── ai_scores
                  │                      │
                  └──────────────────────┴── adoptions
```

### テーブル詳細

#### users（ユーザー）
```sql
CREATE TABLE users (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  email TEXT UNIQUE NOT NULL,
  password_hash TEXT NOT NULL,
  role TEXT NOT NULL DEFAULT 'user',
  name TEXT,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);
```

**役割**:
- `master_admin`: システム全体管理者
- `tenant_admin`: テナント管理者
- `user`: 一般ユーザー

#### business_days（営業日）
営業日の概念:
- カレンダー日付ではなく、営業時間ベースで区切る
- 例: 17:00-25:00 → 2026-03-18 17:00 〜 2026-03-19 01:00 は同一営業日

```sql
CREATE TABLE business_days (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  store_id INTEGER NOT NULL,
  business_date DATE NOT NULL,           -- 営業日の基準日
  start_at DATETIME NOT NULL,            -- 実際の開始時刻
  end_at DATETIME NOT NULL,              -- 実際の終了時刻
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(store_id, business_date)
);
```

#### submissions（エントリー）
```sql
CREATE TABLE submissions (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  batch_id INTEGER NOT NULL,              -- 同時エントリーのバッチ
  store_id INTEGER NOT NULL,
  table_id INTEGER NOT NULL,
  business_day_id INTEGER NOT NULL,
  submission_type TEXT NOT NULL,          -- photo | video
  file_url TEXT NOT NULL,
  thumbnail_url TEXT,
  file_size INTEGER,
  mime_type TEXT,
  status TEXT NOT NULL DEFAULT 'pending', -- pending | adopted
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);
```

#### ai_scores（AI採点結果）
```sql
CREATE TABLE ai_scores (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  submission_id INTEGER NOT NULL,
  sizzle_score INTEGER NOT NULL DEFAULT 0,      -- シズル感
  composition_score INTEGER NOT NULL DEFAULT 0, -- 構図
  liveliness_score INTEGER NOT NULL DEFAULT 0,  -- 臨場感
  official_fit_score INTEGER NOT NULL DEFAULT 0,-- 公式適性
  total_score INTEGER NOT NULL DEFAULT 0,       -- 総合スコア
  ai_comment TEXT NOT NULL,                     -- AIコメント
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(submission_id)
);
```

## AI採点アルゴリズム

### 採点基準

#### 写真評価
```typescript
総合スコア = (
  シズル感 * 0.3 +
  構図     * 0.3 +
  臨場感   * 0.2 +
  公式適性 * 0.2
)

シズル感 = (
  食べ物の魅力 * 0.6 +
  色温度・色調 * 0.3 +
  明るさ       * 0.1
)

構図 = (
  基本構図           * 0.5 +
  主役の明確さ       * 0.3 +
  背景ノイズなし     * 0.2 +  // 0 or 30点
  シャープネス       * 0.2
)

臨場感 = (
  雰囲気品質         * 0.5 +
  被写体の立ち方     * 0.3 +
  被写体の存在       * 0.2   // 0 or 20点
)

公式適性 = (
  明るさ             * 0.25 +
  画質               * 0.25 +
  構図               * 0.25 +
  ノイズなし         * 0.25  // 0 or 25点
)
```

#### 動画評価
```typescript
総合スコア = (
  シズル感 * 0.3 +
  構図     * 0.25 +
  臨場感   * 0.25 +
  公式適性 * 0.2
)

// 各項目の詳細は写真と異なる指標を使用
```

### 業態別補正

```typescript
if (businessType === 'yakiniku' || businessType === 'izakaya') {
  sizzleScore *= 1.1;  // シズル重視
} else if (businessType === 'fine_dining') {
  compositionScore *= 1.1;  // 構図重視
} else if (businessType === 'cafe') {
  livelinessScore *= 1.1;  // 雰囲気重視
}
```

### コメント生成ルール

- 90点以上: プロカメラマン級
- 80-89点: 高品質
- 70-79点: 魅力的
- 60-69点: 良好、改善余地あり
- 40-59点: 具体的な改善提案
- 40点未満: 基本に立ち返る提案

## 営業日ロジック詳細

### 営業日判定フロー

```typescript
function getCurrentBusinessDay(store, now) {
  const openMinutes = timeToMinutes(store.business_open_time);
  const closeMinutes = timeToMinutes(store.business_close_time);
  
  let businessDate: Date;
  
  if (closeMinutes < openMinutes) {
    // 24時をまたぐ場合
    if (currentMinutes < closeMinutes) {
      // 深夜営業中（前日の営業日）
      businessDate = subtractDay(now);
    } else {
      // 当日営業
      businessDate = now;
    }
  } else {
    // 通常営業
    businessDate = now;
  }
  
  return getOrCreateBusinessDay(store.id, businessDate);
}
```

### 営業時間判定

```typescript
function isBusinessHours(store, now) {
  const openMinutes = timeToMinutes(store.business_open_time);
  const closeMinutes = timeToMinutes(store.business_close_time);
  const currentMinutes = getCurrentMinutes(now);
  
  if (closeMinutes < openMinutes) {
    // 24時をまたぐ
    return currentMinutes >= openMinutes || currentMinutes < closeMinutes;
  } else {
    // 通常営業
    return currentMinutes >= openMinutes && currentMinutes < closeMinutes;
  }
}
```

## 認証・権限管理

### JWT構造

```typescript
{
  userId: number,
  iat: number,   // 発行時刻
  exp: number    // 有効期限（7日後）
}
```

### 権限マトリクス

| 機能 | master_admin | tenant_admin | user |
|------|-------------|--------------|------|
| 全店舗閲覧 | ✅ | ❌ | ❌ |
| テナント作成 | ✅ | ❌ | ❌ |
| 自店舗管理 | ✅ | ✅ | ❌ |
| メンバー管理 | ✅ | ✅ | ❌ |
| 投稿閲覧 | ✅ | ✅ | ✅ (制限付き) |
| 素材選出 | ✅ | ✅ | ❌ |

### 権限チェックフロー

```typescript
async function canManageStore(db, user, storeId, masterEmail) {
  // マスター管理者チェック
  if (user.email === masterEmail && user.role === 'master_admin') {
    return true;
  }
  
  // 店舗のテナント取得
  const store = await getStore(db, storeId);
  
  // テナントメンバーシップ確認
  const member = await getTenantMember(db, user.id, store.tenant_id);
  
  return member && member.role === 'tenant_admin';
}
```

## API設計

### 認証フロー

```
1. POST /api/auth/register または POST /api/auth/login
   ↓
2. サーバーがJWTトークンを生成
   ↓
3. sessions テーブルに保存
   ↓
4. クライアントがトークンを localStorage に保存
   ↓
5. 以降のリクエストで Authorization: Bearer {token} ヘッダーを送信
   ↓
6. サーバーが middleware でトークン検証
```

### エラーレスポンス標準

```typescript
{
  error: string,      // エラーメッセージ
  status?: number,    // HTTPステータスコード
  details?: any       // 詳細情報（オプション）
}
```

### 成功レスポンス標準

```typescript
{
  success: true,
  data?: any,         // レスポンスデータ
  message?: string    // メッセージ（オプション）
}
```

## フロントエンド設計

### 状態管理（Vanilla JS）

```javascript
let appState = {
  user: null,
  store: null,
  currentView: 'loading',
  data: {},
  filters: {},
  // ...
};

function render() {
  // appState に基づいて UI を再レンダリング
}
```

### APIクライアント

```javascript
// axios を使用
axios.defaults.headers.common['Authorization'] = `Bearer ${token}`;

async function apiCall(url, options) {
  try {
    const response = await axios(url, options);
    return response.data;
  } catch (error) {
    handleError(error);
    throw error;
  }
}
```

## パフォーマンス最適化

### データベースインデックス

すべての外部キーにインデックスを設定済み:
- users.email
- tenants.owner_id
- submissions.store_id, table_id, business_day_id
- sessions.token, expires_at

### クエリ最適化

```sql
-- 悪い例（N+1問題）
SELECT * FROM submissions WHERE store_id = ?;
-- 各submissionに対してai_scoresを個別に取得

-- 良い例（JOIN使用）
SELECT s.*, ai.total_score, ai.ai_comment
FROM submissions s
LEFT JOIN ai_scores ai ON s.id = ai.submission_id
WHERE s.store_id = ?;
```

### フロントエンド最適化

- CDN経由でライブラリ読み込み
- 画像は thumbnail_url を優先表示
- 無限スクロール（LIMIT/OFFSET）
- debounce でフィルター処理

## セキュリティ対策

### SQLインジェクション対策

```typescript
// ✅ 正しい（プレースホルダ使用）
db.prepare('SELECT * FROM users WHERE email = ?').bind(email);

// ❌ 危険（文字列連結）
db.prepare(`SELECT * FROM users WHERE email = '${email}'`);
```

### XSS対策

```javascript
// HTMLエスケープ
function escapeHtml(text) {
  const div = document.createElement('div');
  div.textContent = text;
  return div.innerHTML;
}
```

### CORS設定

```typescript
app.use('*', async (c, next) => {
  c.header('Access-Control-Allow-Origin', '*');
  c.header('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE');
  c.header('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  await next();
});
```

## デプロイ戦略

### 環境分離

- **Local**: `.wrangler/state/v3/d1` でローカルSQLite
- **Staging**: Cloudflare D1 staging環境
- **Production**: Cloudflare D1 production環境

### マイグレーション管理

```bash
# ローカル
npm run db:migrate:local

# 本番（注意）
npm run db:migrate:prod
```

### ロールバック戦略

1. データベーススナップショット取得
2. アプリケーションコードのバージョン管理
3. 問題発生時は前バージョンに戻す

## モニタリング

### 推奨メトリクス

- エントリー数/日
- 選出率
- AI採点平均スコア
- API応答時間
- エラー率
- ユニークユーザー数

### ログ管理

Cloudflare Workers Logs で確認:
- エラーログ
- アクセスログ
- パフォーマンスログ

---

**開発チーム用内部資料 - 機密扱い**
