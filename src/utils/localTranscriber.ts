import { pipeline, env } from '@xenova/transformers';
import type { TranscriptionResult, TranscriptionProgress } from './geminiTranscriber';

// Transformers.jsの設定
env.allowLocalModels = false; // ローカルモデルの使用を無効化（CDNから取得）
env.useBrowserCache = true;   // ブラウザキャッシュを有効化

/**
 * メモリ使用量監視クラス
 */
class MemoryMonitor {
  private startTime: number = 0;
  
  /**
   * 処理前のメモリチェック
   */
  async checkMemoryBeforeProcessing(fileSizeBytes: number): Promise<void> {
    this.startTime = Date.now();
    
    if ('memory' in performance) {
      const memInfo = (performance as any).memory;
      const usedMB = memInfo.usedJSHeapSize / 1024 / 1024;
      const totalMB = memInfo.totalJSHeapSize / 1024 / 1024;
      const limitMB = memInfo.jsHeapSizeLimit / 1024 / 1024;
      const fileMB = fileSizeBytes / 1024 / 1024;
      
      console.log(`📊 メモリ状況 (処理前): ${usedMB.toFixed(0)}MB / ${totalMB.toFixed(0)}MB (limit: ${limitMB.toFixed(0)}MB)`);
      console.log(`📁 ファイルサイズ: ${fileMB.toFixed(2)}MB`);
      
      // メモリ不足の警告
      const estimatedUsage = usedMB + (fileMB * 2); // デコードで約2倍になることを想定
      if (estimatedUsage > limitMB * 0.8) {
        console.warn(`⚠️ メモリ不足の可能性: 予想使用量 ${estimatedUsage.toFixed(0)}MB > 制限の80% (${(limitMB * 0.8).toFixed(0)}MB)`);
      }
    } else {
      console.log('📊 メモリ情報が取得できません (このブラウザは非対応)');
    }
  }
  
  /**
   * 処理後のメモリログ
   */
  logMemoryAfterProcessing(): void {
    const processingTime = Date.now() - this.startTime;
    
    if ('memory' in performance) {
      const memInfo = (performance as any).memory;
      const usedMB = Math.round(memInfo.usedJSHeapSize / 1024 / 1024);
      const totalMB = Math.round(memInfo.totalJSHeapSize / 1024 / 1024);
      
      console.log(`📊 メモリ状況 (処理後): ${usedMB}MB / ${totalMB}MB (処理時間: ${processingTime}ms)`);
    }
    
    // ガベージコレクションを推奨
    if (typeof window !== 'undefined' && 'gc' in window) {
      console.log('🖬 ガベージコレクションを実行中...');
      (window as any).gc();
    }
  }
  
  /**
   * メモリエラー時のログ
   */
  logMemoryError(error: any): void {
    if ('memory' in performance) {
      const memInfo = (performance as any).memory;
      const usedMB = Math.round(memInfo.usedJSHeapSize / 1024 / 1024);
      const totalMB = Math.round(memInfo.totalJSHeapSize / 1024 / 1024);
      
      console.error(`🔴 メモリエラー発生時: ${usedMB}MB / ${totalMB}MB`);
    }
    
    if (error instanceof Error && (error.message.includes('memory') || error.message.includes('heap'))) {
      console.error('😱 メモリ不足エラーが発生しました');
    }
  }
}

export class LocalTranscriber {
  private pipeline: any = null;
  private abortController: AbortController | null = null;
  private modelName: string = 'Xenova/whisper-tiny'; // 軽量モデルをデフォルトに
  private isInitializing: boolean = false;
  private initPromise: Promise<void> | null = null;
  private memoryMonitor: MemoryMonitor;

  constructor(modelName?: string) {
    if (modelName) {
      this.modelName = modelName;
    }
    this.memoryMonitor = new MemoryMonitor();
  }

  /**
   * 利用可能なWhisperモデル
   */
  static getAvailableModels() {
    return [
      { id: 'Xenova/whisper-tiny', name: 'Whisper Tiny', size: '39 MB', speed: '最速', accuracy: '標準' },
      { id: 'Xenova/whisper-base', name: 'Whisper Base', size: '74 MB', speed: '高速', accuracy: '良好' },
      { id: 'Xenova/whisper-small', name: 'Whisper Small', size: '242 MB', speed: '標準', accuracy: '高' },
    ];
  }

