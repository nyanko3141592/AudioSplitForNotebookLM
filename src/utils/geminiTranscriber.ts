import { GoogleGenerativeAI } from '@google/generative-ai';

export interface TranscriptionResult {
  partNumber: number;
  fileName: string;
  transcription: string;
  error?: string;
  status?: 'pending' | 'processing' | 'completed' | 'error' | 'cancelled';
}

export interface TranscriptionProgress {
  current: number;
  total: number;
  status: string;
  fileStates: Map<number, TranscriptionResult>;
}

export class GeminiTranscriber {
  private genAI: GoogleGenerativeAI | null = null;
  private model: any = null; // eslint-disable-line @typescript-eslint/no-explicit-any
  private abortController: AbortController | null = null;
  private modelName: string = 'gemini-2.0-flash-lite';
  private apiEndpoint: string = 'https://generativelanguage.googleapis.com';
  private apiKey: string = '';

  constructor(apiKey?: string, modelName?: string, apiEndpoint?: string) {
    if (modelName) {
      this.modelName = modelName;
    }
    if (apiEndpoint) {
      this.apiEndpoint = apiEndpoint;
    }
    if (apiKey) {
      this.initialize(apiKey, apiEndpoint);
    }
  }

  initialize(apiKey: string, apiEndpoint?: string) {
    if (!apiKey) {
      throw new Error('Gemini API キーが設定されていません');
    }
    
    // APIキーを保存
    this.apiKey = apiKey;
    
    if (apiEndpoint) {
      this.apiEndpoint = apiEndpoint;
    }

    // Google SDK初期化方法を修正
    console.log('🔧 SDK初期化設定:', {
      apiKeyPrefix: apiKey ? `${apiKey.substring(0, 10)}...` : 'なし',
      endpoint: this.apiEndpoint,
      isDefault: this.apiEndpoint === 'https://generativelanguage.googleapis.com'
    });
    
    if (this.apiEndpoint !== 'https://generativelanguage.googleapis.com') {
      // カスタムエンドポイントの場合はオブジェクトで設定
      console.log('🔧 カスタムエンドポイント設定:', { baseUrl: this.apiEndpoint });
      this.genAI = new GoogleGenerativeAI({
        apiKey,
        baseUrl: this.apiEndpoint
      } as any); // eslint-disable-line @typescript-eslint/no-explicit-any
    } else {
      // デフォルトエンドポイントの場合は文字列で直接渡す
      console.log('🔧 デフォルトエンドポイント: APIキーを文字列で直接渡す');
      this.genAI = new GoogleGenerativeAI(apiKey);
    }
    this.model = this.genAI.getGenerativeModel({ 
      model: this.modelName
    });
    
    console.log('✅ SDK初期化完了:', { 
      genAI: !!this.genAI, 
      model: !!this.model,
      modelName: this.modelName 
    });
  }

  isInitialized(): boolean {
    return this.model !== null;
  }

  async transcribeAudioBlob(
    blob: Blob, 
    fileName: string,
    onProgress?: (status: string) => void,
    customPrompt?: string
  ): Promise<string> {
    if (!this.model) {
      throw new Error('Gemini APIが初期化されていません。APIキーを設定してください。');
    }

    try {
      if (onProgress) onProgress(`文字起こし中: ${fileName}`);
      
      // BlobをBase64に変換
      const base64Audio = await this.blobToBase64(blob);
      
      const defaultPrompt = `
この音声ファイルの内容を正確に文字起こししてください。
以下の点に注意してください：
- 話者の発言を忠実に文字起こしする
- 適切な句読点を追加する
- 専門用語や固有名詞は正確に記載する
- フィラー語（えー、あのー等）は適度に省略して読みやすくする
- 複数の話者がいる場合は、話者を区別して記載する

文字起こし結果のみを出力してください。
`;

      const prompt = customPrompt || defaultPrompt;

      // デバッグ用：現在のエンドポイントとAPIキー確認
      console.log('🔍 現在のエンドポイント:', this.apiEndpoint);
      console.log('🔍 デフォルトかどうか:', this.apiEndpoint === 'https://generativelanguage.googleapis.com');
      console.log('🔍 APIキー確認:', this.apiKey ? `${this.apiKey.substring(0, 10)}...` : 'APIキーなし');
      console.log('🔍 ファイル名:', fileName);
      console.log('🔍 Blobサイズ:', blob.size);
      
      // カスタムエンドポイント使用時は直接HTTPリクエスト
      if (this.apiEndpoint !== 'https://generativelanguage.googleapis.com') {
        console.log('🌐 カスタムエンドポイント使用:', this.apiEndpoint);
        return await this.transcribeWithCustomEndpoint(base64Audio, prompt, fileName);
      }
      
      console.log('✅ Google SDK使用');
      console.log('🔍 SDKでリクエスト送信前:', {
        modelName: this.modelName,
        blobSize: blob.size,
        base64Length: base64Audio.length,
        hasModel: !!this.model
      });

      // デフォルトエンドポイント使用時はSDKを使用
      const result = await this.model.generateContent([
        {
          inlineData: {
            mimeType: 'audio/wav',
            data: base64Audio
          }
        },
        prompt
      ]);
      
      console.log('✅ SDKリクエスト成功');

      const response = await result.response;
      const transcription = response.text();
      
      if (onProgress) onProgress(`完了: ${fileName}`);
      return transcription;
      
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : '不明なエラー';
      console.error(`文字起こし失敗: ${fileName}`, error);
      throw new Error(`文字起こしに失敗しました: ${errorMessage}`);
    }
  }

