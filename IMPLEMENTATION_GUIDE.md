# NOMINE 実装ガイド - Cloudflare Workers対応版

## 🚨 重要: 現在の実装状況と次のステップ

### 現在の状態
- ✅ データベース設計完了（13テーブル）
- ✅ API設計・実装完了
- ✅ UI実装完了（消費者向け + 管理画面）
- ❌ **Cloudflare Workers環境で動作しない**

### 問題点
`bcryptjs`と`jsonwebtoken`がNode.js組み込みモジュールに依存しているため、Cloudflare Workers環境では動作しません。

## 解決策: Web標準APIへの移行

### 1. パスワードハッシュ化の置き換え

#### 現在のコード（動作しない）
```typescript
import bcrypt from 'bcryptjs';

export async function hashPassword(password: string): Promise<string> {
  return bcrypt.hash(password, 10);
}

export async function verifyPassword(password: string, hash: string): Promise<boolean> {
  return bcrypt.compare(password, hash);
}
```

#### 修正後のコード（Cloudflare Workers対応）
```typescript
// src/auth.ts

/**
 * Web Crypto APIを使用したパスワードハッシュ化
 */
async function deriveKey(password: string, salt: Uint8Array): Promise<ArrayBuffer> {
  const encoder = new TextEncoder();
  const passwordKey = await crypto.subtle.importKey(
    'raw',
    encoder.encode(password),
    'PBKDF2',
    false,
    ['deriveBits']
  );

  return await crypto.subtle.deriveBits(
    {
      name: 'PBKDF2',
      salt: salt,
      iterations: 100000,
      hash: 'SHA-256'
    },
    passwordKey,
    256
  );
}

export async function hashPassword(password: string): Promise<string> {
  const salt = crypto.getRandomValues(new Uint8Array(16));
  const derivedKey = await deriveKey(password, salt);
  
  // salt + hash を結合して base64 エンコード
  const combined = new Uint8Array(salt.length + new Uint8Array(derivedKey).length);
  combined.set(salt);
  combined.set(new Uint8Array(derivedKey), salt.length);
  
  return btoa(String.fromCharCode(...combined));
}

export async function verifyPassword(password: string, hash: string): Promise<boolean> {
  try {
    const combined = Uint8Array.from(atob(hash), c => c.charCodeAt(0));
    const salt = combined.slice(0, 16);
    const storedHash = combined.slice(16);
    
    const derivedKey = await deriveKey(password, salt);
    const derivedArray = new Uint8Array(derivedKey);
    
    // タイミング攻撃対策のため、すべてのバイトを比較
    if (storedHash.length !== derivedArray.length) return false;
    
    let diff = 0;
    for (let i = 0; i < storedHash.length; i++) {
      diff |= storedHash[i] ^ derivedArray[i];
    }
    
    return diff === 0;
  } catch {
    return false;
  }
}
```

### 2. JWTの置き換え

#### 現在のコード（動作しない）
```typescript
import jwt from 'jsonwebtoken';

export function generateToken(userId: number, secret: string): string {
  return jwt.sign({ userId }, secret, { expiresIn: '7d' });
}

export function verifyToken(token: string, secret: string): { userId: number } | null {
  try {
    return jwt.verify(token, secret) as { userId: number };
  } catch {
    return null;
  }
}
```

#### 修正後のコード（jose library使用）

**インストール:**
```bash
npm install jose
```

**実装:**
```typescript
// src/auth.ts
import { SignJWT, jwtVerify } from 'jose';

export async function generateToken(userId: number, secret: string): Promise<string> {
  const encoder = new TextEncoder();
  const secretKey = encoder.encode(secret);

  return await new SignJWT({ userId })
    .setProtectedHeader({ alg: 'HS256' })
    .setIssuedAt()
    .setExpirationTime('7d')
    .sign(secretKey);
}

export async function verifyToken(
  token: string,
  secret: string
): Promise<{ userId: number } | null> {
  try {
    const encoder = new TextEncoder();
    const secretKey = encoder.encode(secret);

    const { payload } = await jwtVerify(token, secretKey);
    return { userId: payload.userId as number };
  } catch {
    return null;
  }
}
```

### 3. セッション作成の修正

```typescript
// src/auth.ts

export async function createSession(
  db: D1Database,
  userId: number,
  token: string,
  expiryDays: number
): Promise<Session> {
  const expiresAt = new Date();
  expiresAt.setDate(expiresAt.getDate() + expiryDays);

  const result = await db
    .prepare(
      'INSERT INTO sessions (user_id, token, expires_at) VALUES (?, ?, ?) RETURNING *'
    )
    .bind(userId, token, expiresAt.toISOString())
    .first<Session>();

  if (!result) {
    throw new Error('Failed to create session');
  }

  return result;
}
```

### 4. 認証ルートの修正

