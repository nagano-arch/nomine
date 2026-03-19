/**
 * Amazon S3 Integration Module
 * 画像・動画のアップロードとダウンロード管理
 */

import { S3Client, PutObjectCommand, GetObjectCommand, DeleteObjectCommand, HeadObjectCommand } from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';

// S3クライアントの初期化
let s3Client: S3Client | null = null;

function getS3Client(): S3Client {
  if (!s3Client) {
    s3Client = new S3Client({
      region: process.env.AWS_REGION || 'ap-northeast-1',
      credentials: process.env.AWS_ACCESS_KEY_ID && process.env.AWS_SECRET_ACCESS_KEY
        ? {
            accessKeyId: process.env.AWS_ACCESS_KEY_ID,
            secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY
          }
        : undefined // Lambda実行ロールを使用
    });
  }
  return s3Client;
}

const BUCKET_NAME = process.env.S3_BUCKET_NAME || 'nomine-uploads';

/**
 * ファイルキーの生成
 */
export function generateFileKey(
  storeId: number,
  mediaType: 'photo' | 'video',
  originalName: string
): string {
  const timestamp = Date.now();
  const random = Math.random().toString(36).substring(2, 15);
  const extension = originalName.split('.').pop() || (mediaType === 'photo' ? 'jpg' : 'mp4');
  
  return `stores/${storeId}/${mediaType}s/${timestamp}-${random}.${extension}`;
}

/**
 * サムネイルキーの生成
 */
export function generateThumbnailKey(originalKey: string): string {
  const parts = originalKey.split('/');
  const filename = parts[parts.length - 1];
  const nameWithoutExt = filename.substring(0, filename.lastIndexOf('.'));
  
  parts[parts.length - 1] = `thumb_${nameWithoutExt}.jpg`;
  return parts.join('/');
}

/**
 * S3へのファイルアップロード
 */
export async function uploadToS3(
  fileKey: string,
  fileBuffer: Buffer,
  contentType: string,
  metadata?: Record<string, string>
): Promise<{ key: string; url: string }> {
  const client = getS3Client();

  const command = new PutObjectCommand({
    Bucket: BUCKET_NAME,
    Key: fileKey,
    Body: fileBuffer,
    ContentType: contentType,
    Metadata: metadata || {},
    ServerSideEncryption: 'AES256' // 暗号化を有効化
  });

  await client.send(command);

  // 公開URLの生成（CloudFront経由を推奨）
  const url = process.env.CLOUDFRONT_DOMAIN
    ? `https://${process.env.CLOUDFRONT_DOMAIN}/${fileKey}`
    : `https://${BUCKET_NAME}.s3.${process.env.AWS_REGION || 'ap-northeast-1'}.amazonaws.com/${fileKey}`;

  return { key: fileKey, url };
}

/**
 * 署名付きアップロードURL生成（クライアント直接アップロード用）
 */
export async function getPresignedUploadUrl(
  fileKey: string,
  contentType: string,
  expiresIn: number = 300 // 5分
): Promise<string> {
  const client = getS3Client();

  const command = new PutObjectCommand({
    Bucket: BUCKET_NAME,
    Key: fileKey,
    ContentType: contentType
  });

  return getSignedUrl(client, command, { expiresIn });
}

/**
 * 署名付きダウンロードURL生成
 */
export async function getPresignedDownloadUrl(
  fileKey: string,
  expiresIn: number = 3600 // 1時間
): Promise<string> {
  const client = getS3Client();

  const command = new GetObjectCommand({
    Bucket: BUCKET_NAME,
    Key: fileKey
  });

  return getSignedUrl(client, command, { expiresIn });
}

/**
 * S3からファイルを取得
 */
export async function getFileFromS3(fileKey: string): Promise<Buffer> {
  const client = getS3Client();

  const command = new GetObjectCommand({
    Bucket: BUCKET_NAME,
    Key: fileKey
  });

  const response = await client.send(command);
  
  if (!response.Body) {
    throw new Error('File not found in S3');
  }

  // StreamをBufferに変換
  const chunks: Uint8Array[] = [];
  for await (const chunk of response.Body as any) {
    chunks.push(chunk);
  }
  
  return Buffer.concat(chunks);
}