  async transcribeMultipleBlobs(
    blobs: Blob[],
    fileNames: string[],
    onProgress?: (progress: TranscriptionProgress) => void,
    delay: number = 1000,
    customPrompt?: string,
    concurrency: number = 1
  ): Promise<TranscriptionResult[]> {
    if (!this.model) {
      throw new Error('Gemini APIが初期化されていません。APIキーを設定してください。');
    }

    // AbortControllerを初期化
    this.abortController = new AbortController();

    const results: TranscriptionResult[] = new Array(blobs.length);
    const fileStates = new Map<number, TranscriptionResult>();

    // 初期状態を設定
    for (let i = 0; i < blobs.length; i++) {
      const initialResult: TranscriptionResult = {
        partNumber: i + 1,
        fileName: fileNames[i] || `Part ${i + 1}`,
        transcription: '',
        status: 'pending'
      };
      results[i] = initialResult;
      fileStates.set(i + 1, initialResult);
    }

    try {
      if (concurrency <= 1) {
        // 順次処理
        return await this.transcribeSequentially(blobs, fileNames, onProgress, delay, customPrompt, fileStates);
      } else {
        // 並列処理
        return await this.transcribeConcurrently(blobs, fileNames, onProgress, delay, customPrompt, concurrency, fileStates);
      }
    } catch (error) {
      if (error instanceof Error && error.name === 'AbortError') {
        // キャンセルされた処理の状態を更新
        for (const [, result] of fileStates.entries()) {
          if (result.status === 'processing') {
            result.status = 'cancelled';
            result.error = 'ユーザーによってキャンセルされました';
          }
        }
      }
      throw error;
    }
  }

  // 文字起こし処理を中断
  cancelTranscription(): void {
    if (this.abortController) {
      this.abortController.abort();
    }
  }

  private async transcribeSequentially(
    blobs: Blob[],
    fileNames: string[],
    onProgress?: (progress: TranscriptionProgress) => void,
    delay: number = 1000,
    customPrompt?: string,
    fileStates?: Map<number, TranscriptionResult>
  ): Promise<TranscriptionResult[]> {
    const results: TranscriptionResult[] = [];
    let completed = 0;
    
    for (let i = 0; i < blobs.length; i++) {
      // キャンセルチェック
      if (this.abortController?.signal.aborted) {
        throw new Error('キャンセルされました');
      }

      const blob = blobs[i];
      const fileName = fileNames[i] || `Part ${i + 1}`;
      const partNumber = i + 1;
      
      // 処理開始状態を更新
      const processingResult: TranscriptionResult = {
        partNumber,
        fileName,
        transcription: '',
        status: 'processing'
      };
      
      if (fileStates) {
        fileStates.set(partNumber, processingResult);
      }
      
      if (onProgress) {
        onProgress({
          current: completed,
          total: blobs.length,
          status: `処理中: ${fileName}`,
          fileStates: fileStates || new Map()
        });
      }
      
      try {
        const transcription = await this.transcribeAudioBlob(blob, fileName, undefined, customPrompt);
        
        const completedResult: TranscriptionResult = {
          partNumber,
          fileName,
          transcription,
          status: 'completed'
        };
        
        results.push(completedResult);
        completed++;
        
        if (fileStates) {
          fileStates.set(partNumber, completedResult);
        }
        
        // 進捗更新
        if (onProgress) {
          onProgress({
            current: completed,
            total: blobs.length,
            status: `完了: ${fileName}`,
            fileStates: fileStates || new Map()
          });
        }
        
        // API制限を避けるための遅延
        if (i < blobs.length - 1) {
          await this.delay(delay);
        }
        
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : '不明なエラー';
        const errorResult: TranscriptionResult = {
          partNumber,
          fileName,
          transcription: '',
          error: errorMessage,
          status: 'error'
        };
        
        results.push(errorResult);
        completed++;
        
        if (fileStates) {
          fileStates.set(partNumber, errorResult);
        }
      }
    }
    
    return results;
  }