```typescript
// src/routes/auth.ts

/**
 * ログイン
 */
auth.post('/login', async (c) => {
  try {
    const { email, password } = await c.req.json();

    if (!email || !password) {
      return c.json({ error: 'Email and password are required' }, 400);
    }

    const { DB, JWT_SECRET, SESSION_EXPIRY_DAYS } = c.env;

    const user = await getUserByEmail(DB, email);
    if (!user) {
      return c.json({ error: 'Invalid credentials' }, 401);
    }

    const valid = await verifyPassword(password, user.password_hash);
    if (!valid) {
      return c.json({ error: 'Invalid credentials' }, 401);
    }

    // await を追加
    const token = await generateToken(user.id, JWT_SECRET);

    const expiryDays = parseInt(SESSION_EXPIRY_DAYS || '7', 10);
    await createSession(DB, user.id, token, expiryDays);

    const { password_hash, ...userWithoutPassword } = user;

    return c.json({
      success: true,
      user: userWithoutPassword,
      token
    });
  } catch (error) {
    console.error('Login error:', error);
    return c.json({ error: safeErrorMessage(error) }, 500);
  }
});
```

### 5. ミドルウェアの修正

```typescript
// src/middleware.ts

export async function authMiddleware(
  c: Context<{ Bindings: Bindings }>,
  next: Next
) {
  const authHeader = c.req.header('Authorization');

  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return c.json({ error: 'Unauthorized' }, 401);
  }

  const token = authHeader.substring(7);
  const { DB, JWT_SECRET } = c.env;

  // トークン検証（await を追加）
  const decoded = await verifyToken(token, JWT_SECRET);
  
  if (!decoded) {
    return c.json({ error: 'Invalid token' }, 401);
  }

  // セッション検証
  const session = await validateSession(DB, token);

  if (!session) {
    return c.json({ error: 'Invalid or expired session' }, 401);
  }

  const user = await getUserById(DB, session.user_id);

  if (!user) {
    return c.json({ error: 'User not found' }, 401);
  }

  c.set('user', user);
  c.set('token', token);

  await next();
}
```

## 実装手順

### ステップ1: 依存関係の更新

```bash
# 古いパッケージを削除
npm uninstall bcryptjs @types/bcryptjs jsonwebtoken @types/jsonwebtoken

# joseをインストール
npm install jose
```

### ステップ2: src/auth.ts を完全に書き直す

上記の「修正後のコード」を使用して、`src/auth.ts` を完全に書き直します。

### ステップ3: src/routes/auth.ts を修正

`generateToken` の呼び出しに `await` を追加します。

### ステップ4: src/middleware.ts を修正

`verifyToken` の呼び出しに `await` を追加します。

### ステップ5: シードデータの再生成

新しいハッシュ化方式でパスワードハッシュを生成します:

```typescript
// テストスクリプト（test-hash.ts）
import { hashPassword } from './src/auth';

async function generateTestHashes() {
  const masterPassword = 'master123456';
  const ownerPassword = 'owner123456';
  
  const masterHash = await hashPassword(masterPassword);
  const ownerHash = await hashPassword(ownerPassword);
  
  console.log('Master password hash:', masterHash);
  console.log('Owner password hash:', ownerHash);
}

generateTestHashes();
```

```bash
# 実行
npx tsx test-hash.ts
```

生成されたハッシュを `seed.sql` に反映します。

### ステップ6: ビルドとテスト

```bash
# ビルド
npm run build

# PM2で起動
pm2 delete nomine 2>/dev/null || true
pm2 start ecosystem.config.cjs

# テスト
curl -X POST http://localhost:3000/api/auth/register \
  -H "Content-Type: application/json" \
  -d '{"email":"test@example.com","password":"test1234","name":"Test User"}'
```

## ファイルアップロードの実装

### Cloudflare R2統合

```typescript
// src/routes/public-entry.ts

publicEntry.post('/:qrToken/upload', async (c) => {
  try {
    const qrToken = c.req.param('qrToken');
    const { DB, R2 } = c.env;  // R2バインディング追加

    // FormData取得
    const formData = await c.req.formData();
    const files = formData.getAll('files') as File[];

    if (files.length === 0) {
      return c.json({ error: 'No files provided' }, 400);
    }

    const uploadedFiles = [];

    for (const file of files) {
      // ファイル名生成
      const filename = `${Date.now()}-${Math.random().toString(36).substring(2, 15)}`;
      const extension = file.name.split('.').pop();
      const key = `uploads/${filename}.${extension}`;

      // R2にアップロード
      await R2.put(key, file.stream(), {
        httpMetadata: {
          contentType: file.type
        }
      });

      // サムネイル生成（Cloudflare Imagesまたは外部サービス）
      const thumbnailKey = `thumbnails/${filename}.${extension}`;
      // TODO: サムネイル生成処理

      uploadedFiles.push({
        file_url: `https://your-r2-domain.com/${key}`,
        thumbnail_url: `https://your-r2-domain.com/${thumbnailKey}`,
        file_size: file.size,
        mime_type: file.type
      });
    }

    return c.json({
      success: true,
      files: uploadedFiles
    });
  } catch (error) {
    console.error('Upload error:', error);
    return c.json({ error: safeErrorMessage(error) }, 500);
  }
});
```

### wrangler.jsonc にR2バインディング追加

```jsonc
{
  "name": "nomine",
  "main": "src/index.ts",
  "compatibility_date": "2024-01-01",
  "compatibility_flags": ["nodejs_compat"],
  "pages_build_output_dir": "./dist",

  "d1_databases": [
    {
      "binding": "DB",
      "database_name": "nomine-production",
      "database_id": "your-database-id-here"
    }
  ],

  "r2_buckets": [
    {
      "binding": "R2",
      "bucket_name": "nomine-uploads"
    }
  ],

  "vars": {
    "JWT_SECRET": "your-jwt-secret-change-in-production",
    "MASTER_ADMIN_EMAIL": "master-admin@yourdomain.com",
    "SESSION_EXPIRY_DAYS": "7"
  }
}
```

### types.ts にR2追加

```typescript
export type Bindings = {
  DB: D1Database;
  R2: R2Bucket;  // 追加
  JWT_SECRET: string;
  MASTER_ADMIN_EMAIL: string;
  SESSION_EXPIRY_DAYS: string;
};
```

## AI採点の実装

### Cloudflare AI統合

```typescript
// src/utils/score.ts

