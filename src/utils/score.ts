import type { Submission, AIScore, SubmissionType } from '../types';

/**
 * AI採点の評価軸
 */
interface ScoreComponents {
  sizzle_score: number;        // シズル感 (0-100)
  composition_score: number;    // 構図 (0-100)
  liveliness_score: number;     // 臨場感 (0-100)
  official_fit_score: number;   // 公式適性 (0-100)
}

/**
 * AI採点結果
 */
interface ScoreResult extends ScoreComponents {
  total_score: number;
  ai_comment: string;
}

/**
 * 写真の簡易解析（実際はVision APIなどを使用）
 * ここではルールベース + ランダム要素でプロトタイプ実装
 */
function analyzePhoto(fileUrl: string): ScoreComponents {
  // 実際の実装ではCloudflare AI、OpenAI Vision API、Google Vision APIなどを使用
  
  // プロトタイプ: ファイル名やメタデータから簡易判定
  // 実運用では画像解析APIを使用すること
  
  const baseScore = 60 + Math.floor(Math.random() * 30); // 60-90のベーススコア
  const variance = () => Math.floor(Math.random() * 20) - 10; // -10〜+10の変動
  
  return {
    sizzle_score: Math.max(0, Math.min(100, baseScore + variance())),
    composition_score: Math.max(0, Math.min(100, baseScore + variance())),
    liveliness_score: Math.max(0, Math.min(100, baseScore + variance())),
    official_fit_score: Math.max(0, Math.min(100, baseScore + variance()))
  };
}

/**
 * 動画の簡易解析
 */
function analyzeVideo(fileUrl: string): ScoreComponents {
  // 実際の実装では動画解析APIを使用
  
  const baseScore = 55 + Math.floor(Math.random() * 35); // 55-90のベーススコア
  const variance = () => Math.floor(Math.random() * 20) - 10;
  
  return {
    sizzle_score: Math.max(0, Math.min(100, baseScore + variance())),
    composition_score: Math.max(0, Math.min(100, baseScore + variance())),
    liveliness_score: Math.max(0, Math.min(100, baseScore + variance())),
    official_fit_score: Math.max(0, Math.min(100, baseScore + variance()))
  };
}

/**
 * スコアに応じたコメント生成
 */
