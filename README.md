# AudioSplit for NotebookLM

## 概要
NotebookLMの200MB制限に対応するため、ブラウザ上で動作する音声ファイル分割ツール。WASMを使用してクライアントサイドで安全に処理し、GitHub Pagesでホスティング。

## 機能要件

### 1. ファイル入力
- ドラッグ&ドロップまたはファイル選択で音声ファイルをアップロード
- 対応形式: MP3, WAV, M4A, OGG, WebM
- ファイルサイズ制限なし（ブラウザメモリの範囲内）

### 2. 分割方式
**方式A: 最大サイズ指定**
- デフォルト: 190MB（NotebookLMの200MB制限に余裕を持たせる）
- カスタム設定可能（1MB〜200MB）
- 自動的に必要な個数に分割

**方式B: 分割数指定**
- 2〜100個に分割
- 各ファイルサイズを均等に配分

### 3. 出力
- 分割ファイル名: `original_name_part1.ext`, `original_name_part2.ext`...
- 各ファイルを個別ダウンロード or ZIPで一括ダウンロード
- メタデータ保持（可能な限り）

## 技術スタック

### フロントエンド
- **React + TypeScript**: UIフレームワーク
- **Vite**: ビルドツール（高速、WASM対応良好）
- **Tailwind CSS**: スタイリング
- **shadcn/ui**: UIコンポーネント

### 音声処理
- **FFmpeg.wasm**: 音声ファイルの分割処理
  - クロスブラウザ対応
  - 多様な音声形式サポート
  - 正確な時間/サイズベースの分割

### デプロイ
- **GitHub Pages**: 静的サイトホスティング
- **GitHub Actions**: 自動デプロイ

## UI/UX設計

### メイン画面
```
┌─────────────────────────────────────┐
│     AudioSplit for NotebookLM       │
│                                     │
│  ┌─────────────────────────────┐   │
│  │                             │   │
│  │   ファイルをドロップ         │   │
│  │   または クリックして選択    │   │
│  │                             │   │
│  └─────────────────────────────┘   │
│                                     │
│  分割方式:                          │
│  ○ 最大サイズ指定 [190] MB         │
│  ○ 分割数指定 [2] 個               │
│                                     │
│  [分割開始]                         │
└─────────────────────────────────────┘
```

### 処理中画面
- プログレスバー表示
- 推定残り時間
- キャンセルボタン

### 完了画面
- 分割結果一覧（ファイル名、サイズ、長さ）
- 個別ダウンロードボタン
- 一括ダウンロードボタン

## セキュリティ・プライバシー
- **完全クライアントサイド処理**: サーバーへのアップロードなし
- **メモリ内処理**: ローカルストレージ使用最小限
- **処理後自動クリーンアップ**: メモリ解放

## ブラウザ要件
- Chrome 89+
- Firefox 89+
- Safari 15.4+
- Edge 89+
- SharedArrayBuffer対応必須（FFmpeg.wasm）

## 制限事項
- ブラウザメモリ制限（通常2-4GB）
- 大容量ファイルは処理時間が長い
- モバイルブラウザでは制限あり

## 開発フェーズ

### Phase 1: 基本機能
- プロジェクトセットアップ
- FFmpeg.wasm統合
- 基本的な分割機能

### Phase 2: UI実装
- React UIコンポーネント
- ドラッグ&ドロップ
- プログレス表示

### Phase 3: 高度な機能
- ZIP圧縮ダウンロード
- 分割プレビュー
- エラーハンドリング強化

### Phase 4: デプロイ
- GitHub Pages設定
- CI/CD設定
- ドキュメント作成

## ディレクトリ構造
```
audio-split-for-notebooklm/
├── src/
│   ├── components/
│   │   ├── FileUpload.tsx
│   │   ├── SplitOptions.tsx
│   │   ├── ProgressBar.tsx
│   │   └── DownloadList.tsx
│   ├── hooks/
│   │   └── useFFmpeg.ts
│   ├── utils/
│   │   └── audioSplitter.ts
│   ├── App.tsx
│   └── main.tsx
├── public/
├── index.html
├── package.json
├── vite.config.ts
├── tsconfig.json
└── README.md
```

## 開発環境セットアップ

```bash
# 依存関係のインストール
npm install

# 開発サーバーの起動
npm run dev

# ビルド
npm run build

# プレビュー
npm run preview
```

## ライセンス
MIT