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
  private model: any = null;
  private abortController: AbortController | null = null;
  private modelName: string = 'gemini-2.0-flash-lite';

  constructor(apiKey?: string, modelName?: string) {
    if (modelName) {
      this.modelName = modelName;
    }
    if (apiKey) {
      this.initialize(apiKey);
    }
  }

  initialize(apiKey: string) {
    if (!apiKey) {
      throw new Error('Gemini API キーが設定されていません');
    }
    this.genAI = new GoogleGenerativeAI(apiKey);
    this.model = this.genAI.getGenerativeModel({ 
      model: this.modelName
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

      const result = await this.model.generateContent([
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
    let inProgress = new Set<string>();

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
export const downloadTranscription = (content: string, fileName: string = 'transcription.md') => {
  const blob = new Blob([content], { type: 'text/markdown;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = fileName;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
};