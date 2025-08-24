# AudioSplit for NotebookLM

## 概要
NotebookLMの200MB制限に対応するため、ブラウザ上で動作する音声ファイル分割ツール。完全にクライアントサイドで動作し、プライバシーを保護しながら高速に音声ファイルを分割します。

**ライブデモ**: [https://nyanko3141592.github.io/AudioSplitForNotebookLM/](https://nyanko3141592.github.io/AudioSplitForNotebookLM/)

## 主な機能

### ✨ 特徴
- **完全プライベート処理**: 音声ファイルはブラウザ内でのみ処理され、外部サーバーには一切送信されません
- **高速処理**: Web Audio APIとWebAssembly技術により、大容量ファイルも高速に分割
- **インストール不要**: ブラウザだけで動作、ソフトウェアのインストール不要
- **オープンソース**: GitHubでコードを公開、安全性を確認可能

### 📋 機能詳細

#### 1. ファイル入力
- ドラッグ&ドロップまたはクリックで音声ファイルを選択
- 対応形式: MP3, WAV, M4A, OGG, WebM
- ファイルサイズ制限なし（ブラウザメモリの範囲内）

#### 2. 分割方式
**最大サイズ指定モード**
- デフォルト: 190MB（NotebookLMの200MB制限に安全マージンを確保）
- カスタム設定可能（1MB〜200MB）
- ファイルサイズに基づいて自動的に必要な分割数を計算
- **重複なし**: 各パートは完全に独立、音声の重複や欠落なし

**分割数指定モード**
- 2〜100個に均等分割
- 各ファイルの長さを均等に配分
- 最後のパートに端数を含む

#### 3. 出力形式
- 8-bit PCM WAV形式で出力（元ファイルより小さくなる場合があります）
- 分割ファイル名: `original_name_part1.wav`, `original_name_part2.wav`...
- 各ファイルを個別ダウンロード
- ZIP形式で一括ダウンロード可能

## 技術仕様

### アーキテクチャ
- **処理方式**: 完全クライアントサイド処理（サーバー通信なし）
- **メモリ管理**: 自動メモリ解放機能により、大容量ファイル処理後も安定動作

### 音声処理エンジン
1. **Web Audio API（推奨）**
   - ブラウザネイティブAPIで高速処理
   - サンプルレベルの正確な分割（重複・欠落なし）
   - 8-bit PCM変換によりファイルサイズを最適化

2. **FFmpeg.wasm（フォールバック）**
   - Web Audio APIが利用できない場合に自動切り替え
   - より多くの音声形式をサポート
   - ストリーミング分割対応

### 技術スタック
- **React 19 + TypeScript**: モダンUIフレームワーク
- **Vite**: 高速ビルドツール、WASM対応
- **TailwindCSS v4**: モダンなグラデーションデザイン
- **GitHub Pages**: 無料・高速ホスティング

## 使い方

1. **ファイルを選択**: 音声ファイルをドラッグ&ドロップまたはクリックして選択
2. **分割方式を選択**: 
   - 最大サイズ指定（デフォルト190MB）
   - 分割数指定（2〜100個）
3. **分割開始**: ボタンをクリックして処理開始
4. **ダウンロード**: 個別または一括でダウンロード

## セキュリティ・プライバシー

🔒 **あなたのデータは100%安全です**
- ファイルは一切サーバーに送信されません
- すべての処理はあなたのブラウザ内で完結
- 処理後は自動的にメモリから削除
- 外部サービスとの通信なし
- オープンソースで透明性を確保

## 動作環境

### 推奨ブラウザ
- Chrome 89以降
- Firefox 89以降
- Safari 15.4以降
- Edge 89以降

### システム要件
- メモリ: 4GB以上推奨
- 最大処理可能ファイルサイズ: 約2GB（ブラウザ依存）

## 既知の問題と制限事項

- **モバイルブラウザ**: メモリ制限により大容量ファイルの処理が困難
- **処理時間**: 1GB以上のファイルは数分かかる場合があります
- **出力形式**: 現在WAV形式のみ対応（元の形式に関わらず）

## トラブルシューティング

### Q: 分割後のファイルサイズが大きい
A: 8-bit PCM WAV形式で出力されるため、MP3等の圧縮形式より大きくなる場合があります。

### Q: 処理が遅い
A: Web Audio APIが使用されているか確認してください。ブラウザのコンソールでログを確認できます。

### Q: エラーが発生する
A: 以下を確認してください：
- ブラウザが推奨バージョン以上か
- メモリが十分にあるか
- 音声ファイルが破損していないか

## 開発者向け情報

### 環境構築

```bash
# リポジトリのクローン
git clone https://github.com/nyanko3141592/AudioSplitForNotebookLM.git
cd AudioSplitForNotebookLM

# 依存関係のインストール
npm install

# 開発サーバーの起動（http://localhost:5173）
npm run dev

# ビルド
npm run build

# ビルドのプレビュー
npm run preview
```

### プロジェクト構造

```
src/
├── components/       # UIコンポーネント
│   ├── FileUpload.tsx       # ファイルアップロード
│   ├── SplitOptions.tsx     # 分割オプション設定
│   ├── ProgressBar.tsx      # 進捗表示
│   └── DownloadList.tsx     # ダウンロードリスト
├── hooks/           # カスタムフック
│   └── useFFmpeg.ts         # FFmpeg.wasm統合
├── utils/           # ユーティリティ
│   ├── audioSplitter.ts     # Web Audio API分割処理
│   └── download.ts          # ダウンロード処理
└── App.tsx          # メインアプリケーション
```

### 技術的詳細

#### 分割アルゴリズム
1. 音声ファイルをArrayBufferとして読み込み
2. Web Audio APIでデコード
3. サンプルレベルで正確に分割（重複・欠落なし）
4. 8-bit PCM WAVとしてエンコード
5. Blobとして出力

#### メモリ管理
- AudioContext自動クローズ
- ArrayBuffer即座解放
- Blob URL自動revoke
- ガベージコレクション最適化

## コントリビューション

プルリクエストを歓迎します！
1. Forkする
2. Feature branchを作成 (`git checkout -b feature/AmazingFeature`)
3. 変更をコミット (`git commit -m 'Add some AmazingFeature'`)
4. Branchにプッシュ (`git push origin feature/AmazingFeature`)
5. Pull Requestを開く

## ライセンス

MIT License - 詳細は[LICENSE](LICENSE)ファイルを参照

## 作者

[@nyanko3141592](https://github.com/nyanko3141592)

## 謝辞

- NotebookLMチーム - 素晴らしいツールの提供
- FFmpeg.wasm - クロスプラットフォーム音声処理
- コントリビューターの皆様