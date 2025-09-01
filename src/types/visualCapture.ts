// Visual capture types and interfaces
export interface VisualCaptureSettings {
  enabled: boolean;           // 機能有効/無効
  interval: number;          // キャプチャ間隔（秒）
  maxCaptures: number;       // 最大撮影枚数
  imageQuality: number;      // 画質 0.1-1.0
  imageFormat: 'jpeg' | 'png'; // 画像形式
  duplicateDetection: boolean; // 重複検出機能
  duplicateThreshold: number;  // 重複判定閾値 0.8-0.99
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
  uploaded?: boolean;       // アップロード画像フラグ（重複チェック除外用）
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
  maxCaptures: 100,          // 最大100枚（重複検出により効率化）
  imageQuality: 0.7,         // 70%品質（コスト削減）
  imageFormat: 'jpeg',
  duplicateDetection: true,  // 重複検出有効
  duplicateThreshold: 0.95   // 95%以上の類似度で重複とみなす
};