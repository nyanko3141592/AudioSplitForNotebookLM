// Gemini Vision API integration for visual capture analysis
import type { CaptureAnalysis } from '../types/visualCapture';
import { ImageComparator, selectImagesForAnalysis } from './imageComparator';

export interface GeminiVisionResponse {
  description: string;
  tokens: number;
  confidence?: number;
}

export class GeminiVisionAnalyzer {
  private apiKey: string;
  private apiEndpoint: string;
  private model: string;
  private imageComparator: ImageComparator | null = null;
  private duplicateDetectionEnabled: boolean;
  private duplicateThreshold: number;

  constructor(
    apiKey: string, 
    apiEndpoint: string = 'https://generativelanguage.googleapis.com',
    model: string = 'gemini-2.0-flash-lite',
    duplicateThreshold: number = 0.95,
    duplicateDetectionEnabled: boolean = true
  ) {
    this.apiKey = apiKey;
    this.apiEndpoint = apiEndpoint;
    this.model = model;
    this.duplicateThreshold = duplicateThreshold;
    this.duplicateDetectionEnabled = duplicateDetectionEnabled;
    
    if (this.duplicateDetectionEnabled) {
      this.imageComparator = new ImageComparator(this.duplicateThreshold);
    }
  }

  /**
   * 画像を分析してその内容を説明
   */
  public async analyzeImage(imageData: string, customPrompt?: string): Promise<GeminiVisionResponse> {
    if (!this.apiKey) {
      throw new Error('Gemini API key is required for visual analysis');
    }

    try {
      // MIME typeを検出
      let mimeType = "image/jpeg"; // デフォルト
      if (imageData.startsWith('data:image/png;base64,')) {
        mimeType = "image/png";
      } else if (imageData.startsWith('data:image/webp;base64,')) {
        mimeType = "image/webp";
      }
      
      // base64画像データからMIME部分を除去
      const base64Image = imageData.replace(/^data:image\/[a-z]+;base64,/, '');
      
      // base64データの検証
      if (!base64Image || base64Image.length < 100) {
        throw new Error('Invalid or empty image data');
      }
      
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
                  mime_type: mimeType,
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
          maxOutputTokens: 400,  // より詳細な分析のため増量
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
        console.error('❌ Invalid Gemini API response:', data);
        throw new Error(`Invalid response from Gemini Vision API: ${JSON.stringify(data)}`);
      }

      const candidate = data.candidates[0];
      if (!candidate.content.parts || !candidate.content.parts[0] || !candidate.content.parts[0].text) {
        console.error('❌ Missing text in Gemini response:', candidate);
        throw new Error('No text content in Gemini Vision API response');
      }

      const description = candidate.content.parts[0].text;
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
   * 複数の画像を一括で分析（重複検出機能付き）
   */
  public async analyzeBatch(
    captures: CaptureAnalysis[],
    onProgress?: (current: number, total: number) => void
  ): Promise<CaptureAnalysis[]> {
    const unanalyzedCaptures = captures.filter(c => c.imageData && !c.description && !c.error);
    
    if (unanalyzedCaptures.length === 0) {
      return captures;
    }

    // アップロード画像と自動キャプチャ画像を分離
    const uploadedCaptures = unanalyzedCaptures.filter(c => c.uploaded);
    const autoCaptures = unanalyzedCaptures.filter(c => !c.uploaded);

    console.log(`📸 分析開始: アップロード画像${uploadedCaptures.length}枚、自動キャプチャ${autoCaptures.length}枚`);

    // 重複検出が無効な場合は従来の処理
    if (!this.duplicateDetectionEnabled || !this.imageComparator) {
      console.log(`📸 通常分析モード: ${unanalyzedCaptures.length}枚すべてを分析`);
      return await this.analyzeBatchWithoutDuplicateDetection(captures, unanalyzedCaptures, onProgress);
    }

    // アップロード画像は必ず分析、自動キャプチャは重複検出適用
    const allSelectedCaptures: CaptureAnalysis[] = [...uploadedCaptures]; // アップロード画像は必ず含める

    if (autoCaptures.length > 0) {
      console.log(`🔍 重複検出モード: ${autoCaptures.length}枚の自動キャプチャを処理`);
      
      // Step 1: 自動キャプチャの重複画像グループを検出
      const imageData = autoCaptures.map(c => ({
        id: c.id,
        imageData: c.imageData!,
        recordingTime: c.recordingTime
      }));

      const groups = await this.imageComparator.detectDuplicateGroups(imageData);
      
      // Step 2: 自動キャプチャから分析対象を選定（アップロード分を除いて最大10枚）
      const maxAutoCaptures = Math.max(1, 10 - uploadedCaptures.length);
      const selectedAutoIds = selectImagesForAnalysis(groups, maxAutoCaptures);
      const selectedAutoCaptures = autoCaptures.filter(c => selectedAutoIds.includes(c.id));
      
      allSelectedCaptures.push(...selectedAutoCaptures);
      console.log(`🎯 API効率化: 自動キャプチャ${autoCaptures.length}枚中${selectedAutoCaptures.length}枚を選択`);
    }

    console.log(`📊 最終分析対象: ${allSelectedCaptures.length}枚 (アップロード:${uploadedCaptures.length}枚、自動選択:${allSelectedCaptures.length - uploadedCaptures.length}枚)`);
    
    // Step 3: 選定された画像のみを分析
    const analyzedResults = new Map<string, GeminiVisionResponse>();
    
    for (let i = 0; i < allSelectedCaptures.length; i++) {
      const capture = allSelectedCaptures[i];
      onProgress?.(i + 1, allSelectedCaptures.length);

      try {
        const analysis = await this.analyzeImage(capture.imageData!);
        analyzedResults.set(capture.id, analysis);

        // API制限を考慮して少し待機
        if (i < allSelectedCaptures.length - 1) {
          await new Promise(resolve => setTimeout(resolve, 1000));
        }
      } catch (error) {
        console.error(`Failed to analyze capture ${capture.id}:`, error);
        analyzedResults.set(capture.id, {
          description: '',
          tokens: 0,
          confidence: 0
        });
      }
    }

    // Step 4: 結果をすべてのキャプチャに適用
    const results: CaptureAnalysis[] = [];
    
    for (const capture of captures) {
      if (!capture.imageData || capture.description || capture.error) {
        // 既に処理済みまたはエラーの場合はそのまま
        results.push(capture);
        continue;
      }

      if (capture.uploaded) {
        // アップロード画像は必ず個別分析結果を使用
        const result = analyzedResults.get(capture.id);
        if (result && result.description) {
          results.push({
            ...capture,
            description: result.description + ' 📁',
            tokens: result.tokens,
            confidence: result.confidence
          });
        } else {
          results.push({
            ...capture,
            error: 'Upload analysis failed'
          });
        }
      } else {
        // 自動キャプチャは重複検出結果を適用
        const groups = autoCaptures.length > 0 
          ? await this.imageComparator!.detectDuplicateGroups(
              autoCaptures.map(c => ({
                id: c.id,
                imageData: c.imageData!,
                recordingTime: c.recordingTime
              }))
            )
          : [];
          
        const group = groups.find(g => g.members.includes(capture.id));
        if (!group) {
          results.push(capture);
          continue;
        }

        // 代表画像の分析結果を取得
        const representativeResult = analyzedResults.get(group.representative);
        
        if (representativeResult && representativeResult.description) {
          const isDuplicate = group.representative !== capture.id;
          results.push({
            ...capture,
            description: representativeResult.description + (isDuplicate ? ' ※類似画像' : ''),
            tokens: representativeResult.tokens,
            confidence: representativeResult.confidence
          });
        } else {
          // 分析に失敗した場合
          results.push({
            ...capture,
            error: 'Analysis failed'
          });
        }
      }
    }

    const totalAutoSaved = autoCaptures.length - (allSelectedCaptures.length - uploadedCaptures.length);
    if (totalAutoSaved > 0) {
      console.log(`💰 API呼び出し削減: ${totalAutoSaved}回の分析をスキップ（約${totalAutoSaved * 1000}トークン節約）`);
    }

    return results;
  }

  /**
   * 重複検出なしの通常分析
   */
  private async analyzeBatchWithoutDuplicateDetection(
    captures: CaptureAnalysis[],
    unanalyzedCaptures: CaptureAnalysis[],
    onProgress?: (current: number, total: number) => void
  ): Promise<CaptureAnalysis[]> {
    const results: CaptureAnalysis[] = [];
    
    for (let i = 0; i < captures.length; i++) {
      const capture = captures[i];
      
      if (!capture.imageData || capture.description || capture.error) {
        // 既に処理済みまたはエラーの場合はそのまま
        results.push(capture);
        continue;
      }

      // 未分析の場合は分析実行
      const analysisIndex = unanalyzedCaptures.findIndex(c => c.id === capture.id);
      if (analysisIndex >= 0) {
        onProgress?.(analysisIndex + 1, unanalyzedCaptures.length);

        try {
          const analysis = await this.analyzeImage(capture.imageData);
          results.push({
            ...capture,
            description: analysis.description,
            tokens: analysis.tokens,
            confidence: analysis.confidence
          });

          // API制限を考慮して少し待機
          if (analysisIndex < unanalyzedCaptures.length - 1) {
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
    return `この画面キャプチャを詳細に分析して、以下の観点から包括的に説明してください：

【基本情報】
1. 使用アプリケーション・サービス（Zoom、Teams、Google Meet、YouTube、ブラウザ、PowerPoint、Excel等）
2. 画面の種類（会議画面、プレゼン画面、資料画面、デスクトップ、ブラウザタブ等）

【コンテンツ詳細】
3. 表示されている具体的内容（資料タイトル、ウェブページ名、動画タイトル、会議名等）
4. 重要なテキスト情報（見出し、メニュー項目、主要な文言、数値、グラフタイトル等）
5. 参加者・発表者の状況（人数、発言者の名前、画面共有状況、チャット活動等）

【文脈情報】
6. 活動の種類（会議、研修、プレゼン、デモ、ディスカッション、レビュー等）
7. 進行状況（開始、進行中、質疑応答、資料説明、画面共有、終了準備等）
8. 特徴的な要素（グラフ、図表、画像、動画再生、共有画面、投票、チャット等）

日本語で200文字以内で、録音内容の理解に最も役立つよう詳細にまとめてください。技術的すぎる詳細は省略し、文脈理解に重要な情報を優先してください。`;
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

    const summaryPrompt = `以下は録音中に定期的にキャプチャした画面の詳細分析結果です。これらの情報を総合して、録音セッション全体の包括的な文脈や背景情報を構造化してまとめてください。

画面分析結果:
${analysisText}

【統合分析要求】
以下の観点から詳細に分析・整理してください：

1. **セッション概要**
   - 全体的な活動内容（会議、研修、プレゼン、デモ等）
   - 主要参加者・組織・チーム情報
   - セッションの目的や性質

2. **使用ツール・環境**
   - 利用されたアプリケーション・サービスの一覧と用途
   - 技術的環境や設定（画面共有、録画、チャット等）

3. **コンテンツ・資料**
   - 表示された資料・文書・ウェブページの詳細
   - 重要なタイトル・見出し・キーワード
   - グラフ・図表・データの内容

4. **進行・流れ**
   - セッションの時系列的な進行状況
   - 画面や活動の変遷・切り替わり
   - 重要な転換点や特徴的な瞬間

5. **特徴・注目点**
   - 繰り返し出現する要素や重要なポイント
   - 特殊な状況や例外的な内容
   - 音声理解に特に重要な視覚情報

500文字以内で、録音内容の完全な理解に必要な全ての文脈情報を網羅してください。時系列順に整理し、音声だけでは分からない重要な視覚的情報を優先して記載してください。`;

    try {
      const requestBody = {
        contents: [{
          parts: [{ text: summaryPrompt }]
        }],
        generationConfig: {
          temperature: 0.3,
          topK: 32,
          topP: 1,
          maxOutputTokens: 800,
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