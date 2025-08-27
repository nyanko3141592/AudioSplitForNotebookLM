# 爆速議事録 ⚡

## 概要
オンラインミーティングを簡単録音、AI文字起こし、議事録作成まで3ステップで完了。完全にプライベートで動作し、あなたのGemini APIのみで安全にデータ処理します。

**主な機能**：
- **🎙️ オンラインミーティング録音**: マイク＋システム音声を同時録音（Zoom・Teams・Google Meet対応）
- **📝 AI文字起こし＆議事録**: Gemini APIで高精度な文字起こしと要約を自動生成  
- **🔒 プライベート処理**: 音声データは外部送信なし、あなたのAPIキーのみで処理
- **⚡ 3ステップ完了**: 録音→文字起こし→議事録まで最短ルート
- **🧭 スマートナビゲーション**: ヘッダー内蔵の進捗インジケーターで直感的な操作

**ライブデモ**: [https://nyanko3141592.github.io/AudioSplitForNotebookLM/](https://nyanko3141592.github.io/AudioSplitForNotebookLM/)

## 主な機能

### ✨ 最新の特徴

#### 🧭 スマートナビゲーション機能
- **ヘッダー内蔵ナビゲーション**: スクロール時にヘッダーに表示される進捗インジケーター
- **現在位置自動検出**: スクロール位置に基づく現在ステップの自動ハイライト
- **ワンクリックジャンプ**: 任意のステップにスムーズスクロールで移動
- **ステップ状態表示**: 利用可能・ロック状態の視覚的な表示
- **モバイル対応**: レスポンシブデザインで小画面でも操作しやすい

#### 🎨 モダンUI/UX
- **フロー可視化**: ステップ間のアニメーション矢印で処理の流れを明確化
- **入力・出力セクション**: 各ステップで設定部分と結果部分を明確に分離
- **再生成ボタン**: 各ステップ間に統一された再実行ボタンを配置
- **リアルタイムコスト表示**: API使用予想コストをリアルタイム表示
- **ガラスモーフィズム**: 半透明・ブラー効果による洗練されたデザイン

#### 🎙️ 録音機能（新機能）
**オンラインミーティング録音フロー**：
1. マイクを有効化（デバイス選択可能）
2. システム音声を選択（Zoom・Teams・Google Meetなど）
3. リアルタイム音声レベルで入力確認
4. 録音開始・停止をワンクリック
5. **録音中インジケーター**: ファビコン・タイトル変更で録音状態を明示

**特徴**:
- **デュアル音声録音**: マイク＋システム音声を同時録音
- **デバイス選択**: 複数マイクから選択可能
- **音声レベル表示**: 録音前から入力レベルを確認
- **自動ストリーム管理**: 録音終了時に自動でストリーム停止
- **視覚的フィードバック**: 録音状態がファビコンとページタイトルに反映

### 📝 高機能文字起こし・議事録作成

#### 🤖 AI処理フロー
1. 録音ファイルまたはアップロードファイル
2. **自動分割**: 200MB以上の場合は自動分割（NotebookLM対応サイズ）
3. **バックグラウンド処理**: 進捗表示付きの並列処理
4. **高精度文字起こし**: Gemini APIによる音声認識
5. **カスタマイズ可能要約**: 複数形式での自動要約生成

#### 📊 インテリジェント処理
**背景情報活用**:
- 会議情報、参加者名、議題を入力することで認識精度を大幅向上
- 文字起こしと要約の両方で背景情報を活用
- セッション間での情報継承

**処理最適化**:
- **並列処理**: 複数ファイルの同時処理でスピード向上
- **進捗可視化**: リアルタイムでファイル毎の処理状況を表示
- **エラー処理**: 部分的な失敗でも成功したファイルの結果を保持
- **メモリ管理**: 大容量ファイル処理後も安定動作

#### 📋 多様な出力形式
**要約プリセット**:
- **議事録形式**: 決定事項・Next Action・議論内容を構造化
- **要約形式**: 主要ポイントを3-5点に整理
- **インタビュー形式**: Q&A構造での内容整理
- **講義ノート形式**: トピック別の学習ポイント整理

**カスタマイズ**:
- **カスタムプロンプト**: 独自の要求に応じた要約形式
- **Markdown対応**: 見出し・リスト・強調を含む構造化テキスト
- **HTML出力**: リッチフォーマットでのダウンロード・コピー
- **プレーンテキスト**: シンプルな文字ベース出力

### 🔧 音声分割機能（従来機能強化）

#### 分割フロー
1. **ドラッグ&ドロップ対応**: 直感的なファイルアップロード
2. **自動サイズ判定**: 200MB以上で自動分割モード提案
3. **分割設定**: 最大サイズ or 分割数指定
4. **リアルタイム処理**: 進捗表示付きの分割実行
5. **統合ダウンロード**: 個別・ZIP一括両対応

#### 分割オプション詳細
**最大サイズ指定モード**:
- デフォルト: 190MB（NotebookLM推奨サイズ）
- カスタマイズ可能範囲: 50MB〜500MB
- **自動最適化**: 音声長に基づく最適分割ポイント計算

**分割数指定モード**:
- 範囲: 2〜100個の均等分割
- **時間均等**: 音声の時間軸で正確に分割
- **品質保持**: サンプルレベルでの分割により音質劣化なし

### 📤 出力・ダウンロード機能

#### 音声ファイル出力
- **高品質WAV**: 8-bit PCM WAV形式（元ファイルより軽量化される場合あり）
- **命名規則**: `original_name_part1.wav`, `original_name_part2.wav`...
- **バッチダウンロード**: ZIP形式での一括ダウンロード
- **個別選択**: 必要なファイルのみ選択ダウンロード

#### テキスト出力
- **リッチコピー**: HTML形式でのクリップボード対応
- **複数形式**: プレーンテキスト・Markdown・HTML
- **文字数表示**: リアルタイムでの文字・行数カウント
- **プレビュー機能**: ダウンロード前の内容確認

## 🧠 技術仕様

### アーキテクチャ

#### フロントエンド
- **React 19 + TypeScript**: 最新のタイプセーフフレームワーク
- **Vite**: 高速ビルド・開発サーバー
- **TailwindCSS v4**: ユーティリティファーストCSS、カスタムアニメーション
- **Lucide React**: 一貫性のあるアイコンライブラリ

#### 処理エンジン
- **完全クライアントサイド**: サーバー通信なしの安全な処理
- **Web Audio API**: ブラウザネイティブの高速音声処理
- **FFmpeg.wasm**: フォールバック用の高互換性処理
- **Web Workers**: バックグラウンドでのCPU集約処理

#### ストレージ・状態管理
- **LocalStorage**: 設定・APIキーの永続化
- **Session管理**: ページリロード対応の一時状態保持
- **メモリ最適化**: 自動ガベージコレクション・メモリリーク防止

### 音声処理詳細

#### Web Audio API（推奨エンジン）
```
音声ファイル → ArrayBuffer → AudioBuffer → 
サンプルレベル分割 → PCM変換 → WAV出力
```

**特徴**:
- **ゼロ遅延**: ブラウザネイティブ処理による高速動作
- **サンプル精度**: 音声データの重複・欠落なし
- **メモリ効率**: ストリーミング処理による低メモリ使用量

#### FFmpeg.wasm（フォールバック）
```
音声ファイル → WASM処理 → フォーマット変換 → 分割 → 出力
```

**特徴**:
- **高互換性**: より多くの音声形式をサポート
- **柔軟性**: 複雑な音声処理に対応
- **安定性**: Web Audio API非対応環境での確実な動作

### AI統合

#### Google Gemini API連携
- **直接通信**: 中間サーバーを介さない安全な通信
- **並列処理**: 複数ファイルの同時処理によるスピード向上
- **エラー処理**: 部分失敗時の継続処理
- **コスト最適化**: リアルタイムコスト計算・表示

#### 対応モデル
- **Gemini 2.0 Flash-Lite**: 高速・低コスト（推奨）
- **Gemini 2.5 Flash**: 高性能・バランス
- **Gemini 2.5 Pro**: 最高性能・高精度

## 🚀 詳細な使い方

### 📝 議事録作成フロー（推奨）

#### ステップ1: 初期設定
1. **APIキー設定**: 
   - [Google AI Studio](https://aistudio.google.com/app/apikey)でGemini APIキーを取得
   - アプリの設定フィールドに入力
   - 自動的にローカルストレージに安全保存

2. **ファイル準備**:
   - **録音方式**: マイク+システム音声の同時録音
   - **アップロード方式**: 既存音声ファイルのドラッグ&ドロップ

#### ステップ2: 音声入力

**録音モード**:
1. **マイク設定**: デバイス一覧から適切なマイクを選択
2. **システム音声**: ブラウザタブの音声共有を有効化
3. **レベル確認**: リアルタイム音声レベルで入力状態確認
4. **録音実行**: ワンクリックで録音開始・停止
5. **視覚確認**: ファビコン・タイトル変更で録音状態確認

**アップロードモード**:
1. **対応形式**: WebM, MP3, WAV, M4A, OGG, MP4
2. **サイズ制限**: 2GB以下（ブラウザ依存）
3. **自動判定**: 200MB以上で分割処理提案

#### ステップ3: 文字起こし処理

**基本設定**:
- **モデル選択**: コスト・精度バランスに応じて選択
- **背景情報**: 会議詳細入力で精度大幅向上
  ```
  例: 2024年1月26日の定例会議
  参加者：田中、佐藤、鈴木
  議題：新商品の戦略
  ```

**処理実行**:
1. **予想コスト確認**: リアルタイムでのAPI利用コスト表示
2. **並列処理**: 複数ファイルの同時文字起こし
3. **進捗監視**: ファイル毎の詳細進捗表示
4. **部分結果**: 一部失敗でも成功分の結果は保持

#### ステップ4: 要約・議事録生成

**形式選択**:
- **プリセット使用**: 4種類の定型フォーマットから選択
- **カスタマイズ**: 独自プロンプトでの要求仕様

**生成プロセス**:
1. **背景情報統合**: 文字起こし時の情報を要約にも活用
2. **形式指定**: Markdown・プレーンテキスト選択
3. **実時間生成**: 進捗表示付きのAI要約処理
4. **複数出力**: コピー・テキスト・HTML形式対応

#### ステップ5: 結果活用

**ダウンロード**:
- **音声ファイル**: 分割済みWAV、個別・ZIP一括
- **文字起こし**: プレーンテキストファイル
- **要約結果**: Markdown・HTML・プレーンテキスト

**コピー機能**:
- **リッチテキスト**: HTML形式でのフォーマット保持
- **プレーンテキスト**: フォールバック対応

### 🔧 音声分割専用フロー

#### 基本分割フロー
1. **ファイルアップロード**: ドラッグ&ドロップまたはファイル選択
2. **分割方式選択**:
   - **最大サイズ指定**: 190MB推奨（NotebookLM対応）
   - **分割数指定**: 2〜100個の均等分割
3. **処理実行**: リアルタイム進捗表示
4. **結果確認**: ファイル一覧・サイズ確認
5. **ダウンロード**: 個別選択またはZIP一括

#### 高度な分割設定
**最大サイズモード詳細**:
- 範囲: 50MB〜500MB
- 推奨値: 190MB（NotebookLM最適）
- 自動最適化: 音声長に基づく分割ポイント計算

**分割数モード詳細**:
- 均等時間分割: 音声の時間軸での正確な分割
- 品質保持: サンプルレベル分割による音質維持
- バランス調整: 各ファイルのサイズ均等化

## 🔐 セキュリティ・プライバシー

### 🛡️ データ保護体制

#### 音声ファイル処理
- **完全ローカル処理**: 音声データは一切サーバー送信なし
- **メモリ即座削除**: 処理完了と同時に自動メモリクリア
- **ブラウザ内完結**: すべての処理がクライアントサイドで実行
- **一時データなし**: 中間ファイルの生成・保存なし

#### AI機能データフロー
```
あなたのブラウザ → [暗号化通信] → Gemini API → 結果返却 → 即座削除
```

**保護機能**:
- **直接API通信**: 中間サーバー経由なし
- **暗号化通信**: HTTPS/TLSによる通信保護
- **APIキー保護**: ローカルストレージでの暗号化保存
- **一時的処理**: API処理後の音声データ即座削除

#### 透明性・監査可能性
- **オープンソース**: 全ソースコードの公開
- **ログ出力**: ブラウザコンソールでの処理状況確認
- **ネットワーク監視**: DevToolsでの通信内容確認可能
- **データ流れ**: 処理フローの完全な可視化

### 🔑 APIキー管理

#### 保存方式
- **ローカルストレージ**: ブラウザ固有の安全な保存領域
- **暗号化**: ブラウザレベルでの暗号化保護
- **共有なし**: 他サイト・アプリからのアクセス不可
- **削除可能**: ユーザー制御による削除・変更

#### 使用方式
- **直接通信**: アプリサーバー経由なしの直接API呼び出し
- **一時保持**: 処理中のメモリ保持のみ
- **ログなし**: APIキーのログ出力・保存なし

## ⚙️ 動作環境・要件

### 推奨ブラウザ・バージョン
- **Chrome 89以降** ⭐ 推奨
- **Firefox 89以降**
- **Safari 15.4以降**
- **Edge 89以降**

### システム要件
- **メモリ**: 4GB以上推奨（8GB以上で最適）
- **ストレージ**: 一時的に処理ファイルサイズの2倍の空き容量
- **ネットワーク**: AI機能使用時のみインターネット接続必要

### 最大処理能力
- **ファイルサイズ**: 約2GB（ブラウザ・メモリ依存）
- **分割数**: 最大100個まで
- **並列処理**: CPU・メモリに応じて自動調整

## 🐛 既知の問題・制限事項

### 技術制限
- **モバイル制限**: スマートフォンでは大容量ファイル処理困難
- **メモリ制限**: 1GB以上のファイルは高メモリ環境必要
- **出力形式**: WAV形式のみ（元形式に関わらず）
- **ブラウザ依存**: 一部機能が特定ブラウザで制限

### API制限
- **Gemini API制限**: 
  - 無料枠: 15 requests/minute、60 requests/day
  - 有料プラン: より高い制限値
- **ファイルサイズ**: 単一ファイル20MB以下（API制限）
- **処理時間**: 長時間音声でタイムアウトの可能性

### パフォーマンス
- **処理時間**: 1GB以上で数分〜十数分
- **メモリ使用**: 処理中は元ファイルサイズの3-5倍のメモリ使用
- **CPU使用率**: 処理中は高CPU使用率

## 🔧 トラブルシューティング

### よくある問題と解決法

#### Q: 分割後のファイルサイズが大きい
**A**: WAVフォーマット特性
- 8-bit PCM WAV形式での出力のため、MP3等より大きくなる場合あり
- 品質を維持するための仕様
- 必要に応じて別ツールでの再圧縮を推奨

#### Q: 処理速度が遅い
**A**: 処理エンジン確認
```javascript
// ブラウザコンソールで確認
console.log('Web Audio API対応:', typeof AudioContext !== 'undefined');
console.log('メモリ使用量:', performance.memory?.usedJSHeapSize);
```

**対策**:
- 他タブ・アプリを閉じてメモリ確保
- ブラウザ再起動
- ファイルサイズ削減

#### Q: エラーが頻発する
**A**: 環境確認チェックリスト
```
✅ ブラウザバージョンが要件を満たしている
✅ 十分なメモリが確保されている  
✅ ファイルが破損していない
✅ APIキーが正しく設定されている
✅ ネットワーク接続が安定している
```

#### Q: 録音ができない
**A**: 権限・設定確認
- ブラウザのマイク権限を許可
- システム音声共有を許可
- デバイスが正しく認識されているか確認
- 他アプリでデバイスが使用されていないか確認

#### Q: 文字起こし精度が低い
**A**: 精度向上のテクニック
- **背景情報入力**: 会議詳細・参加者名・議題を詳細入力
- **音声品質**: できるだけクリアな音声を使用
- **モデル選択**: 高精度モデル（Gemini 2.5 Pro）を選択
- **分割最適化**: 長時間音声は適切に分割

## 👨‍💻 開発者向け情報

### 🏗️ 開発環境構築

#### 基本セットアップ
```bash
# リポジトリクローン
git clone https://github.com/nyanko3141592/AudioSplitForNotebookLM.git
cd AudioSplitForNotebookLM

# 依存関係インストール
npm install

# 開発サーバー起動
npm run dev
# → http://localhost:5173 で起動

# ビルド実行
npm run build

# ビルド結果プレビュー
npm run preview

# 型チェック
npm run type-check

# リンター実行
npm run lint
```

#### 開発ツール・設定
```bash
# 推奨VSCode拡張
# - TypeScript
# - Tailwind CSS IntelliSense
# - ES7+ React/Redux/React-Native snippets
# - Prettier
```

### 📁 詳細なプロジェクト構造

```
src/
├── pages/                          # ページコンポーネント
│   ├── TranscribePage.tsx         # 🎙️ 文字起こし統合ページ
│   └── SplitPage.tsx              # ✂️ 音声分割専用ページ
│
├── components/                     # UIコンポーネント群
│   ├── HeroSection.tsx            # 🎨 ヒーローセクション（ナビゲーション統合）
│   ├── RecordingPanel.tsx         # 🎙️ 録音コントロールパネル
│   ├── FileUpload.tsx             # 📁 ファイルアップロード
│   │
│   ├── steps/                     # ワークフローステップ
│   │   ├── TranscriptionStep.tsx  # 📝 文字起こし処理
│   │   └── SummaryStep.tsx        # 📋 要約生成
│   │
│   ├── ProgressBar.tsx            # 📊 進捗表示
│   ├── SplitOptions.tsx           # ⚙️ 分割設定
│   └── DownloadList.tsx           # 💾 ダウンロードリスト
│
├── hooks/                         # カスタムフック
│   └── useFFmpeg.ts              # 🔧 FFmpeg.wasm統合
│
├── utils/                         # ユーティリティライブラリ
│   ├── audioSplitter.ts          # 🎵 Web Audio API分割エンジン
│   ├── geminiTranscriber.ts      # 🤖 Gemini API統合
│   ├── recordingIndicator.ts     # 🔴 録音状態インジケーター
│   ├── storage.ts                # 💾 ローカルストレージ管理
│   ├── format.ts                 # 📄 テキストフォーマット処理
│   └── download.ts               # ⬇️ ダウンロード処理
│
├── App.tsx                        # 🌐 メインアプリケーション
└── main.tsx                       # 🚀 エントリーポイント
```

### 🏛️ アーキテクチャ詳細

#### コンポーネント設計パターン

**ページレベル構成**:
```typescript
// 責任分離パターン
App.tsx              → ルーティング・グローバル状態
├── TranscribePage   → 文字起こしワークフロー管理
│   ├── HeroSection  → ナビゲーション・進捗表示
│   ├── RecordingPanel → 録音機能
│   ├── TranscriptionStep → 文字起こし処理
│   └── SummaryStep  → 要約生成
└── SplitPage        → 単純分割機能
```

**状態管理パターン**:
```typescript
// リフトアップパターンでの状態共有
interface StepState {
  hasFile: boolean;
  hasApiKey: boolean; 
  hasSplitFiles: boolean;
  hasTranscriptionResults: boolean;
}

// コンポーネント間のデータフロー
TranscribePage → App → HeroSection
            ↓
    各種コンポーネントへ
```

#### 技術スタック詳細

**フロントエンド技術**:
```json
{
  "react": "^19.0.0",           // 最新React（Concurrent Features）
  "typescript": "^5.5.3",       // 型安全性
  "vite": "^7.1.3",            // 高速ビルド・HMR
  "tailwindcss": "^4.0",       // ユーティリティCSS
  "lucide-react": "latest",     // 一貫性のあるアイコン
  "@google/generative-ai": "^0.21.0" // Gemini API SDK
}
```

**音声処理技術**:
```javascript
// Web Audio API - 高速処理
const audioContext = new AudioContext();
const audioBuffer = await audioContext.decodeAudioData(arrayBuffer);

// FFmpeg.wasm - 高互換性
import { FFmpeg } from '@ffmpeg/ffmpeg';
const ffmpeg = new FFmpeg();
```

### 🔀 処理フロー詳細

#### 音声分割アルゴリズム

**Web Audio API処理**:
```javascript
// 1. ファイル読み込み
const arrayBuffer = await file.arrayBuffer();

// 2. デコード
const audioBuffer = await audioContext.decodeAudioData(arrayBuffer);

// 3. サンプルレベル分割
const samplesPerSegment = Math.floor(audioBuffer.length / segmentCount);
const segment = audioBuffer.getChannelData(0).slice(start, end);

// 4. WAV エンコード
const wavBuffer = encodeWAV(segment, audioBuffer.sampleRate);

// 5. Blob 生成
const blob = new Blob([wavBuffer], { type: 'audio/wav' });
```

**メモリ管理**:
```javascript
// 自動リソース解放
const cleanup = () => {
  audioContext?.close();
  objectURLs.forEach(url => URL.revokeObjectURL(url));
  // ガベージコレクション促進
  if (window.gc) window.gc();
};
```

#### AI統合処理フロー

**Gemini API ワークフロー**:
```typescript
// 並列処理での最適化
const transcribeMultiple = async (files: Blob[]) => {
  const concurrency = Math.min(files.length, 3); // 並列数制限
  const semaphore = new Semaphore(concurrency);
  
  return Promise.allSettled(
    files.map(file => semaphore.acquire(() => transcribeSingle(file)))
  );
};

// エラー処理・リトライ機能
const transcribeSingle = async (blob: Blob, retryCount = 3) => {
  for (let attempt = 1; attempt <= retryCount; attempt++) {
    try {
      return await geminiAPI.generateContent({
        contents: [{ parts: [{ inlineData: { data: base64, mimeType } }] }]
      });
    } catch (error) {
      if (attempt === retryCount) throw error;
      await delay(Math.pow(2, attempt) * 1000); // 指数バックオフ
    }
  }
};
```

### 🎨 UI/UXデザインシステム

#### カラーパレット
```css
:root {
  /* プライマリ - バイオレット系 */
  --violet-50: #f5f3ff;
  --violet-600: #7c3aed;
  --violet-700: #6d28d9;
  
  /* セカンダリ - パープル系 */  
  --purple-600: #9333ea;
  --purple-700: #7e22ce;
  
  /* ステータスカラー */
  --green-500: #10b981;   /* 成功 */
  --red-500: #ef4444;     /* エラー */
  --blue-500: #3b82f6;    /* 情報 */
  --yellow-500: #f59e0b;  /* 警告 */
}
```

#### コンポーネント設計原則

**統一されたカードデザイン**:
```typescript
// 基本カード構造
<div className="bg-white rounded-2xl shadow-lg p-8 border border-gray-200">
  {/* 入力セクション */}
  <div className="bg-violet-50 rounded-xl p-6 border border-violet-200">
    <h3>設定</h3>
    {/* 設定UI */}
  </div>
  
  {/* 実行ボタン（セクション間） */}
  <div className="text-center space-y-3">
    <button className="bg-gradient-to-r from-violet-600 to-purple-600...">
      実行
    </button>
    <div className="text-sm text-gray-600">予想コスト: $0.0001</div>
  </div>
  
  {/* 出力セクション */}
  <div className="bg-green-50 rounded-xl p-6 border border-green-200">
    <h3>結果</h3>
    {/* 結果表示 */}
  </div>
</div>
```

**アニメーション・トランジション**:
```css
/* スムーズトランジション */
.transition-all { transition: all 0.2s ease-in-out; }
.animate-bounce { animation: bounce 1s infinite; }
.animate-pulse { animation: pulse 2s cubic-bezier(0.4, 0, 0.6, 1) infinite; }

/* ガラスモーフィズム */
.glass {
  background: rgba(255, 255, 255, 0.95);
  backdrop-filter: blur(10px);
  border: 1px solid rgba(255, 255, 255, 0.5);
}
```

### 🧪 テスト・品質保証

#### 推奨テスト環境
```bash
# ユニットテスト
npm install --save-dev vitest @testing-library/react

# E2Eテスト  
npm install --save-dev playwright

# 静的解析
npm install --save-dev eslint @typescript-eslint/parser

# コードフォーマット
npm install --save-dev prettier
```

#### デバッグ・監視
```javascript
// 開発用ログ出力
const DEBUG = import.meta.env.DEV;

const log = {
  info: (message, data) => DEBUG && console.log(`[INFO] ${message}`, data),
  warn: (message, data) => DEBUG && console.warn(`[WARN] ${message}`, data),
  error: (message, error) => console.error(`[ERROR] ${message}`, error)
};

// パフォーマンス監視
const measure = (name, fn) => {
  const start = performance.now();
  const result = fn();
  const duration = performance.now() - start;
  log.info(`${name} completed in ${duration.toFixed(2)}ms`);
  return result;
};
```

## 🤝 コントリビューション・コミュニティ

### 🛠️ コントリビューション方法

#### 開発参加フロー
1. **Issue確認**: 既存のIssueを確認、または新規Issue作成
2. **Fork**: リポジトリをFork
3. **ブランチ作成**: `git checkout -b feature/amazing-feature`
4. **開発**: コード変更・テスト追加
5. **コミット**: 明確なコミットメッセージ
6. **プッシュ**: `git push origin feature/amazing-feature`
7. **Pull Request**: 詳細な説明付きでPR作成

#### コーディング規約
```typescript
// ファイル命名規則
ComponentName.tsx      // コンポーネント（PascalCase）
utilityName.ts        // ユーティリティ（camelCase）
CONSTANTS.ts          // 定数（UPPER_CASE）

// コンポーネント設計
export interface ComponentProps {
  // Props interface は export
}

export function ComponentName({ prop }: ComponentProps) {
  // 関数コンポーネント推奨
  return <div>...</div>;
}

// 型定義
type Status = 'idle' | 'loading' | 'success' | 'error'; // Union types
interface Data { id: string; name: string; } // Object types
```

### 🐛 バグレポート・機能要望

#### Issue テンプレート
**バグレポート**:
```markdown
## バグ概要
簡潔な説明

## 再現手順  
1. ...
2. ...
3. エラー発生

## 期待する動作
正常な場合の動作

## 実際の動作
実際に起こった動作

## 環境情報
- OS: Windows 11 / macOS 14 / Ubuntu 22.04
- ブラウザ: Chrome 120
- ファイル: sample.mp3 (150MB)
```

**機能要望**:
```markdown
## 機能概要
新機能の説明

## 動機・背景
なぜこの機能が必要か

## 提案する解決方法
具体的な実装アイデア

## 代替案
他に考えられる方法
```

### 📋 ロードマップ・今後の予定

#### 近日実装予定 🚧
- **多言語対応**: 英語・中国語UI
- **テーマ機能**: ダーク・ライトモード切り替え
- **詳細設定**: 音声品質・圧縮設定
- **履歴機能**: 過去の処理結果保存・再利用

#### 長期計画 🔮
- **クラウドストレージ連携**: Google Drive・Dropbox連携
- **リアルタイム文字起こし**: ライブ音声の即座の文字起こし
- **多言語音声認識**: 日本語以外の言語対応
- **音声解析機能**: 感情分析・話者分離

## 📜 ライセンス・法的事項

### ライセンス情報
```
MIT License

Copyright (c) 2024 nyanko3141592

Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation files (the "Software"), to deal
in the Software without restriction, including without limitation the rights
to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
copies of the Software, and to permit persons to whom the Software is
furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all
copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
SOFTWARE.
```

### 使用する外部サービス・ライブラリ
- **Google Gemini API**: [利用規約](https://ai.google.dev/terms)
- **React**: MIT License
- **TypeScript**: Apache-2.0 License  
- **Vite**: MIT License
- **TailwindCSS**: MIT License
- **FFmpeg.wasm**: LGPL-2.1 License

### プライバシーポリシー
本アプリケーションは個人情報を収集・保存・送信しません。すべてのデータはユーザーのブラウザ内で処理され、外部への送信は選択したAI機能利用時のAPIへの直接通信のみです。

## 🙏 謝辞・クレジット

### 貢献者・協力者
- **NotebookLMチーム** - 素晴らしいAI要約ツールの提供
- **Google AI** - Gemini APIの提供
- **FFmpeg.wasmチーム** - ブラウザ音声処理の実現
- **React・TypeScriptコミュニティ** - 高品質な開発環境
- **オープンソースコミュニティ** - 多くのライブラリ・ツール

### インスピレーション・参考
- **NotebookLM** - AI要約のUXデザイン参考
- **Whisper** - 音声認識技術の参考
- **Modern Web Audio** - Web Audio API実装パターン

### 特別な感謝 💝
コミュニティからのフィードバック・Issue報告・Pull Requestをいただいた皆様に心より感謝いたします。このプロジェクトは皆様の貢献により成り立っています。

---

**最終更新**: 2024年12月
**バージョン**: v2.0.0
**作者**: [@nyanko3141592](https://github.com/nyanko3141592)
**リポジトリ**: [AudioSplitForNotebookLM](https://github.com/nyanko3141592/AudioSplitForNotebookLM)
**ライブデモ**: [https://nyanko3141592.github.io/AudioSplitForNotebookLM/](https://nyanko3141592.github.io/AudioSplitForNotebookLM/)