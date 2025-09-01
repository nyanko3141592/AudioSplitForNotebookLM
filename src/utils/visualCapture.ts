// Visual capture utility for tab sharing recording
import type { VisualCaptureSettings, CaptureAnalysis } from '../types/visualCapture';

export class VisualCaptureManager {
  private stream: MediaStream | null = null;
  private settings: VisualCaptureSettings;
  private intervalId: number | null = null;
  private captureCount: number = 0;
  private startTime: number = 0;
  private onCaptureCallback?: (analysis: CaptureAnalysis) => void;
  private onStateChangeCallback?: (isCapturing: boolean, nextCaptureIn: number) => void;

  constructor(settings: VisualCaptureSettings) {
    this.settings = settings;
  }

  /**
   * タブ共有ストリームを設定してキャプチャを開始
   */
  public async startCapture(
    stream: MediaStream,
    onCapture?: (analysis: CaptureAnalysis) => void,
    onStateChange?: (isCapturing: boolean, nextCaptureIn: number) => void
  ): Promise<void> {
    if (!this.settings.enabled) {
      console.log('Visual capture is disabled');
      return;
    }

    this.stream = stream;
    this.onCaptureCallback = onCapture;
    this.onStateChangeCallback = onStateChange;
    this.captureCount = 0;
    this.startTime = Date.now();

    console.log('🎥 Starting visual capture with settings:', this.settings);

    // 即座に最初の1枚を撮影
    await this.captureFrame();

    // 定期キャプチャの開始
    this.startPeriodicCapture();
  }

  /**
   * キャプチャを停止
   */
  public stopCapture(): void {
    if (this.intervalId) {
      clearInterval(this.intervalId);
      this.intervalId = null;
    }
    
    this.stream = null;
    this.onStateChangeCallback?.(false, 0);
    console.log('🛑 Visual capture stopped');
  }

  /**
   * 定期キャプチャタイマーを開始
   */
  private startPeriodicCapture(): void {
    if (this.captureCount >= this.settings.maxCaptures) {
      console.log('📸 Max captures reached, stopping periodic capture');
      this.onStateChangeCallback?.(false, 0);
      return;
    }

    this.intervalId = window.setInterval(async () => {
      if (this.captureCount < this.settings.maxCaptures) {
        await this.captureFrame();
      } else {
        console.log('📸 Max captures reached');
        this.stopCapture();
      }
    }, this.settings.interval * 1000);

    // 次回キャプチャまでのカウントダウン更新
    this.startCountdown();
  }

  /**
   * 次回キャプチャまでのカウントダウンを更新
   */
  private startCountdown(): void {
    let remaining = this.settings.interval;
    
    const countdownInterval = setInterval(() => {
      remaining--;
      this.onStateChangeCallback?.(true, remaining);
      
      if (remaining <= 0 || !this.intervalId) {
        clearInterval(countdownInterval);
      }
    }, 1000);
  }

  /**
   * 1フレームをキャプチャして分析
   */
  private async captureFrame(): Promise<void> {
    if (!this.stream) return;

    try {
      console.log(`📸 Capturing frame ${this.captureCount + 1}/${this.settings.maxCaptures}`);

      const videoTrack = this.stream.getVideoTracks()[0];
      if (!videoTrack) {
        throw new Error('No video track available for capture');
      }

      // ImageCaptureを使用してフレームを取得
      const imageCapture = new (window as any).ImageCapture(videoTrack);
      const bitmap = await imageCapture.grabFrame();

      // Canvasに描画してbase64に変換
      const canvas = document.createElement('canvas');
      const ctx = canvas.getContext('2d');
      if (!ctx) {
        throw new Error('Cannot get canvas context');
      }

      canvas.width = bitmap.width;
      canvas.height = bitmap.height;
      ctx.drawImage(bitmap, 0, 0);

      // 画質設定を適用してbase64に変換
      const imageData = canvas.toDataURL(
        `image/${this.settings.imageFormat}`,
        this.settings.imageQuality
      );

      // メタデータ作成
      const recordingTime = Math.floor((Date.now() - this.startTime) / 1000);
      const analysis: CaptureAnalysis = {
        id: `capture_${Date.now()}_${this.captureCount}`,
        timestamp: new Date().toISOString(),
        recordingTime,
        imageData,
        description: '', // Gemini Vision APIで後から設定
        tokens: 0
      };

      this.captureCount++;
      
      // コールバック呼び出し
      this.onCaptureCallback?.(analysis);

      console.log(`✅ Frame captured successfully (${this.captureCount}/${this.settings.maxCaptures})`);

    } catch (error) {
      console.error('❌ Failed to capture frame:', error);
      
      // エラー情報付きの分析結果を作成
      const errorAnalysis: CaptureAnalysis = {
        id: `error_${Date.now()}_${this.captureCount}`,
        timestamp: new Date().toISOString(),
        recordingTime: Math.floor((Date.now() - this.startTime) / 1000),
        imageData: '',
        description: '',
        error: error instanceof Error ? error.message : 'Unknown capture error'
      };

      this.onCaptureCallback?.(errorAnalysis);
    }
  }

  /**
   * 現在の設定を更新
   */
  public updateSettings(newSettings: Partial<VisualCaptureSettings>): void {
    this.settings = { ...this.settings, ...newSettings };
    console.log('⚙️ Visual capture settings updated:', this.settings);
  }

  /**
   * 手動で即座にキャプチャを実行
   */
  public async captureNow(): Promise<void> {
    if (!this.stream) {
      console.warn('No stream available for manual capture');
      return;
    }
    
    console.log('📸 Manual capture triggered');
    await this.captureFrame();
  }

  /**
   * 現在のキャプチャ状態を取得
   */
  public getStatus(): { isCapturing: boolean; captureCount: number; maxCaptures: number } {
    return {
      isCapturing: this.intervalId !== null,
      captureCount: this.captureCount,
      maxCaptures: this.settings.maxCaptures
    };
  }
}

/**
 * コスト推定計算
 */
export const estimateCapturesCost = (
  imageCount: number,
  tokensPerImage: number = 1000
): { estimatedTokens: number; estimatedCostJPY: number; warning: string | null } => {
  const estimatedTokens = imageCount * tokensPerImage;
  
  // Gemini Pro Vision料金想定（概算）: 1000トークンあたり約¥3-5
  const costPerToken = 0.004; // ¥0.004/token
  const estimatedCostJPY = Math.ceil(estimatedTokens * costPerToken);
  
  let warning: string | null = null;
  if (estimatedCostJPY > 100) {
    warning = `推定コストが¥${estimatedCostJPY}と高額になります。枚数や間隔の調整を検討してください。`;
  } else if (estimatedCostJPY > 50) {
    warning = `推定コスト¥${estimatedCostJPY}です。ご注意ください。`;
  }
  
  return {
    estimatedTokens,
    estimatedCostJPY,
    warning
  };
};