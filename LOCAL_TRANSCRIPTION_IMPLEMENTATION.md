# ローカル文字起こし機能実装ドキュメント

## 概要
Gemini APIに依存しない、WebAssembly (WASM) を使用したローカル文字起こし機能の実装記録。

## 実装内容

### 1. 新規作成ファイル

#### `/src/utils/localTranscriber.ts`
- Transformers.js (Xenova) を使用したWhisper実装
- 利用可能なモデル: whisper-tiny, whisper-base, whisper-small
- 特徴:
  - ブラウザでの完全ローカル処理
  - モデルのキャッシュ機能
  - 順次処理による複数ファイル対応
  - キャンセル機能

#### `/src/utils/transcriptionService.ts`
- ローカル・Gemini API切り替え用サービス
- シングルトンパターン
- 処理モード: `'local'` | `'gemini'` | `'auto'`
- 自動選択: APIキーがある場合はGemini、ない場合はローカル

### 2. 修正ファイル

#### `/src/components/steps/TranscriptionStep.tsx`
- 処理方法選択UI（後に削除、AI設定に移動）
- ローカル処理時のWhisperモデル選択
- APIキー不要でのボタン有効化
- `presetTranscriptionMode` プロパティ対応

#### `/src/pages/TranscribePage.tsx`
- AI設定ステップに処理方法選択を追加
- `transcriptionMode` ステート管理
- APIキー未設定時でもTranscriptionStep表示

### 3. 依存関係追加
```json
{
  "@xenova/transformers": "^2.17.2"
}
```

## 技術仕様

### Whisperモデル
- **whisper-tiny**: 39MB, 最速, 標準精度
- **whisper-base**: 74MB, 高速, 良好精度  
- **whisper-small**: 242MB, 標準速度, 高精度

### 処理フロー
1. AI設定で処理方法選択（ローカル/Gemini）
2. ローカル選択時はWhisperモデル選択
3. 初回実行時はモデルダウンロード（CDNから）
4. 音声ファイルをArrayBufferに変換
5. Whisperで文字起こし実行
6. 結果をTranscriptionResult形式で返却

## 解決済み問題

### 1. TypeScriptビルドエラー
**エラー**: `verbatimModuleSyntax`設定でimportエラー
```bash
Uncaught SyntaxError: The requested module does not provide an export named 'TranscriptionProgress'
```

**解決**: type-only importに修正
```typescript
import type { TranscriptionResult, TranscriptionProgress } from './geminiTranscriber';
```

### 2. APIキー未設定時の文字起こしボタン無効化
**問題**: ローカル処理でもAPIキーが要求された
**解決**: 処理モード判定の追加
```typescript
if (transcriptionMode === 'gemini' && !apiKey) {
  setError('Gemini APIを使用するにはAPIキーを入力してください');
  return;
}
```

### 3. UI状態同期問題
**問題**: 親コンポーネントの選択が子コンポーネントに反映されない
**解決**: useEffectでpreset値の同期
```typescript
useEffect(() => {
  setTranscriptionMode(presetTranscriptionMode);
}, [presetTranscriptionMode]);
```

## 現在の状況

### ✅ 動作確認済み
- Whisperモデルの初期化成功
- モデルダウンロードとキャッシュ
- UI状態の同期（処理方法選択）

### ❌ 未解決問題
- **実際の音声文字起こしが動作しない**
- コンソールログではWhisper初期化成功だが、文字起こし処理で失敗

### 推測される問題点
1. 音声データの形式変換エラー
2. Whisperパイプラインの設定問題
3. ArrayBufferとWhisperの互換性問題

## 次回対応事項

### 優先度高
1. **音声データ処理の調査**
   - ArrayBuffer → Whisper入力形式の確認
   - 音声フォーマット対応状況の確認
   - デバッグログの追加

2. **エラーハンドリングの強化**
   - より詳細なエラーメッセージ
   - 処理段階別のログ出力

3. **動作テスト**
   - 小さな音声ファイルでの単体テスト
   - ブラウザ互換性確認

### 優先度中
1. **UI/UX改善**
   - 初期化進捗の詳細表示
   - モデル選択時の説明強化

2. **パフォーマンス最適化**
   - メモリ使用量の確認
   - 大きなファイルの処理改善

## 参考情報

### 使用ライブラリ
- [@xenova/transformers](https://huggingface.co/docs/transformers.js)
- [Whisper models on Hugging Face](https://huggingface.co/Xenova)

### 実装参考
- [Transformers.js Examples](https://github.com/xenova/transformers.js/tree/main/examples)
- [Browser-based Speech Recognition](https://huggingface.co/blog/audio-transformers)

### ファイル構成
```
src/
├── utils/
│   ├── localTranscriber.ts        # 新規作成
│   ├── transcriptionService.ts    # 新規作成
│   └── geminiTranscriber.ts       # 既存（type export修正）
├── components/steps/
│   └── TranscriptionStep.tsx      # 大幅修正
└── pages/
    └── TranscribePage.tsx          # 修正
```

## コミット履歴
- feat: implement local transcription with Whisper
- fix: TypeScript type-only imports
- refactor: move transcription mode to AI settings
- fix: UI state synchronization issues

---
*作成日: 2025-08-27*
*最終更新: ローカル文字起こし機能実装完了（UI動作確認済み、音声処理未解決）*