import type { Ai } from '@cloudflare/workers-types';

export async function scoreSubmission(
  fileUrl: string,
  submissionType: SubmissionType,
  businessType: BusinessType,
  ai: Ai  // Cloudflare AI
): Promise<ScoreResult> {
  try {
    if (submissionType === 'photo') {
      // Cloudflare AI Vision APIを使用
      const analysis = await ai.run('@cf/llava-hf/llava-1.5-7b-hf', {
        image: await fetchImageAsArray(fileUrl),
        prompt: `この料理写真を以下の観点で100点満点で評価してください:
          1. シズル感（湯気、照り、食欲訴求）
          2. 構図（主役の明確さ、背景整理）
          3. 臨場感（雰囲気、魅力）
          4. 公式SNS投稿としての適性
          
          JSON形式で以下を返してください:
          {
            "sizzle_score": 0-100,
            "composition_score": 0-100,
            "liveliness_score": 0-100,
            "official_fit_score": 0-100,
            "comment": "評価コメント"
          }`
      });

      const result = JSON.parse(analysis.response);
      
      return {
        sizzle_score: result.sizzle_score,
        composition_score: result.composition_score,
        liveliness_score: result.liveliness_score,
        official_fit_score: result.official_fit_score,
        total_score: Math.round(
          (result.sizzle_score * 0.3 + 
           result.composition_score * 0.3 + 
           result.liveliness_score * 0.2 + 
           result.official_fit_score * 0.2)
        ),
        ai_comment: result.comment
      };
    } else {
      // 動画の場合（別処理）
      return scoreVideoSimple(fileUrl, businessType);
    }
  } catch (error) {
    console.error('AI scoring error:', error);
    // フォールバック: ルールベース採点
    return fallbackScoring(fileUrl, submissionType, businessType);
  }
}

async function fetchImageAsArray(url: string): Promise<number[]> {
  const response = await fetch(url);
  const buffer = await response.arrayBuffer();
  return Array.from(new Uint8Array(buffer));
}
```

### wrangler.jsonc にAIバインディング追加

```jsonc
{
  "ai": {
    "binding": "AI"
  }
}
```

### types.ts にAI追加

```typescript
import type { Ai } from '@cloudflare/workers-types';

export type Bindings = {
  DB: D1Database;
  R2: R2Bucket;
  AI: Ai;  // 追加
  JWT_SECRET: string;
  MASTER_ADMIN_EMAIL: string;
  SESSION_EXPIRY_DAYS: string;
};
```

## 最終チェックリスト

- [ ] `bcryptjs` と `jsonwebtoken` を削除
- [ ] `jose` をインストール
- [ ] `src/auth.ts` を完全に書き直し
- [ ] `src/routes/auth.ts` を修正（await追加）
- [ ] `src/middleware.ts` を修正（await追加）
- [ ] `seed.sql` のパスワードハッシュを更新
- [ ] R2バインディング追加（ファイルアップロード用）
- [ ] AIバインディング追加（AI採点用）
- [ ] ビルドが成功することを確認
- [ ] ローカルテストが通ることを確認
- [ ] Cloudflare Pagesにデプロイ
- [ ] 本番環境でテスト

## トラブルシューティング

### ビルドエラー

**問題**: `Could not resolve "crypto"`
**解決**: `bcryptjs`と`jsonwebtoken`が完全に削除されていることを確認

**問題**: `Module not found: jose`
**解決**: `npm install jose` を実行

### 認証エラー

**問題**: ログインできない
**解決**: 
1. パスワードハッシュが新方式で生成されているか確認
2. JWT_SECRETが設定されているか確認
3. セッションテーブルにレコードが作成されているか確認

### ファイルアップロードエラー

**問題**: R2にアップロードできない
**解決**:
1. wrangler.jsoncにr2_bucketsが設定されているか確認
2. バケットが作成されているか確認: `wrangler r2 bucket list`
3. types.tsにR2Bucketが追加されているか確認

---

**このガイドに従って実装すれば、Cloudflare Workers環境で完全に動作するNOMINEが完成します。**
