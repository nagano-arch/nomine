/**
 * メールアドレスバリデーション
 */
export function isValidEmail(email: string): boolean {
  const regex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return regex.test(email);
}

/**
 * パスワードバリデーション（最小8文字）
 */
export function isValidPassword(password: string): boolean {
  return password.length >= 8;
}

/**
 * Instagramアカウント名のクリーンアップ
 */
export function cleanInstagramAccount(account: string): string {
  // @を削除し、トリム
  return account.replace('@', '').trim();
}

/**
 * QRトークン生成
 */
export function generateQRToken(): string {
  return `${Date.now()}-${Math.random().toString(36).substring(2, 15)}`;
}

/**
 * 安全なエラーメッセージ生成
 */
export function safeErrorMessage(error: unknown): string {
  if (error instanceof Error) {
    return error.message;
  }
  return 'An unknown error occurred';
}

/**
 * 日時フォーマット（JST）
 */
export function formatDateJST(date: Date | string): string {
  const d = typeof date === 'string' ? new Date(date) : date;
  return new Intl.DateTimeFormat('ja-JP', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    timeZone: 'Asia/Tokyo'
  }).format(d);
}