  /**
   * 利用可能な言語リスト
   */
  static getAvailableLanguages() {
    return [
      { code: 'ja', name: '日本語' },
      { code: 'en', name: 'English' },
      { code: 'zh', name: '中文' },
      { code: 'ko', name: '한국어' },
      { code: 'es', name: 'Español' },
      { code: 'fr', name: 'Français' },
      { code: 'de', name: 'Deutsch' },
      { code: 'it', name: 'Italiano' },
      { code: 'pt', name: 'Português' },
      { code: 'ru', name: 'Русский' },
      { code: 'ar', name: 'العربية' },
      { code: 'hi', name: 'हिन्दी' },
      { code: 'auto', name: '自動検出' }
    ];
  }

  /**
   * モデルを初期化
   */
  async initialize(onProgress?: (status: string) => void): Promise<void> {
    if (this.pipeline) return;
    if (this.isInitializing) {
      await this.initPromise;
      return;
    }

    this.isInitializing = true;
    this.initPromise = this._initializeInternal(onProgress);
    
    try {
      await this.initPromise;
    } finally {
      this.isInitializing = false;
      this.initPromise = null;
    }
  }

  private async _initializeInternal(onProgress?: (status: string) => void): Promise<void> {
    try {
      if (onProgress) onProgress('Whisperモデルを読み込み中...');
      
      // automatic-speech-recognitionパイプラインを作成
      this.pipeline = await pipeline(
        'automatic-speech-recognition',
        this.modelName,
        {
          progress_callback: (progress: any) => {
            if (onProgress && progress.status) {
              onProgress(`モデル読み込み中: ${progress.status}`);
            }
          }
        }
      );
      
      if (onProgress) onProgress('Whisperモデルの準備完了');
      console.log('✅ Whisperモデル初期化完了:', this.modelName);
    } catch (error) {
      console.error('❌ Whisperモデル初期化エラー:', error);
      throw new Error(`Whisperモデルの初期化に失敗しました: ${error instanceof Error ? error.message : '不明なエラー'}`);
    }
  }

  /**
   * 初期化状態を確認
   */
  isInitialized(): boolean {
    return this.pipeline !== null;
  }

  /**
   * 音声ファイルを文字起こし（メモリ最適化版）
   */
  async transcribeAudioBlob(
    blob: Blob,
    fileName: string,
    onProgress?: (status: string) => void,
    language: string = 'auto' // 自動検出をデフォルトに
  ): Promise<string> {
    if (!this.pipeline) {
      await this.initialize(onProgress);
    }

    // メモリ使用量チェック
    const fileSizeInMB = blob.size / (1024 * 1024);
    console.log(`🔍 処理ファイル: ${fileName} (${fileSizeInMB.toFixed(2)} MB)`);
    
    if (fileSizeInMB > 50) {
      console.warn(`⚠️ 大きなファイル detected: ${fileSizeInMB.toFixed(2)} MB - チャンク処理を推奨`);
    }

    try {
      if (onProgress) onProgress(`ローカル処理中: ${fileName}`);
      
      // ファイル形式をチョック
      console.log(`📄 ファイル形式: ${blob.type || '不明'}, サイズ: ${blob.size} bytes`);
      
      // より効率的な音声データ処理
      const audioData = await this.processAudioEfficiently(blob);
      
      if (audioData instanceof Float32Array) {
        console.log(`🎧 Float32Arrayサイズ: ${audioData.length} サンプル (${(audioData.length * 4)} bytes)`);
      } else {
        console.log(`🔄 ArrayBufferサイズ: ${audioData.byteLength} bytes`);
      }
      
      // Whisperで文字起こし（繰り返し防止設定）
      console.log(`🎤 Whisper処理開始 - 言語: ${language}`);
      const result = await this.pipeline(audioData, {
        language: language === 'auto' ? undefined : language, // autoの場合は自動検出
        task: 'transcribe',
        chunk_length_s: 30, // 長めのチャンクで繰り返しを減らす
        stride_length_s: 5,  // 適度なオーバーラップ
        return_timestamps: true, // タイムスタンプで繰り返し検出を有効化
        sampling_rate: 16000 // 明示的に16kHzを指定
      });
      
      console.log(`📝 Whisper結果:`, result);
      console.log(`📝 テキスト長: ${(result.text || '').length} 文字`);

      if (onProgress) onProgress(`完了: ${fileName}`);
      
      // 繰り返しフレーズをフィルタリング
      const cleanedText = this.filterRepeatedPhrases(result.text || '');
      console.log(`🧽 フィルタリング後: ${cleanedText.length} 文字`);
      
      return cleanedText;
    } catch (error) {
      console.error(`文字起こし失敗: ${fileName}`, error);
      
      // メモリエラーの場合は分かりやすいメッセージ
      if (error instanceof Error && error.message.includes('memory')) {
        throw new Error(`メモリ不足のため文字起こしに失敗しました。より小さなファイルで試すか、ファイルを分割してください。`);
      }
      
      throw new Error(`文字起こしに失敗しました: ${error instanceof Error ? error.message : '不明なエラー'}`);
    }
  }

