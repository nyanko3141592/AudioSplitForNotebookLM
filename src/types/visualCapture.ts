// Visual capture types and interfaces
export interface VisualCaptureSettings {
  enabled: boolean;           // 機能有効/無効
  interval: number;          // キャプチャ間隔（秒）
  maxCaptures: number;       // 最大撮影枚数
  imageQuality: number;      // 画質 0.1-1.0
  imageFormat: 'jpeg' | 'png'; // 画像形式
}

export interface CaptureAnalysis {
  id: string;               // ユニークID
  timestamp: string;        // 撮影時刻
  recordingTime: number;    // 録音開始からの経過時間（秒）
  imageData: string;        // base64画像データ
  description: string;      // Geminiによる画面説明
  confidence?: number;      // 分析信頼度
  tokens?: number;         // 使用トークン数
  error?: string;          // エラーメッセージ
}

export interface CostEstimation {
  imagesCount: number;
  estimatedTokens: number;
  estimatedCostJPY: number;
  warning: string | null;
}

export interface VisualCaptureState {
  isCapturing: boolean;
  capturedImages: CaptureAnalysis[];
  nextCaptureIn: number;     // 次回キャプチャまでの秒数
  totalCost: CostEstimation;
}

export const defaultVisualCaptureSettings: VisualCaptureSettings = {
  enabled: true,
  interval: 60,              // 1分間隔
  maxCaptures: 5,            // 最大5枚
  imageQuality: 0.7,         // 70%品質（コスト削減）
  imageFormat: 'jpeg'
};