function generateComment(scores: ScoreComponents, totalScore: number, type: SubmissionType): string {
  const { sizzle_score, composition_score, liveliness_score, official_fit_score } = scores;
  
  // 90点以上: プロ級
  if (totalScore >= 90) {
    const comments = [
      '素晴らしい完成度です。プロカメラマン級の仕上がりで、公式投稿に即採用できるレベルです。光の使い方、構図、シズル感のすべてが高次元でまとまっています。',
      '圧倒的なクオリティです。料理の魅力を最大限に引き出し、見る人の食欲を強く刺激する一枚です。公式素材として申し分ありません。',
      '完璧な構成です。臨場感とシズル感が両立されており、この店の世界観を見事に表現しています。公式Instagramの顔になり得る品質です。'
    ];
    return comments[Math.floor(Math.random() * comments.length)];
  }
  
  // 75-89点: 十分に高品質
  if (totalScore >= 75) {
    const comments = [
      '非常に魅力的な一枚です。シズル感と構図のバランスが良く、公式投稿でも十分に通用する完成度です。わずかな調整でさらに洗練されます。',
      '高いクオリティです。料理の美味しさがしっかり伝わり、臨場感も申し分ありません。公式候補として前向きに検討できるレベルです。',
      '素晴らしい仕上がりです。光の捉え方と被写体の見せ方が上手く、店の魅力を十分に表現できています。'
    ];
    return comments[Math.floor(Math.random() * comments.length)];
  }
  
  // 60-74点: 良好だが改善の余地あり
  if (totalScore >= 60) {
    let weakPoint = '';
    const minScore = Math.min(sizzle_score, composition_score, liveliness_score, official_fit_score);
    
    if (minScore === sizzle_score) {
      weakPoint = 'シズル感をもう少し強調できると、さらに食欲を刺激する一枚になります。';
    } else if (minScore === composition_score) {
      weakPoint = '構図を少し整理し、主役をより明確にすることで、印象が一段と強まります。';
    } else if (minScore === liveliness_score) {
      weakPoint = '臨場感がもう少し加わると、その場の空気感がより伝わりやすくなります。';
    } else {
      weakPoint = '全体的な統一感を高めることで、公式素材としての完成度がさらに上がります。';
    }
    
    return `良い仕上がりです。料理の魅力は伝わっていますが、${weakPoint}`;
  }
  
  // 40-59点: 改善が必要
  if (totalScore >= 40) {
    const comments = [
      '料理自体の魅力は感じられますが、背景の情報量が多く、主役がやや弱く見えています。構図を整理することで、印象が大きく変わります。',
      '明るさが少し不足しており、料理の魅力が十分に伝わりきっていません。照明を工夫すると、一気に印象が向上します。',
      '被写体の捉え方は悪くありませんが、全体的に平坦な印象です。角度や距離を調整することで、より立体的な表現が可能です。'
    ];
    return comments[Math.floor(Math.random() * comments.length)];
  }
  
  // 39点以下: 大幅な改善が必要
  const comments = [
    'ブレや暗さが目立ち、料理の魅力が伝わりにくい状態です。照明とカメラの安定性を意識すると、大きく改善できます。',
    '構図や光のバランスに課題があり、公式利用には向かない状態です。撮影環境を整えることで、品質が大幅に向上します。',
    '残念ながら、現状では店の魅力を損なう可能性があります。基本的な撮影技術を見直すことで、次回は大きく改善できるはずです。'
  ];
  return comments[Math.floor(Math.random() * comments.length)];
}

/**
 * エントリーをAI採点
 */
export async function scoreSubmission(
  db: D1Database,
  submission: Submission
): Promise<AIScore> {
  // 既に採点済みかチェック
  const existing = await db
    .prepare('SELECT * FROM ai_scores WHERE submission_id = ?')
    .bind(submission.id)
    .first<AIScore>();
  
  if (existing) {
    return existing;
  }
  
  // AI採点実行
  const scores = submission.submission_type === 'photo'
    ? analyzePhoto(submission.file_url)
    : analyzeVideo(submission.file_url);
  
  // 総合スコア計算（各軸の平均）
  const total_score = Math.round(
    (scores.sizzle_score + scores.composition_score + scores.liveliness_score + scores.official_fit_score) / 4
  );
  
  // コメント生成
  const ai_comment = generateComment(scores, total_score, submission.submission_type);
  
  // DBに保存
  const aiScore = await db
    .prepare(
      `INSERT INTO ai_scores 
      (submission_id, sizzle_score, composition_score, liveliness_score, official_fit_score, total_score, ai_comment)
      VALUES (?, ?, ?, ?, ?, ?, ?) RETURNING *`
    )
    .bind(
      submission.id,
      scores.sizzle_score,
      scores.composition_score,
      scores.liveliness_score,
      scores.official_fit_score,
      total_score,
      ai_comment
    )
    .first<AIScore>();
  
  if (!aiScore) {
    throw new Error('Failed to create AI score');
  }
  
  return aiScore;
}

/**
 * バッチ内の全エントリーを採点
 */
export async function scoreBatchSubmissions(
  db: D1Database,
  batchId: number
): Promise<AIScore[]> {
  // バッチ内のすべてのエントリーを取得
  const submissions = await db
    .prepare('SELECT * FROM submissions WHERE batch_id = ?')
    .bind(batchId)
    .all<Submission>();
  
  const scores: AIScore[] = [];
  
  for (const submission of submissions.results || []) {
    const score = await scoreSubmission(db, submission);
    scores.push(score);
  }
  
  return scores;
}
