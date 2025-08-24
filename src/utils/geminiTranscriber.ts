import { GoogleGenerativeAI } from '@google/generative-ai';

export interface TranscriptionResult {
  partNumber: number;
  fileName: string;
  transcription: string;
  error?: string;
}

export class GeminiTranscriber {
  private genAI: GoogleGenerativeAI | null = null;
  private model: any = null;

  constructor(apiKey?: string) {
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
      model: 'gemini-1.5-flash' 
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
    onProgress?: (current: number, total: number, status: string) => void,
    delay: number = 1000,
    customPrompt?: string
  ): Promise<TranscriptionResult[]> {
    if (!this.model) {
      throw new Error('Gemini APIが初期化されていません。APIキーを設定してください。');
    }

    const results: TranscriptionResult[] = [];
    
    for (let i = 0; i < blobs.length; i++) {
      const blob = blobs[i];
      const fileName = fileNames[i] || `Part ${i + 1}`;
      
      if (onProgress) {
        onProgress(i + 1, blobs.length, `処理中: ${fileName}`);
      }
      
      try {
        const transcription = await this.transcribeAudioBlob(blob, fileName, undefined, customPrompt);
        results.push({
          partNumber: i + 1,
          fileName,
          transcription
        });
        
        // API制限を避けるための遅延
        if (i < blobs.length - 1) {
          await this.delay(delay);
        }
        
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : '不明なエラー';
        results.push({
          partNumber: i + 1,
          fileName,
          transcription: '',
          error: errorMessage
        });
      }
    }
    
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