  /**
   * 大きなファイルを自動分割して処理
   */
  async transcribeAudioBlobWithAutoSplit(
    blob: Blob,
    fileName: string,
    onProgress?: (status: string) => void,
    language: string = 'ja',
    maxSizeInMB: number = 30 // 30MBを上限に
  ): Promise<string> {
    const fileSizeInMB = blob.size / (1024 * 1024);
    
    // ファイルが小さい場合は通常処理
    if (fileSizeInMB <= maxSizeInMB) {
      return await this.transcribeAudioBlob(blob, fileName, onProgress, language);
    }

    console.log(`🔴 大きなファイルを検出: ${fileSizeInMB.toFixed(2)}MB - 自動分割します`);
    
    // ファイルをチャンクに分割
    const chunks = await this.splitBlobIntoChunks(blob, maxSizeInMB);
    const results: string[] = [];
    
    for (let i = 0; i < chunks.length; i++) {
      const chunkFileName = `${fileName}_chunk_${i + 1}`;
      if (onProgress) {
        onProgress(`チャンク ${i + 1}/${chunks.length} を処理中: ${chunkFileName}`);
      }
      
      try {
        const chunkResult = await this.transcribeAudioBlob(
          chunks[i], 
          chunkFileName, 
          undefined, // 個別のprogressは省略
          language
        );
        results.push(chunkResult);
        
        // メモリ解放のため少し待機
        await this.delay(100);
      } catch (error) {
        console.error(`チャンク ${i + 1} の処理に失敗:`, error);
        results.push(`[チャンク ${i + 1} 処理失敗: ${error instanceof Error ? error.message : '不明なエラー'}]`);
      }
    }
    
    return results.join(' ');
  }

  /**
   * Blobを指定サイズのチャンクに分割
   */
  private async splitBlobIntoChunks(blob: Blob, maxSizeInMB: number): Promise<Blob[]> {
    const maxSizeBytes = maxSizeInMB * 1024 * 1024;
    const chunks: Blob[] = [];
    const totalSize = blob.size;
    let offset = 0;
    
    while (offset < totalSize) {
      const chunkSize = Math.min(maxSizeBytes, totalSize - offset);
      const chunk = blob.slice(offset, offset + chunkSize);
      chunks.push(chunk);
      offset += chunkSize;
    }
    
    console.log(`🔄 ファイルを ${chunks.length} 個のチャンクに分割しました`);
    return chunks;
  }

