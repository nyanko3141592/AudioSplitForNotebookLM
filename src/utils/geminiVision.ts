// Gemini Vision API integration for visual capture analysis
import type { CaptureAnalysis } from '../types/visualCapture';

export interface GeminiVisionResponse {
  description: string;
  tokens: number;
  confidence?: number;
}

export class GeminiVisionAnalyzer {
  private apiKey: string;
  private apiEndpoint: string;
  private model: string;

  constructor(
    apiKey: string, 
    apiEndpoint: string = 'https://generativelanguage.googleapis.com',
    model: string = 'gemini-2.0-flash-lite'
  ) {
    this.apiKey = apiKey;
    this.apiEndpoint = apiEndpoint;
    this.model = model;
  }

  /**
   * 画像を分析してその内容を説明
   */
  public async analyzeImage(imageData: string, customPrompt?: string): Promise<GeminiVisionResponse> {
    if (!this.apiKey) {
      throw new Error('Gemini API key is required for visual analysis');
    }

    try {
      // base64画像データからMIME部分を除去
      const base64Image = imageData.replace(/^data:image\/[a-z]+;base64,/, '');
      
      const prompt = customPrompt || this.getDefaultPrompt();

      const requestBody = {
        contents: [
          {
            parts: [
              {
                text: prompt
              },
              {
                inline_data: {
                  mime_type: "image/jpeg",
                  data: base64Image
                }
              }
            ]
          }
        ],
        generationConfig: {
          temperature: 0.4,
          topK: 32,
          topP: 1,
          maxOutputTokens: 200,  // 短い説明に制限してコスト削減
        }
      };

      const response = await fetch(
        `${this.apiEndpoint}/v1beta/models/${this.model}:generateContent?key=${this.apiKey}`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json'
          },
          body: JSON.stringify(requestBody)
        }
      );

      if (!response.ok) {
        const errorData = await response.json().catch(() => null);
        throw new Error(
          `Gemini Vision API error: ${response.status} ${response.statusText}${
            errorData?.error?.message ? ` - ${errorData.error.message}` : ''
          }`
        );
      }

      const data = await response.json();
      
      if (!data.candidates || !data.candidates[0] || !data.candidates[0].content) {
        throw new Error('Invalid response from Gemini Vision API');
      }

      const description = data.candidates[0].content.parts[0].text;
      const tokens = data.usageMetadata?.totalTokenCount || 1000; // フォールバック値

      console.log('🤖 Gemini Vision analysis completed:', {
        description: description.substring(0, 50) + '...',
        tokens
      });

