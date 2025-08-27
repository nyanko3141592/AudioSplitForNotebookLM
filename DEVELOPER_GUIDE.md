# 開発者ガイド

## 目次
- [開発環境セットアップ](#開発環境セットアップ)
- [アーキテクチャ概要](#アーキテクチャ概要)
- [コンポーネント設計](#コンポーネント設計)
- [状態管理](#状態管理)
- [音声処理エンジン](#音声処理エンジン)
- [AI統合](#ai統合)
- [UI/UXデザインシステム](#uiuxデザインシステム)
- [テスト戦略](#テスト戦略)
- [デバッグ・監視](#デバッグ監視)
- [パフォーマンス最適化](#パフォーマンス最適化)
- [デプロイメント](#デプロイメント)
- [コントリビューション](#コントリビューション)

## 開発環境セットアップ

### 必要な環境
```bash
# Node.js 18以上
node --version  # v18.0.0+

# npm 9以上 
npm --version   # v9.0.0+

# Git
git --version   # 任意のバージョン
```

### プロジェクトセットアップ
```bash
# 1. リポジトリクローン
git clone https://github.com/nyanko3141592/AudioSplitForNotebookLM.git
cd AudioSplitForNotebookLM

# 2. 依存関係インストール
npm install

# 3. 開発サーバー起動
npm run dev
# → http://localhost:5173

# 4. 別ターミナルで型チェック（推奨）
npm run type-check:watch
```

### 推奨開発ツール

#### VS Code 拡張機能
```json
{
  "recommendations": [
    "ms-vscode.vscode-typescript-next",
    "bradlc.vscode-tailwindcss",
    "ms-vscode.vscode-json",
    "esbenp.prettier-vscode",
    "dbaeumer.vscode-eslint",
    "ms-vscode.vscode-eslint"
  ]
}
```

#### VS Code 設定 (.vscode/settings.json)
```json
{
  "editor.codeActionsOnSave": {
    "source.fixAll.eslint": true
  },
  "editor.formatOnSave": true,
  "editor.defaultFormatter": "esbenp.prettier-vscode",
  "typescript.preferences.importModuleSpecifier": "relative"
}
```

### 開発スクリプト
```bash
# 開発サーバー
npm run dev              # 開発サーバー起動

# ビルド
npm run build           # 本番ビルド
npm run preview         # ビルド結果プレビュー

# 品質チェック
npm run type-check      # TypeScript型チェック
npm run lint           # ESLint実行
npm run format         # Prettier実行

# 監視モード
npm run type-check:watch # 型チェック監視
npm run lint:watch      # ESLint監視
```

## アーキテクチャ概要

### システム構成
```
┌─────────────────────────────────────────────────────┐
│                    Browser                          │
├─────────────────────────────────────────────────────┤
│  ┌─────────────────────────────────────────────────┐│
│  │              React App                          ││
│  │  ┌─────────────────────────────────────────────┐││
│  │  │           Components                        │││
│  │  │  ┌─────────────────────────────────────────┐│││
│  │  │  │         Audio Processing                ││││
│  │  │  │  ┌─────────────────────────────────────┐││││
│  │  │  │  │      Web Audio API                  │││││
│  │  │  │  │      FFmpeg.wasm (fallback)         │││││
│  │  │  │  └─────────────────────────────────────┘││││
│  │  │  └─────────────────────────────────────────┘│││
│  │  └─────────────────────────────────────────────┘││
│  └─────────────────────────────────────────────────┘│
└─────────────────────────────────────────────────────┘
                           │
                    HTTPS (Direct)
                           │
                           ▼
                 ┌─────────────────┐
                 │  Gemini API     │
                 │  (Google AI)    │
                 └─────────────────┘
```

### レイヤー構造
```
┌─────────────────────────────────────┐
│        Presentation Layer           │  → React Components
├─────────────────────────────────────┤
│         Business Logic              │  → Custom Hooks
├─────────────────────────────────────┤
│         Data Access                 │  → Utilities & API
├─────────────────────────────────────┤
│         Infrastructure              │  → Browser APIs
└─────────────────────────────────────┘
```

### データフロー
```
User Input → State Management → Processing Engine → API/Storage → UI Update
     │              │                    │              │           │
     ▼              ▼                    ▼              ▼           ▼
 File Upload    useState/useCallback   Audio/AI       Gemini/     Re-render
 Settings       Context/Callbacks      Processing     localStorage Components
```

## コンポーネント設計

### ディレクトリ構造
```
src/
├── components/                     # UIコンポーネント
│   ├── HeroSection.tsx            # ヘッダー・ナビゲーション
│   ├── RecordingPanel.tsx         # 録音機能
│   ├── FileUpload.tsx             # ファイルアップロード
│   │
│   └── steps/                     # ワークフローステップ
│       ├── TranscriptionStep.tsx  # 文字起こし
│       └── SummaryStep.tsx        # 要約生成
│
├── pages/                         # ページコンポーネント
│   ├── TranscribePage.tsx         # 文字起こしページ
│   └── SplitPage.tsx             # 分割ページ
│
├── hooks/                         # カスタムフック
│   └── useFFmpeg.ts              # FFmpeg統合
│
├── utils/                         # ユーティリティ
│   ├── audioSplitter.ts          # 音声分割エンジン
│   ├── geminiTranscriber.ts      # AI統合
│   ├── storage.ts                # ストレージ管理
│   └── format.ts                 # テキスト処理
│
└── App.tsx                       # ルートコンポーネント
```

### コンポーネント設計原則

#### 1. 責任の分離 (Separation of Concerns)
```typescript
// ❌ Bad - 一つのコンポーネントで全てを処理
function AudioProcessor() {
  // ファイル処理 + UI + API呼び出し + 状態管理
}

// ✅ Good - 責任を分離
function AudioProcessorPage() {
  // 状態管理・調整のみ
  return (
    <div>
      <FileUpload onFile={handleFile} />
      <ProcessingSettings {...settings} />
      <ProcessingEngine {...config} />
      <ResultsDisplay {...results} />
    </div>
  );
}
```

#### 2. Composition over Inheritance
```typescript
// ✅ コンポーネント合成パターン
function ProcessingCard({ children, title, status }) {
  return (
    <div className="card">
      <CardHeader title={title} status={status} />
      <CardContent>{children}</CardContent>
    </div>
  );
}

// 使用例
<ProcessingCard title="文字起こし" status="processing">
  <TranscriptionSettings />
  <TranscriptionResults />
</ProcessingCard>
```

#### 3. プロップスインターフェース
```typescript
// 明確なプロップス定義
interface ComponentProps {
  // 必須プロップス
  required: string;
  
  // オプション（デフォルト値付き）
  optional?: boolean;
  
  // 関数プロップス
  onAction: (data: ActionData) => void;
  
  // Children
  children?: React.ReactNode;
}

export function Component({ 
  required, 
  optional = false, 
  onAction, 
  children 
}: ComponentProps) {
  // 実装
}
```

### 状態管理パターン

#### 1. ローカル状態 (useState)
```typescript
// シンプルなローカル状態
function FileUpload() {
  const [isDragging, setIsDragging] = useState(false);
  const [file, setFile] = useState<File | null>(null);
  
  // ローカルでのみ使用される状態
}
```

#### 2. 状態のリフトアップ (Lift State Up)
```typescript
// 親コンポーネントで状態管理
function TranscribePage() {
  const [stepState, setStepState] = useState({
    hasFile: false,
    hasApiKey: false,
    // ...
  });
  
  return (
    <div>
      <HeroSection stepState={stepState} />
      <TranscriptionStep 
        onStepChange={setStepState} 
      />
    </div>
  );
}
```

#### 3. コールバックパターン
```typescript
// 子から親への状態通知
interface ChildComponentProps {
  onStateChange: (newState: StateType) => void;
}

function ChildComponent({ onStateChange }: ChildComponentProps) {
  const handleAction = () => {
    const newState = computeNewState();
    onStateChange(newState);
  };
  
  return <button onClick={handleAction}>Action</button>;
}
```

## 音声処理エンジン

### Web Audio API (主要エンジン)

#### 基本的な処理フロー
```typescript
// 1. AudioContext作成
const audioContext = new AudioContext();

// 2. ファイル読み込み
const arrayBuffer = await file.arrayBuffer();

// 3. デコード
const audioBuffer = await audioContext.decodeAudioData(arrayBuffer);

// 4. 分割処理
const channels = [];
for (let i = 0; i < audioBuffer.numberOfChannels; i++) {
  channels.push(audioBuffer.getChannelData(i));
}

// 5. WAVエンコード
const wavBuffer = encodeWAV(channels, audioBuffer.sampleRate);

// 6. クリーンアップ
audioContext.close();
```

#### WAVエンコーダー実装
```typescript
function encodeWAV(
  channels: Float32Array[], 
  sampleRate: number, 
  bitDepth: number = 16
): ArrayBuffer {
  const numChannels = channels.length;
  const numSamples = channels[0].length;
  const bytesPerSample = bitDepth / 8;
  const blockAlign = numChannels * bytesPerSample;
  const byteRate = sampleRate * blockAlign;
  const dataSize = numSamples * blockAlign;
  
  const buffer = new ArrayBuffer(44 + dataSize);
  const view = new DataView(buffer);
  
  // WAVヘッダー作成
  writeString(view, 0, 'RIFF');
  view.setUint32(4, 36 + dataSize, true);
  writeString(view, 8, 'WAVE');
  writeString(view, 12, 'fmt ');
  view.setUint32(16, 16, true);
  view.setUint16(20, 1, true); // PCM
  view.setUint16(22, numChannels, true);
  view.setUint32(24, sampleRate, true);
  view.setUint32(28, byteRate, true);
  view.setUint16(32, blockAlign, true);
  view.setUint16(34, bitDepth, true);
  writeString(view, 36, 'data');
  view.setUint32(40, dataSize, true);
  
  // オーディオデータ書き込み
  let offset = 44;
  for (let i = 0; i < numSamples; i++) {
    for (let channel = 0; channel < numChannels; channel++) {
      const sample = Math.max(-1, Math.min(1, channels[channel][i]));
      if (bitDepth === 16) {
        view.setInt16(offset, sample * 0x7FFF, true);
        offset += 2;
      }
    }
  }
  
  return buffer;
}

function writeString(view: DataView, offset: number, string: string) {
  for (let i = 0; i < string.length; i++) {
    view.setUint8(offset + i, string.charCodeAt(i));
  }
}
```

### FFmpeg.wasm (フォールバック)

#### 初期化とセットアップ
```typescript
import { FFmpeg } from '@ffmpeg/ffmpeg';
import { toBlobURL } from '@ffmpeg/util';

class FFmpegProcessor {
  private ffmpeg: FFmpeg | null = null;
  private initialized = false;
  
  async initialize(): Promise<void> {
    if (this.initialized) return;
    
    this.ffmpeg = new FFmpeg();
    
    // WASM/Worker URL設定
    const baseURL = 'https://unpkg.com/@ffmpeg/core@0.12.6/dist/umd';
    await this.ffmpeg.load({
      coreURL: await toBlobURL(`${baseURL}/ffmpeg-core.js`, 'text/javascript'),
      wasmURL: await toBlobURL(`${baseURL}/ffmpeg-core.wasm`, 'application/wasm'),
      workerURL: await toBlobURL(`${baseURL}/ffmpeg-core.worker.js`, 'text/javascript')
    });
    
    this.initialized = true;
  }
  
  async splitAudio(
    file: File, 
    segmentDuration: number
  ): Promise<Blob[]> {
    await this.initialize();
    
    // ファイルをFFmpegファイルシステムに書き込み
    await this.ffmpeg!.writeFile('input.webm', await fetchFile(file));
    
    // セグメント化コマンド実行
    await this.ffmpeg!.exec([
      '-i', 'input.webm',
      '-f', 'segment',
      '-segment_time', segmentDuration.toString(),
      '-c', 'copy',
      'output%03d.wav'
    ]);
    
    // 結果ファイル読み込み
    const files: Blob[] = [];
    let index = 0;
    
    while (true) {
      try {
        const filename = `output${index.toString().padStart(3, '0')}.wav`;
        const data = await this.ffmpeg!.readFile(filename);
        files.push(new Blob([data], { type: 'audio/wav' }));
        index++;
      } catch {
        break; // ファイルが存在しない場合は終了
      }
    }
    
    return files;
  }
}
```

### エンジン選択ロジック
```typescript
class AudioSplitter {
  private preferredEngine: 'webaudio' | 'ffmpeg' = 'webaudio';
  
  constructor() {
    // 環境に基づくエンジン選択
    this.preferredEngine = this.detectBestEngine();
  }
  
  private detectBestEngine(): 'webaudio' | 'ffmpeg' {
    // Web Audio API対応チェック
    if (typeof AudioContext === 'undefined' && 
        typeof webkitAudioContext === 'undefined') {
      return 'ffmpeg';
    }
    
    // メモリ使用量チェック
    const memory = (performance as any).memory;
    if (memory && memory.usedJSHeapSize > memory.jsHeapSizeLimit * 0.8) {
      return 'ffmpeg'; // メモリ不足の場合FFmpeg使用
    }
    
    return 'webaudio';
  }
  
  async splitAudio(file: File, options: SplitOptions): Promise<Blob[]> {
    try {
      if (this.preferredEngine === 'webaudio') {
        return await this.splitWithWebAudio(file, options);
      } else {
        return await this.splitWithFFmpeg(file, options);
      }
    } catch (error) {
      // フォールバック
      console.warn(`${this.preferredEngine} failed, trying fallback`);
      
      if (this.preferredEngine === 'webaudio') {
        return await this.splitWithFFmpeg(file, options);
      } else {
        return await this.splitWithWebAudio(file, options);
      }
    }
  }
}
```

## AI統合

### Gemini API統合

#### 基本的なトランスクリプション
```typescript
import { GoogleGenerativeAI } from '@google/generative-ai';

class GeminiTranscriber {
  private genAI: GoogleGenerativeAI;
  private model: any;
  
  constructor(apiKey: string, modelName: string = 'gemini-2.0-flash-lite') {
    this.genAI = new GoogleGenerativeAI(apiKey);
    this.model = this.genAI.getGenerativeModel({ model: modelName });
  }
  
  async transcribeAudio(audioBlob: Blob): Promise<string> {
    // Blobをbase64に変換
    const base64Data = await this.blobToBase64(audioBlob);
    const mimeType = audioBlob.type;
    
    const result = await this.model.generateContent([
      {
        inlineData: {
          data: base64Data,
          mimeType: mimeType
        }
      },
      { text: "この音声ファイルを文字起こししてください。" }
    ]);
    
    return result.response.text();
  }
  
  private async blobToBase64(blob: Blob): Promise<string> {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => {
        const dataUrl = reader.result as string;
        const base64 = dataUrl.split(',')[1];
        resolve(base64);
      };
      reader.onerror = reject;
      reader.readAsDataURL(blob);
    });
  }
}
```

#### 並列処理実装
```typescript
class Semaphore {
  private permits: number;
  private waiting: Array<() => void> = [];
  
  constructor(permits: number) {
    this.permits = permits;
  }
  
  async acquire<T>(task: () => Promise<T>): Promise<T> {
    return new Promise((resolve, reject) => {
      if (this.permits > 0) {
        this.permits--;
        this.executeTask(task, resolve, reject);
      } else {
        this.waiting.push(() => {
          this.permits--;
          this.executeTask(task, resolve, reject);
        });
      }
    });
  }
  
  private async executeTask<T>(
    task: () => Promise<T>,
    resolve: (value: T) => void,
    reject: (error: any) => void
  ) {
    try {
      const result = await task();
      resolve(result);
    } catch (error) {
      reject(error);
    } finally {
      this.permits++;
      if (this.waiting.length > 0) {
        const next = this.waiting.shift()!;
        next();
      }
    }
  }
}

// 使用例
async function transcribeMultipleFiles(
  files: Blob[], 
  transcriber: GeminiTranscriber
): Promise<string[]> {
  const semaphore = new Semaphore(3); // 最大3並列
  
  const promises = files.map((file, index) => 
    semaphore.acquire(async () => {
      console.log(`Processing file ${index + 1}/${files.length}`);
      return await transcriber.transcribeAudio(file);
    })
  );
  
  return Promise.all(promises);
}
```

#### エラーハンドリング・リトライ
```typescript
class RobustTranscriber extends GeminiTranscriber {
  async transcribeWithRetry(
    audioBlob: Blob, 
    maxRetries: number = 3,
    baseDelay: number = 1000
  ): Promise<string> {
    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      try {
        return await this.transcribeAudio(audioBlob);
      } catch (error) {
        console.warn(`Attempt ${attempt} failed:`, error);
        
        if (attempt === maxRetries) {
          throw new Error(`Failed after ${maxRetries} attempts: ${error}`);
        }
        
        // 指数バックオフ
        const delay = baseDelay * Math.pow(2, attempt - 1);
        await new Promise(resolve => setTimeout(resolve, delay));
      }
    }
    
    throw new Error('Unreachable');
  }
}
```

### コスト計算・監視
```typescript
interface CostCalculator {
  calculateTranscriptionCost(
    durationSeconds: number, 
    model: string
  ): CostBreakdown;
  
  calculateSummaryCost(
    textLength: number, 
    model: string
  ): CostBreakdown;
}

interface CostBreakdown {
  inputCost: number;
  outputCost: number;
  totalCost: number;
  tokens: number;
}

class GeminiCostCalculator implements CostCalculator {
  private readonly PRICING = {
    'gemini-2.0-flash-lite': { 
      audio: { input: 0.075, output: 0.30 },
      text: { input: 0.075, output: 0.30 }
    },
    'gemini-2.5-flash': {
      audio: { input: 1.00, output: 2.50 },
      text: { input: 0.30, output: 2.50 }
    },
    'gemini-2.5-pro': {
      audio: { input: 1.00, output: 2.50 },
      text: { input: 0.30, output: 2.50 }
    }
  };
  
  calculateTranscriptionCost(
    durationSeconds: number, 
    model: string
  ): CostBreakdown {
    const pricing = this.PRICING[model] || this.PRICING['gemini-2.0-flash-lite'];
    const audioTokens = durationSeconds * 32; // 1秒 = 32トークン
    const millionTokens = audioTokens / 1000000;
    
    const inputCost = millionTokens * pricing.audio.input;
    const outputCost = millionTokens * pricing.audio.output * 0.1; // 出力は入力の10%と仮定
    
    return {
      inputCost,
      outputCost,
      totalCost: inputCost + outputCost,
      tokens: audioTokens
    };
  }
  
  calculateSummaryCost(textLength: number, model: string): CostBreakdown {
    const pricing = this.PRICING[model] || this.PRICING['gemini-2.0-flash-lite'];
    const textTokens = textLength / 4; // おおよそ4文字 = 1トークン
    const millionTokens = textTokens / 1000000;
    
    const inputCost = millionTokens * pricing.text.input;
    const outputCost = millionTokens * pricing.text.output * 0.3; // 出力は入力の30%と仮定
    
    return {
      inputCost,
      outputCost,
      totalCost: inputCost + outputCost,
      tokens: textTokens
    };
  }
}
```

## UI/UXデザインシステム

### カラーシステム
```css
/* CSS Custom Properties */
:root {
  /* Primary Colors - Violet */
  --violet-50: #f5f3ff;
  --violet-100: #ede9fe;
  --violet-200: #ddd6fe;
  --violet-300: #c4b5fd;
  --violet-400: #a78bfa;
  --violet-500: #8b5cf6;
  --violet-600: #7c3aed;
  --violet-700: #6d28d9;
  --violet-800: #5b21b6;
  --violet-900: #4c1d95;
  
  /* Secondary Colors - Purple */
  --purple-600: #9333ea;
  --purple-700: #7e22ce;
  
  /* Status Colors */
  --success: #10b981;
  --warning: #f59e0b;
  --error: #ef4444;
  --info: #3b82f6;
  
  /* Neutral Colors */
  --gray-50: #f9fafb;
  --gray-100: #f3f4f6;
  --gray-200: #e5e7eb;
  --gray-300: #d1d5db;
  --gray-400: #9ca3af;
  --gray-500: #6b7280;
  --gray-600: #4b5563;
  --gray-700: #374151;
  --gray-800: #1f2937;
  --gray-900: #111827;
}
```

### コンポーネントクラス
```css
/* Card Components */
.card-primary {
  @apply bg-white rounded-2xl shadow-lg p-8 border border-gray-200;
}

.card-input {
  @apply bg-violet-50 rounded-xl p-6 border border-violet-200;
}

.card-output {
  @apply bg-green-50 rounded-xl p-6 border border-green-200;
}

.card-processing {
  @apply bg-blue-50 rounded-xl p-6 border border-blue-200;
}

.card-error {
  @apply bg-red-50 rounded-xl p-4 border border-red-200;
}

/* Button Components */
.btn-primary {
  @apply px-8 py-3 bg-gradient-to-r from-violet-600 to-purple-600 
         text-white font-semibold rounded-xl 
         hover:from-violet-700 hover:to-purple-700 
         disabled:opacity-50 disabled:cursor-not-allowed 
         transition-all duration-200 flex items-center gap-2 
         shadow-lg hover:shadow-xl;
}

.btn-secondary {
  @apply px-6 py-2 bg-white border border-gray-300 
         text-gray-700 font-medium rounded-lg 
         hover:bg-gray-50 hover:border-gray-400 
         transition-colors flex items-center gap-2;
}

.btn-success {
  @apply px-4 py-2 bg-green-600 text-white font-medium rounded-lg 
         hover:bg-green-700 transition-colors flex items-center gap-2;
}

/* Glass Morphism */
.glass {
  background: rgba(255, 255, 255, 0.95);
  backdrop-filter: blur(10px);
  -webkit-backdrop-filter: blur(10px);
  border: 1px solid rgba(255, 255, 255, 0.5);
}

/* Animations */
@keyframes fadeIn {
  from { opacity: 0; transform: translateY(10px); }
  to { opacity: 1; transform: translateY(0); }
}

.fade-in {
  animation: fadeIn 0.3s ease-out;
}

@keyframes slideDown {
  from { opacity: 0; transform: translateY(-10px); }
  to { opacity: 1; transform: translateY(0); }
}

.slide-down {
  animation: slideDown 0.2s ease-out;
}

/* Progress Indicators */
.progress-bar {
  @apply w-full bg-gray-200 rounded-full h-2 overflow-hidden;
}

.progress-fill {
  @apply h-full bg-gradient-to-r from-violet-500 to-purple-500 
         transition-all duration-300 ease-out;
}

/* Loading States */
.loading-spinner {
  @apply inline-block w-4 h-4 border-2 border-current border-t-transparent 
         rounded-full animate-spin;
}

.loading-pulse {
  @apply animate-pulse bg-gray-200 rounded;
}
```

### レスポンシブデザインパターン
```typescript
// Tailwind Breakpoints
const breakpoints = {
  sm: '640px',   // Small screens
  md: '768px',   // Medium screens
  lg: '1024px',  // Large screens
  xl: '1280px',  // Extra large screens
  '2xl': '1536px' // 2X large screens
};

// Responsive Component Example
function ResponsiveCard({ children }: { children: React.ReactNode }) {
  return (
    <div className="
      w-full p-4
      sm:p-6 sm:max-w-lg
      md:p-8 md:max-w-2xl
      lg:p-10 lg:max-w-4xl
      xl:p-12 xl:max-w-6xl
      mx-auto
    ">
      {children}
    </div>
  );
}

// Mobile-first Grid
function ResponsiveGrid({ items }: { items: any[] }) {
  return (
    <div className="
      grid grid-cols-1 gap-4
      sm:grid-cols-2 sm:gap-6
      lg:grid-cols-3 lg:gap-8
    ">
      {items.map(item => (
        <div key={item.id} className="...">
          {item.content}
        </div>
      ))}
    </div>
  );
}
```

### アクセシビリティ
```typescript
// ARIA Labels and Roles
function AccessibleButton({ 
  children, 
  onClick, 
  disabled = false,
  ariaLabel,
  ariaDescribedBy 
}: {
  children: React.ReactNode;
  onClick: () => void;
  disabled?: boolean;
  ariaLabel?: string;
  ariaDescribedBy?: string;
}) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      aria-label={ariaLabel}
      aria-describedby={ariaDescribedBy}
      className="btn-primary focus:outline-none focus:ring-2 focus:ring-violet-500"
    >
      {children}
    </button>
  );
}

// Keyboard Navigation
function NavigationHeader() {
  const handleKeyDown = (event: React.KeyboardEvent, stepId: string) => {
    if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault();
      scrollToSection(stepId);
    }
  };
  
  return (
    <nav role="navigation" aria-label="ワークフロー進捗">
      {steps.map((step, index) => (
        <div
          key={step.id}
          role="button"
          tabIndex={0}
          onKeyDown={(e) => handleKeyDown(e, step.id)}
          onClick={() => scrollToSection(step.id)}
          aria-label={`ステップ ${index + 1}: ${step.label}`}
        >
          {step.content}
        </div>
      ))}
    </nav>
  );
}
```

## テスト戦略

### テスト構造
```
tests/
├── unit/                    # ユニットテスト
│   ├── components/         # コンポーネントテスト
│   ├── utils/             # ユーティリティテスト
│   └── hooks/             # フックテスト
│
├── integration/           # 統合テスト
│   ├── audio-processing/  # 音声処理テスト
│   └── api/              # API統合テスト
│
├── e2e/                  # E2Eテスト
│   ├── transcription/    # 文字起こしフロー
│   └── splitting/        # 分割フロー
│
└── fixtures/             # テストデータ
    ├── audio/           # テスト用音声ファイル
    └── responses/       # モックAPIレスポンス
```

### ユニットテスト例
```typescript
// components/FileUpload.test.tsx
import { render, fireEvent, waitFor } from '@testing-library/react';
import { FileUpload } from '../components/FileUpload';

describe('FileUpload', () => {
  it('should handle file drop correctly', async () => {
    const onFile = vi.fn();
    const { getByTestId } = render(<FileUpload onFile={onFile} />);
    
    const dropZone = getByTestId('drop-zone');
    const file = new File(['audio data'], 'test.mp3', { type: 'audio/mp3' });
    
    fireEvent.drop(dropZone, {
      dataTransfer: {
        files: [file],
        types: ['Files']
      }
    });
    
    await waitFor(() => {
      expect(onFile).toHaveBeenCalledWith(file);
    });
  });
  
  it('should reject invalid file types', async () => {
    const onFile = vi.fn();
    const { getByTestId, getByText } = render(<FileUpload onFile={onFile} />);
    
    const dropZone = getByTestId('drop-zone');
    const invalidFile = new File(['data'], 'test.txt', { type: 'text/plain' });
    
    fireEvent.drop(dropZone, {
      dataTransfer: {
        files: [invalidFile],
        types: ['Files']
      }
    });
    
    await waitFor(() => {
      expect(getByText(/対応していないファイル形式/)).toBeInTheDocument();
      expect(onFile).not.toHaveBeenCalled();
    });
  });
});

// utils/audioSplitter.test.ts
import { AudioSplitter } from '../utils/audioSplitter';

describe('AudioSplitter', () => {
  let splitter: AudioSplitter;
  
  beforeEach(() => {
    splitter = new AudioSplitter();
    
    // Mock AudioContext
    global.AudioContext = vi.fn(() => ({
      decodeAudioData: vi.fn(),
      close: vi.fn()
    }));
  });
  
  it('should split audio by size correctly', async () => {
    const mockFile = new File(['mock audio data'], 'test.wav');
    const mockAudioBuffer = {
      duration: 120, // 2 minutes
      sampleRate: 44100,
      numberOfChannels: 2,
      length: 44100 * 120,
      getChannelData: vi.fn(() => new Float32Array(44100 * 60)) // 1 minute
    };
    
    // Mock successful decoding
    AudioContext.prototype.decodeAudioData = vi.fn()
      .mockResolvedValue(mockAudioBuffer);
    
    const result = await splitter.splitBySize(mockFile, 50 * 1024 * 1024); // 50MB
    
    expect(result).toHaveLength(2); // Should split into 2 parts
    expect(result[0]).toBeInstanceOf(Blob);
  });
});
```

### E2Eテスト例
```typescript
// e2e/transcription-flow.spec.ts
import { test, expect } from '@playwright/test';

test.describe('Transcription Flow', () => {
  test('complete transcription workflow', async ({ page }) => {
    await page.goto('/');
    
    // Step 1: File Upload
    const fileInput = page.locator('input[type="file"]');
    await fileInput.setInputFiles('tests/fixtures/audio/sample.wav');
    
    await expect(page.locator('text=sample.wav')).toBeVisible();
    
    // Step 2: API Key Setup
    await page.fill('input[placeholder*="APIキー"]', 'test-api-key');
    
    // Step 3: Background Info
    await page.fill('textarea[placeholder*="背景情報"]', 
      'テスト用の会議録音です。参加者：テスト太郎、テスト花子');
    
    // Step 4: Start Transcription
    await page.click('button:has-text("文字起こし開始")');
    
    // Wait for processing
    await expect(page.locator('text=処理中')).toBeVisible();
    await expect(page.locator('text=文字起こし完了')).toBeVisible({ timeout: 30000 });
    
    // Step 5: Verify Results
    await expect(page.locator('[data-testid="transcription-result"]')).toContainText('テスト');
    
    // Step 6: Summary Generation
    await page.click('button:has-text("まとめ作成")');
    await expect(page.locator('text=まとめ結果')).toBeVisible({ timeout: 30000 });
    
    // Step 7: Download
    const downloadPromise = page.waitForDownload();
    await page.click('button:has-text("ダウンロード")');
    const download = await downloadPromise;
    
    expect(download.suggestedFilename()).toMatch(/summary\.(txt|md|html)$/);
  });
  
  test('error handling for invalid API key', async ({ page }) => {
    await page.goto('/');
    
    // Upload file
    const fileInput = page.locator('input[type="file"]');
    await fileInput.setInputFiles('tests/fixtures/audio/sample.wav');
    
    // Invalid API key
    await page.fill('input[placeholder*="APIキー"]', 'invalid-key');
    await page.click('button:has-text("文字起こし開始")');
    
    // Should show error
    await expect(page.locator('.error-message')).toContainText('APIキーが無効');
  });
});
```

### パフォーマンステスト
```typescript
// performance/audio-processing.bench.ts
import { bench, describe } from 'vitest';
import { AudioSplitter } from '../src/utils/audioSplitter';

describe('Audio Processing Performance', () => {
  const splitter = new AudioSplitter();
  
  // ベンチマーク用のモックファイル作成
  const createMockFile = (sizeMB: number) => {
    const sizeBytes = sizeMB * 1024 * 1024;
    const buffer = new ArrayBuffer(sizeBytes);
    return new File([buffer], `test-${sizeMB}mb.wav`, { type: 'audio/wav' });
  };
  
  bench('split 10MB file', async () => {
    const file = createMockFile(10);
    await splitter.splitBySize(file, 5 * 1024 * 1024); // 5MB chunks
  }, { iterations: 10 });
  
  bench('split 100MB file', async () => {
    const file = createMockFile(100);
    await splitter.splitBySize(file, 25 * 1024 * 1024); // 25MB chunks
  }, { iterations: 5 });
  
  bench('split 500MB file', async () => {
    const file = createMockFile(500);
    await splitter.splitBySize(file, 100 * 1024 * 1024); // 100MB chunks
  }, { iterations: 1 });
});

// Memory Usage Test
describe('Memory Usage', () => {
  test('should not leak memory after processing', async () => {
    const initialMemory = (performance as any).memory?.usedJSHeapSize || 0;
    
    // Process multiple files
    for (let i = 0; i < 5; i++) {
      const file = createMockFile(50);
      await splitter.splitBySize(file, 25 * 1024 * 1024);
      
      // Force garbage collection if available
      if (global.gc) {
        global.gc();
      }
    }
    
    const finalMemory = (performance as any).memory?.usedJSHeapSize || 0;
    const memoryIncrease = finalMemory - initialMemory;
    
    // Should not increase by more than 100MB
    expect(memoryIncrease).toBeLessThan(100 * 1024 * 1024);
  });
});
```

## デバッグ・監視

### ログシステム
```typescript
// utils/logger.ts
enum LogLevel {
  DEBUG = 0,
  INFO = 1,
  WARN = 2,
  ERROR = 3
}

class Logger {
  private static instance: Logger;
  private logLevel: LogLevel = import.meta.env.DEV ? LogLevel.DEBUG : LogLevel.WARN;
  private logs: Array<{ timestamp: Date; level: LogLevel; message: string; data?: any }> = [];
  
  static getInstance(): Logger {
    if (!Logger.instance) {
      Logger.instance = new Logger();
    }
    return Logger.instance;
  }
  
  private log(level: LogLevel, message: string, data?: any): void {
    if (level < this.logLevel) return;
    
    const timestamp = new Date();
    const logEntry = { timestamp, level, message, data };
    
    this.logs.push(logEntry);
    
    // Keep only last 1000 logs
    if (this.logs.length > 1000) {
      this.logs.splice(0, this.logs.length - 1000);
    }
    
    // Console output
    const levelNames = ['DEBUG', 'INFO', 'WARN', 'ERROR'];
    const levelColors = ['color: gray', 'color: blue', 'color: orange', 'color: red'];
    
    console.log(
      `%c[${levelNames[level]}] ${timestamp.toISOString()} - ${message}`,
      levelColors[level],
      data
    );
  }
  
  debug(message: string, data?: any): void {
    this.log(LogLevel.DEBUG, message, data);
  }
  
  info(message: string, data?: any): void {
    this.log(LogLevel.INFO, message, data);
  }
  
  warn(message: string, data?: any): void {
    this.log(LogLevel.WARN, message, data);
  }
  
  error(message: string, data?: any): void {
    this.log(LogLevel.ERROR, message, data);
  }
  
  // Export logs for debugging
  exportLogs(): string {
    return JSON.stringify(this.logs, null, 2);
  }
  
  // Clear logs
  clearLogs(): void {
    this.logs = [];
  }
}

export const logger = Logger.getInstance();
```

### パフォーマンスモニタリング
```typescript
// utils/performance.ts
class PerformanceMonitor {
  private metrics: Map<string, number[]> = new Map();
  private activeTimers: Map<string, number> = new Map();
  
  startTimer(name: string): void {
    this.activeTimers.set(name, performance.now());
    logger.debug(`Started timer: ${name}`);
  }
  
  endTimer(name: string): number {
    const startTime = this.activeTimers.get(name);
    if (!startTime) {
      logger.warn(`Timer not found: ${name}`);
      return 0;
    }
    
    const duration = performance.now() - startTime;
    this.activeTimers.delete(name);
    
    // Store metric
    if (!this.metrics.has(name)) {
      this.metrics.set(name, []);
    }
    this.metrics.get(name)!.push(duration);
    
    logger.info(`${name} completed in ${duration.toFixed(2)}ms`);
    return duration;
  }
  
  measure<T>(name: string, fn: () => Promise<T>): Promise<T>;
  measure<T>(name: string, fn: () => T): T;
  measure<T>(name: string, fn: () => T | Promise<T>): T | Promise<T> {
    this.startTimer(name);
    
    try {
      const result = fn();
      
      if (result instanceof Promise) {
        return result.finally(() => {
          this.endTimer(name);
        });
      } else {
        this.endTimer(name);
        return result;
      }
    } catch (error) {
      this.endTimer(name);
      throw error;
    }
  }
  
  getMetrics(name: string): { count: number; avg: number; min: number; max: number } | null {
    const measurements = this.metrics.get(name);
    if (!measurements || measurements.length === 0) return null;
    
    const count = measurements.length;
    const sum = measurements.reduce((a, b) => a + b, 0);
    const avg = sum / count;
    const min = Math.min(...measurements);
    const max = Math.max(...measurements);
    
    return { count, avg, min, max };
  }
  
  getAllMetrics(): Record<string, ReturnType<typeof this.getMetrics>> {
    const result: Record<string, ReturnType<typeof this.getMetrics>> = {};
    for (const [name] of this.metrics) {
      result[name] = this.getMetrics(name);
    }
    return result;
  }
  
  // Memory monitoring
  getMemoryInfo(): {
    usedJSHeapSize?: number;
    totalJSHeapSize?: number;
    jsHeapSizeLimit?: number;
  } {
    const memory = (performance as any).memory;
    return {
      usedJSHeapSize: memory?.usedJSHeapSize,
      totalJSHeapSize: memory?.totalJSHeapSize,
      jsHeapSizeLimit: memory?.jsHeapSizeLimit
    };
  }
}

export const perfMonitor = new PerformanceMonitor();

// Usage examples
export const withPerformanceMonitoring = <T extends (...args: any[]) => any>(
  name: string,
  fn: T
): T => {
  return ((...args: any[]) => {
    return perfMonitor.measure(name, () => fn(...args));
  }) as T;
};
```

### エラートラッキング
```typescript
// utils/errorTracking.ts
interface ErrorInfo {
  message: string;
  stack?: string;
  timestamp: Date;
  userAgent: string;
  url: string;
  componentStack?: string;
  userId?: string;
}

class ErrorTracker {
  private errors: ErrorInfo[] = [];
  private maxErrors = 50;
  
  captureError(error: Error, componentStack?: string): void {
    const errorInfo: ErrorInfo = {
      message: error.message,
      stack: error.stack,
      timestamp: new Date(),
      userAgent: navigator.userAgent,
      url: window.location.href,
      componentStack,
      userId: this.getUserId()
    };
    
    this.errors.push(errorInfo);
    
    // Keep only recent errors
    if (this.errors.length > this.maxErrors) {
      this.errors.splice(0, this.errors.length - this.maxErrors);
    }
    
    logger.error('Error captured', errorInfo);
    
    // Send to analytics (if configured)
    this.sendToAnalytics(errorInfo);
  }
  
  private getUserId(): string | undefined {
    // Generate or retrieve user ID for debugging
    let userId = localStorage.getItem('debug_user_id');
    if (!userId) {
      userId = 'user_' + Math.random().toString(36).substr(2, 9);
      localStorage.setItem('debug_user_id', userId);
    }
    return userId;
  }
  
  private sendToAnalytics(errorInfo: ErrorInfo): void {
    // In production, send to error tracking service
    if (import.meta.env.PROD && import.meta.env.VITE_SENTRY_DSN) {
      // Send to Sentry, LogRocket, etc.
      console.log('Would send to analytics:', errorInfo);
    }
  }
  
  getErrors(): ErrorInfo[] {
    return [...this.errors];
  }
  
  clearErrors(): void {
    this.errors = [];
  }
  
  exportErrors(): string {
    return JSON.stringify(this.errors, null, 2);
  }
}

export const errorTracker = new ErrorTracker();

// React Error Boundary
export class ErrorBoundary extends React.Component<
  { children: React.ReactNode },
  { hasError: boolean }
> {
  constructor(props: { children: React.ReactNode }) {
    super(props);
    this.state = { hasError: false };
  }
  
  static getDerivedStateFromError(error: Error): { hasError: boolean } {
    return { hasError: true };
  }
  
  componentDidCatch(error: Error, errorInfo: React.ErrorInfo): void {
    errorTracker.captureError(error, errorInfo.componentStack);
  }
  
  render() {
    if (this.state.hasError) {
      return (
        <div className="error-boundary">
          <h2>申し訳ありません。エラーが発生しました。</h2>
          <p>ページをリロードしてもう一度お試しください。</p>
          <button onClick={() => window.location.reload()}>
            リロード
          </button>
        </div>
      );
    }
    
    return this.props.children;
  }
}
```

### デバッグ用開発ツール
```typescript
// utils/devTools.ts
interface DevTools {
  logger: Logger;
  perfMonitor: PerformanceMonitor;
  errorTracker: ErrorTracker;
  exportDiagnostics(): string;
  clearAll(): void;
}

class DevToolsImpl implements DevTools {
  logger = logger;
  perfMonitor = perfMonitor;
  errorTracker = errorTracker;
  
  exportDiagnostics(): string {
    const diagnostics = {
      timestamp: new Date().toISOString(),
      userAgent: navigator.userAgent,
      url: window.location.href,
      memory: this.perfMonitor.getMemoryInfo(),
      performance: this.perfMonitor.getAllMetrics(),
      logs: this.logger.exportLogs(),
      errors: this.errorTracker.getErrors()
    };
    
    return JSON.stringify(diagnostics, null, 2);
  }
  
  clearAll(): void {
    this.logger.clearLogs();
    this.errorTracker.clearErrors();
    console.clear();
  }
}

// Global dev tools (only in development)
if (import.meta.env.DEV) {
  (window as any).__DEV_TOOLS__ = new DevToolsImpl();
  
  console.log('🔧 Development tools available at window.__DEV_TOOLS__');
  console.log('Available methods:');
  console.log('- __DEV_TOOLS__.exportDiagnostics()');
  console.log('- __DEV_TOOLS__.clearAll()');
  console.log('- __DEV_TOOLS__.logger');
  console.log('- __DEV_TOOLS__.perfMonitor');
  console.log('- __DEV_TOOLS__.errorTracker');
}
```

## パフォーマンス最適化

### React最適化
```typescript
// hooks/useOptimizedCallback.ts
import { useCallback, useRef } from 'react';

// 安定したコールバック参照を保持
export function useStableCallback<T extends (...args: any[]) => any>(fn: T): T {
  const ref = useRef<T>(fn);
  
  // 最新の関数参照を常に保持
  ref.current = fn;
  
  // 安定した参照を返す
  return useCallback((...args: any[]) => ref.current(...args), []) as T;
}

// メモ化された値を条件付きで更新
export function useConditionalMemo<T>(
  factory: () => T,
  deps: React.DependencyList,
  condition: boolean
): T {
  const memoizedValue = useMemo(factory, deps);
  const previousValue = useRef<T>();
  
  if (condition) {
    previousValue.current = memoizedValue;
  }
  
  return previousValue.current ?? memoizedValue;
}
```

### メモリ最適化
```typescript
// utils/memoryManager.ts
class MemoryManager {
  private objectUrls: Set<string> = new Set();
  private audioContexts: Set<AudioContext> = new Set();
  private timers: Set<number> = new Set();
  
  // Object URL管理
  createObjectURL(object: Blob | MediaSource): string {
    const url = URL.createObjectURL(object);
    this.objectUrls.add(url);
    return url;
  }
  
  revokeObjectURL(url: string): void {
    URL.revokeObjectURL(url);
    this.objectUrls.delete(url);
  }
  
  // AudioContext管理
  registerAudioContext(ctx: AudioContext): AudioContext {
    this.audioContexts.add(ctx);
    return ctx;
  }
  
  // Timer管理
  setTimeout(handler: () => void, timeout: number): number {
    const id = window.setTimeout(() => {
      handler();
      this.timers.delete(id);
    }, timeout);
    this.timers.add(id);
    return id;
  }
  
  setInterval(handler: () => void, interval: number): number {
    const id = window.setInterval(handler, interval);
    this.timers.add(id);
    return id;
  }
  
  clearTimeout(id: number): void {
    window.clearTimeout(id);
    this.timers.delete(id);
  }
  
  clearInterval(id: number): void {
    window.clearInterval(id);
    this.timers.delete(id);
  }
  
  // 全リソース解放
  cleanup(): void {
    // Object URLs
    this.objectUrls.forEach(url => URL.revokeObjectURL(url));
    this.objectUrls.clear();
    
    // Audio Contexts
    this.audioContexts.forEach(ctx => ctx.close());
    this.audioContexts.clear();
    
    // Timers
    this.timers.forEach(id => {
      window.clearTimeout(id);
      window.clearInterval(id);
    });
    this.timers.clear();
    
    // Force garbage collection if available
    if ((window as any).gc) {
      (window as any).gc();
    }
    
    logger.info('Memory cleanup completed');
  }
  
  // メモリ使用量チェック
  checkMemoryUsage(): void {
    const memory = (performance as any).memory;
    if (memory) {
      const used = memory.usedJSHeapSize / 1024 / 1024;
      const limit = memory.jsHeapSizeLimit / 1024 / 1024;
      const percentage = (used / limit) * 100;
      
      logger.info(`Memory usage: ${used.toFixed(2)}MB / ${limit.toFixed(2)}MB (${percentage.toFixed(1)}%)`);
      
      if (percentage > 80) {
        logger.warn('High memory usage detected');
        this.cleanup();
      }
    }
  }
}

export const memoryManager = new MemoryManager();

// React Hook for automatic cleanup
export function useMemoryManager(): MemoryManager {
  const managerRef = useRef(new MemoryManager());
  
  useEffect(() => {
    const manager = managerRef.current;
    
    return () => {
      manager.cleanup();
    };
  }, []);
  
  return managerRef.current;
}
```

### 非同期処理最適化
```typescript
// utils/asyncOptimizations.ts

// 非同期処理のキューイング
class AsyncQueue {
  private queue: Array<() => Promise<void>> = [];
  private processing = false;
  private concurrency = 1;
  
  constructor(concurrency = 1) {
    this.concurrency = concurrency;
  }
  
  async add<T>(task: () => Promise<T>): Promise<T> {
    return new Promise((resolve, reject) => {
      this.queue.push(async () => {
        try {
          const result = await task();
          resolve(result);
        } catch (error) {
          reject(error);
        }
      });
      
      this.process();
    });
  }
  
  private async process(): Promise<void> {
    if (this.processing) return;
    
    this.processing = true;
    
    const activeTasks: Promise<void>[] = [];
    
    while (this.queue.length > 0 || activeTasks.length > 0) {
      // Start new tasks up to concurrency limit
      while (activeTasks.length < this.concurrency && this.queue.length > 0) {
        const task = this.queue.shift()!;
        const taskPromise = task().finally(() => {
          const index = activeTasks.indexOf(taskPromise);
          if (index > -1) {
            activeTasks.splice(index, 1);
          }
        });
        activeTasks.push(taskPromise);
      }
      
      // Wait for at least one task to complete
      if (activeTasks.length > 0) {
        await Promise.race(activeTasks);
      }
    }
    
    this.processing = false;
  }
}

// リトライ機能付き非同期関数
export async function withRetry<T>(
  fn: () => Promise<T>,
  options: {
    retries?: number;
    delay?: number;
    backoff?: boolean;
    onRetry?: (attempt: number, error: Error) => void;
  } = {}
): Promise<T> {
  const {
    retries = 3,
    delay = 1000,
    backoff = true,
    onRetry
  } = options;
  
  for (let attempt = 1; attempt <= retries + 1; attempt++) {
    try {
      return await fn();
    } catch (error) {
      if (attempt === retries + 1) {
        throw error;
      }
      
      onRetry?.(attempt, error as Error);
      
      const waitTime = backoff ? delay * Math.pow(2, attempt - 1) : delay;
      await new Promise(resolve => setTimeout(resolve, waitTime));
    }
  }
  
  throw new Error('Unreachable');
}

// タイムアウト付き非同期関数
export function withTimeout<T>(
  promise: Promise<T>,
  timeoutMs: number,
  timeoutMessage = 'Operation timed out'
): Promise<T> {
  const timeoutPromise = new Promise<never>((_, reject) => {
    setTimeout(() => reject(new Error(timeoutMessage)), timeoutMs);
  });
  
  return Promise.race([promise, timeoutPromise]);
}
```

## デプロイメント

### ビルド設定
```typescript
// vite.config.ts
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { resolve } from 'path';

export default defineConfig({
  plugins: [react()],
  
  // Build optimization
  build: {
    target: 'es2020',
    minify: 'esbuild',
    sourcemap: true,
    rollupOptions: {
      output: {
        manualChunks: {
          // Vendor chunks
          'react': ['react', 'react-dom'],
          'audio': ['@ffmpeg/ffmpeg', '@ffmpeg/util'],
          'ai': ['@google/generative-ai'],
          'ui': ['lucide-react']
        }
      }
    },
    
    // Asset optimization
    assetsInlineLimit: 4096,
    cssCodeSplit: true,
    
    // Chunk size warnings
    chunkSizeWarningLimit: 1000
  },
  
  // Development
  server: {
    port: 5173,
    open: true,
    headers: {
      // WASM support
      'Cross-Origin-Embedder-Policy': 'require-corp',
      'Cross-Origin-Opener-Policy': 'same-origin'
    }
  },
  
  // Path resolution
  resolve: {
    alias: {
      '@': resolve(__dirname, 'src')
    }
  },
  
  // Environment variables
  define: {
    __APP_VERSION__: JSON.stringify(process.env.npm_package_version)
  },
  
  // Optimization
  optimizeDeps: {
    include: ['react', 'react-dom', 'lucide-react'],
    exclude: ['@ffmpeg/ffmpeg', '@ffmpeg/util']
  }
});
```

### GitHub Actions CI/CD
```yaml
# .github/workflows/deploy.yml
name: Build and Deploy

on:
  push:
    branches: [ main ]
  pull_request:
    branches: [ main ]

jobs:
  test:
    runs-on: ubuntu-latest
    
    steps:
    - uses: actions/checkout@v4
    
    - name: Setup Node.js
      uses: actions/setup-node@v4
      with:
        node-version: '18'
        cache: 'npm'
    
    - name: Install dependencies
      run: npm ci
    
    - name: Run type check
      run: npm run type-check
    
    - name: Run tests
      run: npm run test
    
    - name: Run linting
      run: npm run lint
  
  build:
    runs-on: ubuntu-latest
    needs: test
    if: github.ref == 'refs/heads/main'
    
    steps:
    - uses: actions/checkout@v4
    
    - name: Setup Node.js
      uses: actions/setup-node@v4
      with:
        node-version: '18'
        cache: 'npm'
    
    - name: Install dependencies
      run: npm ci
    
    - name: Build
      run: npm run build
      env:
        VITE_APP_VERSION: ${{ github.sha }}
    
    - name: Upload build artifacts
      uses: actions/upload-pages-artifact@v2
      with:
        path: ./dist
  
  deploy:
    needs: build
    runs-on: ubuntu-latest
    if: github.ref == 'refs/heads/main'
    
    permissions:
      pages: write
      id-token: write
    
    environment:
      name: github-pages
      url: ${{ steps.deployment.outputs.page_url }}
    
    steps:
    - name: Deploy to GitHub Pages
      id: deployment
      uses: actions/deploy-pages@v2
```

### 本番環境設定
```bash
# Build script
#!/bin/bash
set -e

echo "🚀 Starting production build..."

# Clean previous builds
rm -rf dist/

# Install dependencies
echo "📦 Installing dependencies..."
npm ci --production=false

# Run tests
echo "🧪 Running tests..."
npm run test

# Type check
echo "🔍 Type checking..."
npm run type-check

# Linting
echo "✨ Linting..."
npm run lint

# Build
echo "🏗️ Building..."
npm run build

# Analyze bundle
echo "📊 Analyzing bundle..."
npm run build:analyze

# Compress assets
echo "🗜️ Compressing assets..."
find dist -name "*.js" -exec gzip -k {} \;
find dist -name "*.css" -exec gzip -k {} \;
find dist -name "*.html" -exec gzip -k {} \;

echo "✅ Build completed successfully!"
echo "📁 Output directory: ./dist"
echo "📊 Bundle size:"
du -sh dist/
```

## コントリビューション

### Pull Request プロセス
1. **Issue作成**: 機能要求・バグ報告のIssue作成
2. **ブランチ作成**: `feature/feature-name` または `fix/bug-name`
3. **開発**: コード変更・テスト追加
4. **品質チェック**: lint、type-check、test実行
5. **Pull Request**: 詳細な説明とスクリーンショット付き
6. **レビュー**: コードレビュー・承認
7. **マージ**: Squash and mergeで統合

### コミット規約
```
type(scope): description

[optional body]

[optional footer]
```

#### Types:
- `feat`: 新機能
- `fix`: バグ修正
- `docs`: ドキュメント
- `style`: フォーマット
- `refactor`: リファクタリング
- `test`: テスト
- `chore`: メンテナンス

#### Examples:
```bash
git commit -m "feat(transcription): add background info support"
git commit -m "fix(audio): resolve memory leak in Web Audio API"
git commit -m "docs(readme): update installation instructions"
```

### 開発規約
- **TypeScript**: 厳格な型付け必須
- **React**: 関数コンポーネント + Hooks
- **CSS**: Tailwind CSS ユーティリティクラス
- **Testing**: 新機能は必ずテスト追加
- **Performance**: メモリリーク・パフォーマンス影響を考慮
- **Accessibility**: WCAG 2.1 AA準拠

---

このドキュメントは継続的に更新されます。質問や改善提案があれば、Issueまたは Pull Requestでお知らせください。