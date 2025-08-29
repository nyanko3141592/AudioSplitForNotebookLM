import { GeminiTranscriber } from './geminiTranscriber';
import type { TranscriptionResult, TranscriptionProgress } from './geminiTranscriber';
import { LocalTranscriber } from './localTranscriber';

export type TranscriptionMode = 'local' | 'gemini' | 'auto';

export interface TranscriberInterface {
  isInitialized(): boolean;
  transcribeAudioBlob(
    blob: Blob,
    fileName: string,
    onProgress?: (status: string) => void,
    customPromptOrLanguage?: string
  ): Promise<string>;
  transcribeMultipleBlobs(
    blobs: Blob[],
    fileNames: string[],
    onProgress?: (progress: TranscriptionProgress) => void,
    delayOrLanguage?: number | string,
    customPrompt?: string,
    concurrency?: number
  ): Promise<TranscriptionResult[]>;
  cancelTranscription(): void;
}

export class TranscriptionService {
  private static instance: TranscriptionService;
  private mode: TranscriptionMode = 'auto';
  private geminiTranscriber: GeminiTranscriber | null = null;
  private localTranscriber: LocalTranscriber | null = null;
  private geminiApiKey: string | null = null;
  private localModelName: string = 'Xenova/whisper-tiny';

  private constructor() {}

  static getInstance(): TranscriptionService {
    if (!TranscriptionService.instance) {
      TranscriptionService.instance = new TranscriptionService();
    }
    return TranscriptionService.instance;
  }

  /**
   * サービスの設定
   */
  configure(options: {
    mode?: TranscriptionMode;
    geminiApiKey?: string;
    geminiModelName?: string;
    geminiEndpoint?: string;
    localModelName?: string;
  }) {
    if (options.mode !== undefined) {
      this.mode = options.mode;
    }

    if (options.geminiApiKey) {
      this.geminiApiKey = options.geminiApiKey;
      this.geminiTranscriber = new GeminiTranscriber(
        options.geminiApiKey,
        options.geminiModelName,
        options.geminiEndpoint
      );
    }

    if (options.localModelName) {
      this.localModelName = options.localModelName;
      // ローカルトランスクライバーは必要時に初期化
      this.localTranscriber = null;
    }
  }

  /**
   * 現在のモードを取得
   */
  getMode(): TranscriptionMode {
    return this.mode;
  }

  /**
   * 利用可能なモードを取得
   */
  getAvailableModes(): { mode: TranscriptionMode; label: string; available: boolean }[] {
    return [
      { 
        mode: 'local', 
        label: 'ローカル処理 (Whisper)', 
        available: true 
      },
      { 
        mode: 'gemini', 
        label: 'Gemini API', 
        available: !!this.geminiApiKey 
      },
      { 
        mode: 'auto', 
        label: '自動選択', 
        available: true 
      }
    ];
  }

  /**
   * アクティブなトランスクライバーを取得
   */
  private async getActiveTranscriber(onProgress?: (status: string) => void): Promise<TranscriberInterface> {
    if (this.mode === 'local' || (this.mode === 'auto' && !this.geminiApiKey)) {
      // ローカル処理を使用
      if (!this.localTranscriber) {
        this.localTranscriber = new LocalTranscriber(this.localModelName);
        await this.localTranscriber.initialize(onProgress);
      }
      return this.localTranscriber;
    } else if (this.mode === 'gemini' || (this.mode === 'auto' && this.geminiApiKey)) {
      // Gemini APIを使用
      if (!this.geminiTranscriber) {
        throw new Error('Gemini APIキーが設定されていません');
      }
      return this.geminiTranscriber;
    }

    throw new Error('利用可能な文字起こしサービスがありません');
  }

  /**
   * 単一ファイルの文字起こし（メモリ最適化版）
   */
  async transcribeAudioBlob(
    blob: Blob,
    fileName: string,
    onProgress?: (status: string) => void,
    customPromptOrLanguage?: string
  ): Promise<string> {
    const transcriber = await this.getActiveTranscriber(onProgress);
    
    if (transcriber instanceof LocalTranscriber) {
      // ローカル処理の場合、自動分割機能を使用
      const fileSizeInMB = blob.size / (1024 * 1024);
      
      // 30MB以上の場合は自動分割を使用
      if (fileSizeInMB > 30) {
        console.log(`🚀 大きなファイル (${fileSizeInMB.toFixed(2)}MB) - 自動分割処理を開始`);
        return transcriber.transcribeAudioBlobWithAutoSplit(
          blob, 
          fileName, 
          onProgress, 
          customPromptOrLanguage || 'auto',
          30 // 30MBで分割
        );
      } else {
        return transcriber.transcribeAudioBlob(blob, fileName, onProgress, customPromptOrLanguage || 'auto');
      }
    } else {
      // Gemini APIの場合、第4引数はカスタムプロンプト
      return transcriber.transcribeAudioBlob(blob, fileName, onProgress, customPromptOrLanguage);
    }
  }

  /**
   * 複数ファイルの文字起こし
   */
  async transcribeMultipleBlobs(
    blobs: Blob[],
    fileNames: string[],
    onProgress?: (progress: TranscriptionProgress) => void,
    options?: {
      delay?: number;
      language?: string;
      customPrompt?: string;
      concurrency?: number;
    }
  ): Promise<TranscriptionResult[]> {
    const transcriber = await this.getActiveTranscriber((status) => {
      if (onProgress) {
        onProgress({
          current: 0,
          total: blobs.length,
          status,
          fileStates: new Map()
        });
      }
    });

    if (transcriber instanceof LocalTranscriber) {
      // ローカル処理
      return transcriber.transcribeMultipleBlobs(
        blobs,
        fileNames,
        onProgress,
        options?.language || 'auto'
      );
    } else if (transcriber instanceof GeminiTranscriber) {
      // Gemini API処理
      return transcriber.transcribeMultipleBlobs(
        blobs,
        fileNames,
        onProgress,
        options?.delay || 1000,
        options?.customPrompt,
        options?.concurrency || 1
      );
    }

    throw new Error('トランスクライバーの取得に失敗しました');
  }

  /**
   * 処理をキャンセル
   */
  cancelTranscription(): void {
    if (this.geminiTranscriber) {
      this.geminiTranscriber.cancelTranscription();
    }
    if (this.localTranscriber) {
      this.localTranscriber.cancelTranscription();
    }
  }

  /**
   * 文字起こし結果をまとめる（Gemini APIのみ）
   */
  async summarizeTranscriptions(
    results: TranscriptionResult[],
    formatPrompt?: string,
    onProgress?: (status: string) => void
  ): Promise<string> {
    if (!this.geminiTranscriber) {
      throw new Error('要約機能はGemini APIが必要です');
    }

    return this.geminiTranscriber.summarizeTranscriptions(
      results,
      formatPrompt,
      onProgress
    );
  }

  /**
   * リソースをクリーンアップ
   */
  async dispose(): Promise<void> {
    if (this.localTranscriber) {
      await this.localTranscriber.dispose();
      this.localTranscriber = null;
    }
  }
}