/**
 * S3からファイルを削除
 */
export async function deleteFromS3(fileKey: string): Promise<void> {
  const client = getS3Client();

  const command = new DeleteObjectCommand({
    Bucket: BUCKET_NAME,
    Key: fileKey
  });

  await client.send(command);
}

/**
 * 複数ファイルの一括削除
 */
export async function deleteBatchFromS3(fileKeys: string[]): Promise<void> {
  await Promise.all(fileKeys.map(key => deleteFromS3(key)));
}

/**
 * ファイルの存在確認
 */
export async function fileExistsInS3(fileKey: string): Promise<boolean> {
  const client = getS3Client();

  try {
    const command = new HeadObjectCommand({
      Bucket: BUCKET_NAME,
      Key: fileKey
    });

    await client.send(command);
    return true;
  } catch (error: any) {
    if (error.name === 'NotFound') {
      return false;
    }
    throw error;
  }
}

/**
 * ファイルサイズの取得
 */
export async function getFileSize(fileKey: string): Promise<number> {
  const client = getS3Client();

  const command = new HeadObjectCommand({
    Bucket: BUCKET_NAME,
    Key: fileKey
  });

  const response = await client.send(command);
  return response.ContentLength || 0;
}

/**
 * Base64文字列からバッファへの変換
 */
export function base64ToBuffer(base64: string): Buffer {
  // data:image/jpeg;base64, のようなプレフィックスを削除
  const base64Data = base64.includes(',') ? base64.split(',')[1] : base64;
  return Buffer.from(base64Data, 'base64');
}

/**
 * Content-Typeの推測
 */
export function getContentType(filename: string): string {
  const ext = filename.split('.').pop()?.toLowerCase();
  
  const mimeTypes: Record<string, string> = {
    jpg: 'image/jpeg',
    jpeg: 'image/jpeg',
    png: 'image/png',
    gif: 'image/gif',
    webp: 'image/webp',
    mp4: 'video/mp4',
    mov: 'video/quicktime',
    avi: 'video/x-msvideo',
    webm: 'video/webm'
  };

  return mimeTypes[ext || ''] || 'application/octet-stream';
}

/**
 * ファイルサイズのバリデーション
 */
export function validateFileSize(
  sizeInBytes: number,
  maxSizeMB: number = 50
): { valid: boolean; error?: string } {
  const maxSizeBytes = maxSizeMB * 1024 * 1024;
  
  if (sizeInBytes > maxSizeBytes) {
    return {
      valid: false,
      error: `File size exceeds maximum allowed size of ${maxSizeMB}MB`
    };
  }
  
  return { valid: true };
}

/**
 * ファイルタイプのバリデーション
 */
export function validateFileType(
  contentType: string,
  allowedTypes: string[] = ['image/jpeg', 'image/png', 'image/webp', 'video/mp4', 'video/quicktime']
): { valid: boolean; error?: string } {
  if (!allowedTypes.includes(contentType)) {
    return {
      valid: false,
      error: `File type ${contentType} is not allowed. Allowed types: ${allowedTypes.join(', ')}`
    };
  }
  
  return { valid: true };
}

/**
 * サムネイル生成（簡易版 - 実際にはLambda Layerやサードパーティサービスを推奨）
 */
export async function generateThumbnail(
  originalBuffer: Buffer,
  maxWidth: number = 400,
  maxHeight: number = 400
): Promise<Buffer> {
  // 実装例：Sharp、Jimp、またはAWS Rekognitionを使用
  // ここではプレースホルダーとして元のバッファを返す
  // 本番環境では画像処理ライブラリを使用してください
  
  console.warn('Thumbnail generation not implemented - returning original buffer');
  return originalBuffer;
}