  private async transcribeConcurrently(
    blobs: Blob[],
    fileNames: string[],
    onProgress?: (progress: TranscriptionProgress) => void,
    delay: number = 1000,
    customPrompt?: string,
    concurrency: number = 2,
    fileStates?: Map<number, TranscriptionResult>
  ): Promise<TranscriptionResult[]> {
    const results: TranscriptionResult[] = new Array(blobs.length);
    let completed = 0;
    const inProgress = new Set<string>();

    const updateProgress = (fileName: string, partNumber: number, status: 'start' | 'complete' | 'error', result?: TranscriptionResult) => {
      if (status === 'start') {
        inProgress.add(fileName);
        if (fileStates && result) {
          fileStates.set(partNumber, result);
        }
      } else {
        inProgress.delete(fileName);
        completed++;
        if (fileStates && result) {
          fileStates.set(partNumber, result);
        }
      }
      
      if (onProgress) {
        const statusText = inProgress.size > 0 
          ? `処理中: ${Array.from(inProgress).join(', ')} (${completed}/${blobs.length}完了)`
          : `完了: ${completed}/${blobs.length}`;
        onProgress({
          current: completed,
          total: blobs.length,
          status: statusText,
          fileStates: fileStates || new Map()
        });
      }
    };

    // 並列実行用のworker関数
    const worker = async (index: number): Promise<void> => {
      // キャンセルチェック
      if (this.abortController?.signal.aborted) {
        return;
      }

      const blob = blobs[index];
      const fileName = fileNames[index] || `Part ${index + 1}`;
      const partNumber = index + 1;
      
      const processingResult: TranscriptionResult = {
        partNumber,
        fileName,
        transcription: '',
        status: 'processing'
      };
      
      updateProgress(fileName, partNumber, 'start', processingResult);
      
      try {
        const transcription = await this.transcribeAudioBlob(blob, fileName, undefined, customPrompt);
        const completedResult: TranscriptionResult = {
          partNumber,
          fileName,
          transcription,
          status: 'completed'
        };
        results[index] = completedResult;
        updateProgress(fileName, partNumber, 'complete', completedResult);
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : '不明なエラー';
        const errorResult: TranscriptionResult = {
          partNumber,
          fileName,
          transcription: '',
          error: errorMessage,
          status: 'error'
        };
        results[index] = errorResult;
        updateProgress(fileName, partNumber, 'error', errorResult);
      }
      
      // API制限を避けるための遅延（並列処理でも適用）
      if (delay > 0) {
        await this.delay(delay);
      }
    };

    // 並列実行の管理
    const semaphore = new Array(concurrency).fill(null);
    let currentIndex = 0;

    const executeNext = async (): Promise<void> => {
      while (currentIndex < blobs.length && !this.abortController?.signal.aborted) {
        const index = currentIndex++;
        await worker(index);
      }
    };

    // 並列実行開始
    await Promise.all(semaphore.map(() => executeNext()));
    
    return results;
  }

  formatTranscriptions(results: TranscriptionResult[]): string {
    let formatted = '# 音声文字起こし結果\n\n';
    
    for (const result of results) {
      formatted += `## パート ${result.partNumber}: ${result.fileName}\n\n`;
      
      if (result.error) {
        formatted += `⚠️ エラー: ${result.error}\n\n`;
      } else {
        formatted += `${result.transcription}\n\n`;
      }
      
      formatted += '---\n\n';
    }
    
    return formatted;
  }