      return {
        description: description.trim(),
        tokens,
        confidence: this.calculateConfidence(data.candidates[0])
      };

    } catch (error) {
      console.error('❌ Gemini Vision analysis failed:', error);
      throw error;
    }
  }

  /**
   * 複数の画像を一括で分析
   */
  public async analyzeBatch(
    captures: CaptureAnalysis[],
    onProgress?: (current: number, total: number) => void
  ): Promise<CaptureAnalysis[]> {
    const results: CaptureAnalysis[] = [];
    
    for (let i = 0; i < captures.length; i++) {
      const capture = captures[i];
      onProgress?.(i + 1, captures.length);

      if (capture.imageData && !capture.description) {
        try {
          const analysis = await this.analyzeImage(capture.imageData);
          results.push({
            ...capture,
            description: analysis.description,
            tokens: analysis.tokens,
            confidence: analysis.confidence
          });

          // API制限を考慮して少し待機
          if (i < captures.length - 1) {
            await new Promise(resolve => setTimeout(resolve, 1000));
          }
        } catch (error) {
          console.error(`Failed to analyze capture ${capture.id}:`, error);
          results.push({
            ...capture,
            error: error instanceof Error ? error.message : 'Analysis failed'
          });
        }
      } else {
        results.push(capture);
      }
    }

    return results;
  }

  /**
   * デフォルトの分析プロンプト
   */
  private getDefaultPrompt(): string {
    return `この画面キャプチャを見て、以下の観点から簡潔に説明してください：

1. 表示されているサービス・アプリケーション名（YouTube、Zoom、ブラウザなど）
2. 現在の画面の主要な内容（会議中、動画視聴、ウェブ閲覧、プレゼンテーションなど）
3. 特徴的な要素や状況（参加者数、動画タイトル、主要なテキストなど）

日本語で100文字以内で要点をまとめてください。技術的詳細や小さな文字は省略してください。`;
  }

  /**
   * 複数の画像分析結果をまとめてサマリーを生成
   */
  public async generateSummary(analyses: CaptureAnalysis[]): Promise<string> {
    if (!this.apiKey) {
      throw new Error('Gemini API key is required for summary generation');
    }

    const validAnalyses = analyses.filter(a => a.description && !a.error);
    if (validAnalyses.length === 0) {
      return '※ 分析可能な画面キャプチャがありませんでした';
    }

    // 個別の分析結果をまとめてプロンプトを作成
    const analysisText = validAnalyses.map((analysis, index) => {
      const timeStr = formatRecordingTime(analysis.recordingTime);
      return `${index + 1}. ${timeStr}: ${analysis.description}`;
    }).join('\n');

    const summaryPrompt = `以下は録音中に定期的にキャプチャした画面の分析結果です。これらの情報を総合して、録音セッション全体の文脈や背景情報を簡潔にまとめてください。

画面分析結果:
${analysisText}

要求:
- 録音内容の理解に役立つ重要な文脈情報を抽出
- 画面に表示されたサービス・アプリケーション・内容の変遷を整理
- 特徴的な情報や状況の変化があれば強調
- 300文字以内で簡潔にまとめる

日本語でまとめてください。`;

    try {
      const requestBody = {
        contents: [{
          parts: [{ text: summaryPrompt }]
        }],
        generationConfig: {
          temperature: 0.3,
          topK: 32,
          topP: 1,
          maxOutputTokens: 400,
        }
      };

      const response = await fetch(
        `${this.apiEndpoint}/v1beta/models/${this.model}:generateContent?key=${this.apiKey}`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(requestBody)
        }
      );

      if (!response.ok) {
        const errorData = await response.json().catch(() => null);
        throw new Error(
          `Gemini summary API error: ${response.status} ${response.statusText}${
            errorData?.error?.message ? ` - ${errorData.error.message}` : ''
          }`
        );
      }

      const data = await response.json();
      
      if (!data.candidates || !data.candidates[0] || !data.candidates[0].content) {
        throw new Error('Invalid response from Gemini summary API');
      }

      const summary = data.candidates[0].content.parts[0].text;
      console.log('🤖 Visual summary generated:', summary.substring(0, 50) + '...');
      
      return summary.trim();

    } catch (error) {
      console.error('❌ Visual summary generation failed:', error);
      throw error;
    }
  }

  /**
   * レスポンスから信頼度を算出
   */
  private calculateConfidence(candidate: any): number {
    // Geminiの安全性フィルタリング結果から信頼度を推測
    if (candidate.safetyRatings) {
      const avgProbability = candidate.safetyRatings.reduce((acc: number, rating: any) => {
        const probabilityScore = this.probabilityToScore(rating.probability);
        return acc + probabilityScore;
      }, 0) / candidate.safetyRatings.length;
      
      return Math.max(0.1, Math.min(1.0, avgProbability));
    }
    
    return 0.8; // デフォルト値
  }

  /**
   * 確率文字列を数値スコアに変換
   */
  private probabilityToScore(probability: string): number {
    switch (probability) {
      case 'NEGLIGIBLE': return 0.9;
      case 'LOW': return 0.8;
      case 'MEDIUM': return 0.6;
      case 'HIGH': return 0.3;
      default: return 0.7;
    }
  }
}

/**
 * キャプチャ画像の分析結果から背景情報テキストを生成
 */
export const generateVisualBackgroundInfo = (analyses: CaptureAnalysis[]): string => {
  if (analyses.length === 0) {
    return '';
  }

  const validAnalyses = analyses.filter(a => a.description && !a.error);
  
  if (validAnalyses.length === 0) {
    return '※ 画面キャプチャの分析に失敗しました';
  }

  const parts: string[] = [
    '📸 録音中の画面キャプチャ分析:',
    ''
  ];

  validAnalyses.forEach((analysis) => {
    const timeStr = formatRecordingTime(analysis.recordingTime);
    parts.push(`${timeStr}: ${analysis.description}`);
  });

  parts.push('');
  parts.push(`※ ${validAnalyses.length}枚の画面を自動分析しました`);

  return parts.join('\n');
};

/**
 * 録音時間を読みやすい形式にフォーマット
 */
const formatRecordingTime = (seconds: number): string => {
  const minutes = Math.floor(seconds / 60);
  const remainingSeconds = seconds % 60;
  
  if (minutes === 0) {
    return `${remainingSeconds}秒`;
  }
  
  return `${minutes}分${remainingSeconds.toString().padStart(2, '0')}秒`;
};