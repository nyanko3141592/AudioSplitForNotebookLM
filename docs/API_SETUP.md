# API設定ガイド

## 📋 概要

爆速議事録では、高精度な文字起こしと要約生成のためにGoogle Gemini APIを使用します。このガイドでは、APIキーの取得から設定まで、初回セットアップの手順を詳しく説明します。

## 🔑 Gemini API キーの取得

### ステップ1: Google AI Studioにアクセス

1. [Google AI Studio](https://aistudio.google.com/app/apikey) にアクセス
2. Googleアカウントでサインイン

### ステップ2: APIキーを作成

1. **「Create API key」**ボタンをクリック
2. 既存のGoogle Cloud プロジェクトを選択、または新規作成
3. **「Create API key in new project」**を選択（推奨）
4. 生成されたAPIキーをコピーして安全に保管

⚠️ **重要**: APIキーは秘密情報です。第三者と共有しないでください。

### ステップ3: アプリケーションに設定

1. 爆速議事録アプリを開く
2. 設定エリアの**「Gemini APIキー」**フィールドにペースト
3. 設定は自動的にローカルストレージに安全保存されます

## 💰 料金体系と制限

### 無料枠
```
制限内容:
- 15 requests/minute
- 60 requests/day
- 月間 無料クォータあり

対応ファイルサイズ:
- 単一ファイル: 最大20MB
- 推奨分割: 200MB以上は自動分割
```

### 有料プラン
より高い制限値とパフォーマンスが必要な場合は、Google AI Studioで有料プランに切り替えできます。

## 🤖 対応モデル一覧

### 推奨モデル設定
```typescript
// 用途別推奨モデル
const recommendedModels = {
  // 一般用途（推奨）
  "gemini-2.0-flash-lite": {
    特徴: "高速・低コスト",
    適用: "日常的な議事録・要約作成",
    コスト: "最低"
  },
  
  // 高品質が必要な場合
  "gemini-2.5-flash": {
    特徴: "バランス重視", 
    適用: "重要な会議・詳細な要約が必要",
    コスト: "中程度"
  },
  
  // 最高品質が必要な場合
  "gemini-2.5-pro": {
    特徴: "最高性能",
    適用: "法的文書・重要なプレゼンテーション",
    コスト: "高め"
  }
};
```

## 🔧 カスタムエンドポイント設定

### 企業環境・プロキシ対応
```javascript
// カスタムエンドポイントの例
const customEndpoints = {
  // 標準エンドポイント（デフォルト）
  standard: "https://generativelanguage.googleapis.com/v1beta/models/",
  
  // 企業プロキシ経由
  proxy: "https://your-proxy.company.com/gemini-api/",
  
  // 地域固有エンドポイント
  regional: "https://generativelanguage-asia.googleapis.com/v1beta/models/"
};
```

### 設定方法
1. アプリの**「詳細設定」**を開く
2. **「カスタムエンドポイント」**フィールドに入力
3. 企業のIT部門に設定方法を確認することを推奨

## 🛡️ セキュリティのベストプラクティス

### APIキー管理
```markdown
✅ 推奨事項:
- APIキーは定期的に再生成
- 使用しなくなったキーは無効化
- 複数プロジェクトで同じキーを使い回さない
- 公開リポジトリにAPIキーをコミットしない

❌ 避けるべき事項:
- APIキーをスクリーンショットで共有
- メール・チャットでAPIキーを送信
- 複数人でAPIキーを共有
- 本番・テスト環境で同じキーを使用
```

### アプリケーションレベルのセキュリティ
- APIキーはローカルストレージに暗号化保存
- 通信は全てHTTPS/TLS暗号化
- 中間サーバーを経由しない直接API通信
- 音声データは端末内処理のみ（外部送信なし）

## 📊 使用量の監視

### Google AI Studioでの確認
1. [Google AI Studio](https://aistudio.google.com/) にアクセス
2. **「Usage」**タブを確認
3. リクエスト数・使用量をリアルタイム監視

### アプリ内コスト表示
- リアルタイム予想コスト表示
- 実際の使用コスト計算
- 文字数ベースの事前見積もり

## 🔧 トラブルシューティング

### よくあるエラーと対処法

#### APIキー関連エラー
```javascript
// Error: Invalid API key
解決方法:
1. APIキーが正しく入力されているか確認
2. Google AI StudioでAPIキーが有効か確認  
3. APIキーを再生成して新しいキーで試行

// Error: Quota exceeded
解決方法:
1. 使用量がクォータを超過（時間を置いて再試行）
2. 有料プランへの切り替えを検討
3. より小さなファイルで分割処理
```

#### ネットワーク関連エラー
```javascript
// Error: Network request failed
解決方法:
1. インターネット接続を確認
2. ファイアウォール・プロキシ設定を確認
3. カスタムエンドポイントが必要か企業IT部門に確認
4. VPN使用時は地域設定を確認
```

#### ファイル関連エラー
```javascript
// Error: File too large
解決方法:
1. ファイルサイズを20MB以下に分割
2. 自動分割機能を使用（200MB以上で提案）
3. 音声品質を下げてファイルサイズ削減を検討
```

## 📝 設定テンプレート

### 個人利用向け設定
```json
{
  "apiKey": "YOUR_API_KEY_HERE",
  "model": "gemini-2.0-flash-lite",
  "endpoint": "default",
  "maxConcurrency": 3
}
```

### 企業・チーム利用向け設定
```json
{
  "apiKey": "YOUR_API_KEY_HERE", 
  "model": "gemini-2.5-flash",
  "endpoint": "https://your-proxy.company.com/gemini-api/",
  "maxConcurrency": 1,
  "enableLogging": true
}
```

### 高品質要求向け設定
```json
{
  "apiKey": "YOUR_API_KEY_HERE",
  "model": "gemini-2.5-pro", 
  "endpoint": "default",
  "maxConcurrency": 1,
  "retryAttempts": 5
}
```

## 🆘 サポート・お問い合わせ

### 公式サポート
- **Google AI Studio**: [ヘルプセンター](https://ai.google.dev/support)
- **APIドキュメント**: [Gemini API Documentation](https://ai.google.dev/docs)

### コミュニティサポート
- **GitHub Issues**: [問題報告・機能要望](https://github.com/nyanko3141592/AudioSplitForNotebookLM/issues)
- **Discussions**: [使用方法・質問](https://github.com/nyanko3141592/AudioSplitForNotebookLM/discussions)

---

*最終更新: 2024年12月*  
*このガイドは爆速議事録 v2.2 に対応しています*