  /**
   * 指定時間待機
   */
  private delay(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  /**
   * 強力な繰り返しフィルタリング
   */
  private filterRepeatedPhrases(text: string): string {
    if (!text || text.length < 10) return text;
    
    console.log(`🔍 フィルタリング前: ${text.length}文字`);
    console.log(`📝 元テキスト:`, text.substring(0, 200) + '...');
    
    let cleaned = text.trim();
    
    // 1. 最初にノイズやアーティファクトを削除
    cleaned = this.removeWhisperArtifacts(cleaned);
    
    // 2. 最も異常な繰り返しパターンを攻撃的に削除
    cleaned = this.removeAggressiveRepeats(cleaned);
    
    // 3. 文レベルの繰り返しを削除
    cleaned = this.removeSentenceRepeats(cleaned);
    
    // 4. 単語レベルの繰り返しを削除
    cleaned = this.removeWordRepeats(cleaned);
    
    // 5. 最終クリーンアップ
    cleaned = this.finalCleanup(cleaned);
    
    console.log(`✨ フィルタリング後: ${cleaned.length}文字`);
    console.log(`📝 清理後テキスト:`, cleaned.substring(0, 200) + '...');
    
    // クリーン後に空になってしまった場合は、元のテキストを返す（情報損失を防止）
    const finalText = cleaned.trim();
    return finalText.length > 0 ? finalText : text.trim();
  }
  
  /**
   * 攻撃的な繰り返し除去 - 非常に明らかな繰り返しパターンを削除
   */
  private removeAggressiveRepeats(text: string): string {
    let cleaned = text;
    
    // 同じ文が2回以上繰り返されている場合、最初の1回のみを保持
    const sentences = cleaned.split(/(?<=[.!?])\s+/);
    const uniqueSentences: string[] = [];
    const seenSentences = new Map<string, number>();
    
    for (const sentence of sentences) {
      const normalizedSentence = sentence.trim().toLowerCase().replace(/[^\w\s]/g, '');
      if (normalizedSentence.length < 3) continue;
      
      const count = seenSentences.get(normalizedSentence) || 0;
      seenSentences.set(normalizedSentence, count + 1);
      
      // 同じ文が2回目以降の場合はスキップ
      if (count < 2) {
        uniqueSentences.push(sentence.trim());
      }
    }
    
    return uniqueSentences.join(' ');
  }
  
  /**
   * 文レベルの繰り返しを削除
   */
  private removeSentenceRepeats(text: string): string {
    // 長いフレーズの繰り返しを検出して削除
    let cleaned = text;
    
    // 4单語以上のフレーズの繰り返しをチェック
    const words = text.split(/\s+/);
    if (words.length < 12) return text; // 短すぎる場合はスキップ
    
    for (let phraseLength = 4; phraseLength <= 15; phraseLength++) {
      for (let i = 0; i <= words.length - phraseLength * 2; i++) {
        const phrase = words.slice(i, i + phraseLength).join(' ');
        const phraseRegex = this.escapeRegex(phrase);
        
        // 同じフレーズが2回以上繰り返されているかチェック
        const repeatedPattern = new RegExp(`(${phraseRegex}\\s*){2,}`, 'gi');
        
        if (repeatedPattern.test(cleaned)) {
          console.log(`🗑️ 繰り返しフレーズを検出: "${phrase}"`);
          // 繰り返しを一回のみに置換
          cleaned = cleaned.replace(repeatedPattern, phrase);
        }
      }
    }
    
    return cleaned;
  }
  
  /**
   * 単語レベルの繰り返しを削除
   */
  private removeWordRepeats(text: string): string {
    const words = text.split(/\s+/);
    const result: string[] = [];
    
    for (let i = 0; i < words.length; i++) {
      const word = words[i];
      const normalizedWord = word.toLowerCase().replace(/[^\w]/g, '');
      
      if (normalizedWord.length < 2) {
        result.push(word);
        continue;
      }
      
      // 前の2単語と同じかチェック
      let consecutiveCount = 1;
      let j = i - 1;
      while (j >= 0 && words[j].toLowerCase().replace(/[^\w]/g, '') === normalizedWord) {
        consecutiveCount++;
        j--;
      }
      
      // 3回以上繰り返された単語はスキップ
      if (consecutiveCount <= 2) {
        result.push(word);
      } else {
        console.log(`🗑️ 繰り返し単語をスキップ: "${word}"`);
      }
    }
    
    return result.join(' ');
  }
  
  /**
   * 最終クリーンアップ
   */
  private finalCleanup(text: string): string {
    let cleaned = text;
    
    // 連続した句読点を一つにまとめる
    cleaned = cleaned.replace(/([.!?])\s*\1+/g, '$1');
    
    // 連続したスペースを一つにまとめる
    cleaned = cleaned.replace(/\s+/g, ' ');
    
    // 最初と最後のスペースを削除
    cleaned = cleaned.trim();
    
    // 空の文や意味のない文を削除
    const sentences = cleaned.split(/[.!?]+/);
    const validSentences = sentences.filter(sentence => {
      const trimmed = sentence.trim();
      return trimmed.length > 3 && trimmed.split(/\s+/).length > 1;
    });
    
    return validSentences.join('. ').trim();
  }
  
  /**
   * Whisper特有のノイズやアーティファクトを削除
   */
  private removeWhisperArtifacts(text: string): string {
    let cleaned = text;
    
    // 音楽タグやノイズタグを削除
    cleaned = cleaned.replace(/\[MUSIC PLAYING\]/gi, '');
    cleaned = cleaned.replace(/\[NOISE\]/gi, '');
    cleaned = cleaned.replace(/\[INAUDIBLE\]/gi, '');
    cleaned = cleaned.replace(/\[.*?\]/gi, '');
    
    // 異常に短い文や意味不明な繰り返しを削除
    const sentences = cleaned.split(/[.!?]+/);
    const validSentences = sentences.filter(sentence => {
      const words = sentence.trim().split(/\s+/);
      // 1単語のみ、または同じ単語のみの文を削除
      if (words.length <= 1) return false;
      const uniqueWords = new Set(words.map(w => w.toLowerCase().replace(/[^\w]/g, '')));
      if (uniqueWords.size <= 1 && words.length > 2) return false;
      return true;
    });
    
    cleaned = validSentences.join('. ').replace(/\s+/g, ' ');
    
    return cleaned;
  }
  
  /**
   * 正規表現用に文字列をエスケープ
   */
  private escapeRegex(string: string): string {
    return string.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  }
  
  /**
   * 簡単なVAD（音声検出）で音声品質を改善
   */
  private applySimpleVAD(audioData: Float32Array): Float32Array {
    const windowSize = 1600; // 16kHz × 0.1秒 = 100msウィンドウ
    const threshold = 0.003; // 音声検出の閾値（小さめにして取りこぼしを減らす）
    const result = new Float32Array(audioData.length);
    
    for (let i = 0; i < audioData.length; i += windowSize) {
      const window = audioData.slice(i, i + windowSize);
      
      // RMS（実効値）を計算
      const rms = Math.sqrt(window.reduce((sum, sample) => sum + sample * sample, 0) / window.length);
      
      if (rms > threshold) {
        // 音声あり: そのままコピー
        result.set(window, i);
      } else {
        // 無音: 音量を小さくする（完全にゼロにしない）
        for (let j = 0; j < window.length && i + j < result.length; j++) {
          result[i + j] = window[j] * 0.1;
        }
      }
    }
    
    return result;
  }

  /**
   * メモリ効率的な音声データ処理
   */
  private async processAudioEfficiently(blob: Blob): Promise<Float32Array | ArrayBuffer> {
    // メモリ使用量を監視
    await this.memoryMonitor.checkMemoryBeforeProcessing(blob.size);
    
    // ファイルサイズが大きい場合は警告
    if (blob.size > 50 * 1024 * 1024) { // 50MB以上
      console.warn('⚠️ 大きなファイルが検出されました。メモリ不足の可能性があります。');
    }
    
    try {
      // WebMファイルの場合はWeb Audio APIで変換
      if (blob.type.includes('webm') || blob.type.includes('ogg')) {
        console.log('🔄 WebM/OGGファイルを検出 - Web Audio APIで変換中...');
        return await this.convertWebMToFloat32Array(blob);
      }
      
      const arrayBuffer = await blob.arrayBuffer();
      this.memoryMonitor.logMemoryAfterProcessing();
      return arrayBuffer;
    } catch (error) {
      this.memoryMonitor.logMemoryError(error);
      throw error;
    }
  }

  /**
   * WebM/OGGファイルをFloat32Arrayに変換（Whisper用）
   */
  private async convertWebMToFloat32Array(blob: Blob): Promise<Float32Array> {
    try {
      // AudioContextを作成
      const audioContext = new (window.AudioContext || (window as any).webkitAudioContext)();
      
      // BlobをArrayBufferに変換
      const arrayBuffer = await blob.arrayBuffer();
      
      // 音声データをデコード
      console.log('🎧 音声データをデコード中...');
      const audioBuffer = await audioContext.decodeAudioData(arrayBuffer.slice(0));
      
      // AudioBufferをFloat32Arrayに変換
      console.log(`🔊 チャンネル数: ${audioBuffer.numberOfChannels}, サンプルレート: ${audioBuffer.sampleRate}Hz`);
      
      // モノラルに変換（Whisperはモノラルを推奨）
      let audioData: Float32Array;
      if (audioBuffer.numberOfChannels === 1) {
        audioData = audioBuffer.getChannelData(0);
      } else {
        // ステレオをモノラルに変換
        const leftChannel = audioBuffer.getChannelData(0);
        const rightChannel = audioBuffer.getChannelData(1);
        audioData = new Float32Array(leftChannel.length);
        for (let i = 0; i < leftChannel.length; i++) {
          audioData[i] = (leftChannel[i] + rightChannel[i]) / 2;
        }
      }
      
      // サンプルレートをWhisperの推奨値に正規化 (16kHz)
      let processedAudioData = audioData;
      if (audioBuffer.sampleRate !== 16000) {
        console.log(`🔄 サンプルレートを${audioBuffer.sampleRate}Hzから16000Hzに変換中...`);
        processedAudioData = this.resampleAudio(audioData, audioBuffer.sampleRate, 16000);
      }
      
      // 簡単なVAD（音声検出）で音声品質を改善
      processedAudioData = this.applySimpleVAD(processedAudioData);
      
      console.log(`✅ 音声データ変換完了: ${processedAudioData.length} サンプル (16kHzモノラル)`);
      
      // AudioContextをクリーンアップ
      if (audioContext.state !== 'closed') {
        await audioContext.close();
      }
      
      // Float32Arrayを直接返す
      return processedAudioData;
    } catch (error) {
      console.error('😱 WebM変換エラー:', error);
      // フォールバック: 空のFloat32Arrayを返す
      console.log('🔄 フォールバック: 空の音声データを返します');
      return new Float32Array(0);
    }
  }

  /**
   * 音声データのサンプルレート変換（簡単なリサンプリング）
   */
  private resampleAudio(audioData: Float32Array, originalRate: number, targetRate: number): Float32Array {
    if (originalRate === targetRate) {
      return audioData;
    }
    
    const ratio = originalRate / targetRate;
    const newLength = Math.round(audioData.length / ratio);
    const resampled = new Float32Array(newLength);
    
    for (let i = 0; i < newLength; i++) {
      const sourceIndex = i * ratio;
      const index = Math.floor(sourceIndex);
      const fraction = sourceIndex - index;
      
      if (index + 1 < audioData.length) {
        // 線形補間
        resampled[i] = audioData[index] * (1 - fraction) + audioData[index + 1] * fraction;
      } else {
        resampled[i] = audioData[index];
      }
    }
    
    return resampled;
  }

  /**
   * 複数の音声ファイルを順次処理
   */
  async transcribeMultipleBlobs(
    blobs: Blob[],
    fileNames: string[],
    onProgress?: (progress: TranscriptionProgress) => void,
    language: string = 'ja'
  ): Promise<TranscriptionResult[]> {
    // 初期化
    if (!this.pipeline) {
      await this.initialize((status) => {
        if (onProgress) {
          onProgress({
            current: 0,
            total: blobs.length,
            status,
            fileStates: new Map()
          });
        }
      });
    }

    this.abortController = new AbortController();

    const results: TranscriptionResult[] = [];
    const fileStates = new Map<number, TranscriptionResult>();
    let completed = 0;

    // 初期状態を設定
    for (let i = 0; i < blobs.length; i++) {
      const initialResult: TranscriptionResult = {
        partNumber: i + 1,
        fileName: fileNames[i] || `Part ${i + 1}`,
        transcription: '',
        status: 'pending'
      };
      fileStates.set(i + 1, initialResult);
    }

    // 順次処理
    for (let i = 0; i < blobs.length; i++) {
      // キャンセルチェック
      if (this.abortController?.signal.aborted) {
        throw new Error('キャンセルされました');
      }

      const blob = blobs[i];
      const fileName = fileNames[i] || `Part ${i + 1}`;
      const partNumber = i + 1;

      // 処理開始
      const processingResult: TranscriptionResult = {
        partNumber,
        fileName,
        transcription: '',
        status: 'processing'
      };
      fileStates.set(partNumber, processingResult);

      if (onProgress) {
        onProgress({
          current: completed,
          total: blobs.length,
          status: `処理中: ${fileName}`,
          fileStates
        });
      }

      try {
        const transcription = await this.transcribeAudioBlob(
          blob,
          fileName,
          undefined,
          language
        );

        const completedResult: TranscriptionResult = {
          partNumber,
          fileName,
          transcription,
          status: 'completed'
        };

        results.push(completedResult);
        completed++;
        fileStates.set(partNumber, completedResult);

        if (onProgress) {
          onProgress({
            current: completed,
            total: blobs.length,
            status: `完了: ${fileName}`,
            fileStates
          });
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
        fileStates.set(partNumber, errorResult);
      }
    }

    return results;
  }

  /**
   * 処理をキャンセル
   */
  cancelTranscription(): void {
    if (this.abortController) {
      this.abortController.abort();
    }
  }

  /**
   * モデルをクリーンアップ
   */
  async dispose(): Promise<void> {
    if (this.pipeline) {
      // パイプラインを破棄
      this.pipeline = null;
    }
  }
}