  private async blobToBase64(blob: Blob): Promise<string> {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onloadend = () => {
        const base64 = reader.result as string;
        // データURLから実際のBase64部分を抽出
        const base64Data = base64.split(',')[1];
        resolve(base64Data);
      };
      reader.onerror = reject;
      reader.readAsDataURL(blob);
    });
  }

  private delay(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  // カスタムエンドポイント用の直接HTTPリクエスト（リトライ機能付き）
  private async transcribeWithCustomEndpoint(
    base64Audio: string,
    prompt: string,
    fileName: string
  ): Promise<string> {
    // 開発環境ではプロキシ経由でアクセス
    const isDev = import.meta.env.DEV;
    const endpoint = isDev 
      ? `/api/cloudflare${this.apiEndpoint.replace('https://gateway.ai.cloudflare.com', '')}/v1/models/${this.modelName}:generateContent`
      : `${this.apiEndpoint}/v1/models/${this.modelName}:generateContent`;
    
    const requestBody = {
      contents: [
        {
          role: "user",
          parts: [
            {
              inlineData: {
                mimeType: 'audio/wav',
                data: base64Audio
              }
            },
            {
              text: prompt
            }
          ]
        }
      ]
    };

    console.log('🌐 送信先URL:', endpoint);
    
    // リトライ機能付きでリクエスト実行
    const maxRetries = 3;
    let lastError: Error | null = null;
    
    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      try {
        console.log(`🔄 Cloudflare AI Gateway リクエスト試行 ${attempt}/${maxRetries}`);
        
        const response = await fetch(endpoint, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'x-goog-api-key': this.getApiKey()
          },
          body: JSON.stringify(requestBody)
        });

        if (response.ok) {
          const result = await response.json();
          console.log(`✅ Cloudflare AI Gateway 成功 (試行 ${attempt})`);
          
          if (!result.candidates || !result.candidates[0] || !result.candidates[0].content) {
            throw new Error('レスポンス形式が不正です');
          }

          return result.candidates[0].content.parts[0].text;
        }
        
        const errorText = await response.text();
        console.error(`❌ Cloudflare AI Gateway HTTPエラー (試行 ${attempt}):`, response.status, errorText);
        
        // 502エラーの場合のみリトライ、それ以外は即座に失敗
        if (response.status === 502) {
          lastError = new Error(`HTTP ${response.status}: ${errorText}`);
          if (attempt < maxRetries) {
            const waitTime = attempt * 2000; // 2秒、4秒、6秒...
            console.log(`⏰ ${waitTime}ms待機してリトライします...`);
            await this.delay(waitTime);
            continue;
          }
        } else {
          throw new Error(`HTTP ${response.status}: ${errorText}`);
        }
      } catch (error) {
        lastError = error instanceof Error ? error : new Error(String(error));
        console.error(`❌ Cloudflare AI Gateway エラー (試行 ${attempt}):`, lastError.message);
        
        if (attempt < maxRetries && (lastError.message.includes('502') || lastError.message.includes('fetch'))) {
          const waitTime = attempt * 2000;
          console.log(`⏰ ${waitTime}ms待機してリトライします...`);
          await this.delay(waitTime);
          continue;
        } else {
          break;
        }
      }
    }

    // 全試行が失敗した場合、デフォルトエンドポイントにフォールバック
    console.log('🔄 Cloudflare AI Gateway が全試行で失敗。デフォルトエンドポイントにフォールバック...');
    return await this.fallbackToDefaultEndpoint(base64Audio, prompt, fileName);
  }

  // Cloudflare AI Gateway失敗時のフォールバック機能
  private async fallbackToDefaultEndpoint(
    base64Audio: string,
    prompt: string,
    fileName: string
  ): Promise<string> {
    try {
      console.log('🔄 フォールバック: デフォルトエンドポイントのSDKを使用');
      
      // 一時的にデフォルトエンドポイント用のSDKを作成
      const tempGenAI = new GoogleGenerativeAI(this.apiKey);
      const tempModel = tempGenAI.getGenerativeModel({ 
        model: this.modelName
      });

      const result = await tempModel.generateContent([
        {
          inlineData: {
            mimeType: 'audio/wav',
            data: base64Audio
          }
        },
        prompt
      ]);

      const response = await result.response;
      const transcription = response.text();
      
      console.log(`✅ フォールバック成功: ${fileName}`);
      return transcription;
    } catch (error) {
      console.error(`❌ フォールバックも失敗: ${fileName}`, error);
      throw new Error(`Cloudflareエンドポイントとデフォルトエンドポイント両方で失敗: ${error instanceof Error ? error.message : '不明なエラー'}`);
    }
  }

  // カスタムエンドポイント用の要約メソッド
  private async summarizeWithCustomEndpoint(prompt: string): Promise<string> {
    // 開発環境ではプロキシ経由でアクセス
    const isDev = import.meta.env.DEV;
    const endpoint = isDev 
      ? `/api/cloudflare${this.apiEndpoint.replace('https://gateway.ai.cloudflare.com', '')}/v1/models/${this.modelName}:generateContent`
      : `${this.apiEndpoint}/v1/models/${this.modelName}:generateContent`;
    
    const requestBody = {
      contents: [
        {
          role: "user",
          parts: [
            {
              text: prompt
            }
          ]
        }
      ]
    };

    console.log('🌐 要約送信先URL:', endpoint);
    
    const response = await fetch(endpoint, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-goog-api-key': this.apiKey
      },
      body: JSON.stringify(requestBody)
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error('❌ 要約HTTPエラー:', response.status, errorText);
      throw new Error(`HTTP ${response.status}: ${errorText}`);
    }

    const result = await response.json();
    
    if (!result.candidates || !result.candidates[0] || !result.candidates[0].content) {
      throw new Error('要約レスポンス形式が不正です');
    }

    return result.candidates[0].content.parts[0].text;
  }

  // APIキーを取得するプライベートメソッド
  private getApiKey(): string {
    return this.apiKey;
  }

  // 文字起こし結果をフォーマットしてまとめる
  async summarizeTranscriptions(
    results: TranscriptionResult[],
    formatPrompt?: string,
    onProgress?: (status: string) => void
  ): Promise<string> {
    if (!this.model) {
      throw new Error('Gemini APIが初期化されていません。');
    }

    if (onProgress) onProgress('文字起こし結果をまとめています...');

    // 完了した文字起こしのみを抽出
    const completedResults = results.filter(r => r.status === 'completed' && r.transcription);
    
    if (completedResults.length === 0) {
      throw new Error('まとめる文字起こし結果がありません。');
    }

    // 全ての文字起こし結果を結合
    const combinedText = completedResults
      .sort((a, b) => a.partNumber - b.partNumber)
      .map(result => `## ${result.fileName}\n\n${result.transcription}`)
      .join('\n\n---\n\n');

    const defaultFormatPrompt = `
以下の音声文字起こし結果を読みやすくまとめてください。

要求事項：
- 内容を整理し、議事録のような形式で構造化する
- 重要なポイントを明確にする
- 話の流れが分かりやすいように段落分けする
- 必要に応じて見出しを追加する
- 冗長な表現は簡潔にまとめる

文字起こし結果：
${combinedText}

上記の内容を整理してまとめてください。
`;

    // formatPromptに{transcriptions}プレースホルダーがある場合は置換
    let prompt = formatPrompt || defaultFormatPrompt;
    if (formatPrompt && formatPrompt.includes('{transcriptions}')) {
      prompt = formatPrompt.replace('{transcriptions}', combinedText);
    }

    try {
      // カスタムエンドポイント使用時は直接HTTPリクエスト
      if (this.apiEndpoint !== 'https://generativelanguage.googleapis.com') {
        console.log('🌐 まとめ処理でカスタムエンドポイント使用:', this.apiEndpoint);
        const summary = await this.summarizeWithCustomEndpoint(prompt);
        if (onProgress) onProgress('まとめ完了');
        return summary;
      }

      // デフォルトエンドポイント使用時はSDKを使用
      const result = await this.model.generateContent(prompt);
      const response = await result.response;
      const summary = response.text();
      
      if (onProgress) onProgress('まとめ完了');
      return summary;
      
    } catch (error) {
      console.error('Summary error:', error);
      throw new Error(`まとめ処理に失敗しました: ${error instanceof Error ? error.message : '不明なエラー'}`);
    }
  }
}

// ユーティリティ関数
export const downloadTranscription = (
  content: string,
  fileName: string = 'transcription.md',
  contentType: string = 'text/markdown;charset=utf-8'
) => {
  const blob = new Blob([content], { type: contentType });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = fileName;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
};
