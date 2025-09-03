# 開発者ガイド

## 🛠️ 開発環境のセットアップ

### 前提条件
- **Node.js**: 18.0.0 以上
- **npm**: 9.0.0 以上  
- **Git**: 2.34.0 以上
- **推奨ブラウザ**: Chrome 89+ (開発・テスト用)

### 初期セットアップ

```bash
# リポジトリのクローン
git clone https://github.com/nyanko3141592/AudioSplitForNotebookLM.git
cd AudioSplitForNotebookLM

# 依存関係のインストール
npm install

# 開発サーバーの起動
npm run dev
# → http://localhost:5173 でアクセス可能

# 型チェック
npm run type-check

# リンター実行
npm run lint

# ビルド
npm run build

# ビルド結果のプレビュー
npm run preview
```

### 推奨開発環境

#### VSCode 拡張機能
```json
{
  "recommendations": [
    "ms-vscode.vscode-typescript-next",
    "bradlc.vscode-tailwindcss",
    "formulahendry.auto-rename-tag", 
    "esbenp.prettier-vscode",
    "ms-vscode.vscode-json",
    "zignd.html-css-class-completion"
  ]
}
```

#### 設定ファイル (.vscode/settings.json)
```json
{
  "editor.formatOnSave": true,
  "editor.codeActionsOnSave": {
    "source.fixAll.eslint": true
  },
  "typescript.preferences.importModuleSpecifier": "relative",
  "emmet.includeLanguages": {
    "typescript": "html",
    "typescriptreact": "html"
  }
}
```

## 🏗️ プロジェクト構造

### ディレクトリ構成
```
AudioSplitForNotebookLM/
├── docs/                          # 📚 ドキュメント
│   ├── API_SETUP.md              # API設定ガイド
│   ├── NEW_FEATURES.md           # 新機能ガイド
│   └── DEVELOPMENT.md            # 開発者ガイド（このファイル）
│
├── public/                        # 🌐 静的ファイル
│   ├── favicon.ico
│   └── manifest.json
│
├── src/                          # 💻 ソースコード
│   ├── components/               # 🧩 UIコンポーネント
│   │   ├── steps/               # ワークフローステップ
│   │   │   ├── TranscriptionStep.tsx
│   │   │   └── SummaryStep.tsx
│   │   ├── SummaryHistory.tsx   # 履歴管理
│   │   ├── RecordingPanel.tsx   # 録音機能
│   │   └── ...
│   │
│   ├── pages/                   # 📄 ページコンポーネント  
│   │   ├── TranscribePage.tsx   # メイン機能ページ
│   │   └── SplitPage.tsx        # 音声分割ページ
│   │
│   ├── hooks/                   # 🎣 カスタムフック
│   │   ├── useRecovery.ts       # リカバリー機能
│   │   └── useFFmpeg.ts         # FFmpeg統合
│   │
│   ├── utils/                   # 🔧 ユーティリティ
│   │   ├── geminiTranscriber.ts # Gemini API統合
│   │   ├── recoveryManager.ts   # リカバリー管理
│   │   └── summaryHistory.ts    # 履歴管理
│   │
│   ├── types/                   # 📝 型定義
│   │   └── summaryHistory.ts
│   │
│   ├── App.tsx                  # 🌐 メインアプリ
│   └── main.tsx                 # 🚀 エントリーポイント
│
├── package.json                 # 📦 依存関係
├── tsconfig.json               # ⚙️ TypeScript設定
├── tailwind.config.js          # 🎨 Tailwind設定
├── vite.config.ts              # ⚡ Vite設定
└── eslint.config.js            # 📏 ESLint設定
```

### アーキテクチャ原則

#### コンポーネント設計
```typescript
// 🎯 Single Responsibility Principle
// 各コンポーネントは単一の責任を持つ

// ✅ Good: 責任が明確
function TranscriptionStep({ onComplete }: TranscriptionStepProps) {
  // 文字起こし処理のみを担当
}

// ❌ Bad: 複数の責任を持つ
function MegaComponent({ ... }: MegaProps) {
  // 録音、文字起こし、要約、履歴管理を全て担当
}
```

#### 状態管理パターン
```typescript
// 🔄 Lifting State Up パターン
// 共有状態は最も近い共通の親で管理

// App.tsx (最上位)
const [stepState, setStepState] = useState<StepState>({
  hasFile: false,
  hasApiKey: false,
  hasTranscriptionResults: false
});

// 子コンポーネントに props として渡す
<TranscribePage stepState={stepState} onStepChange={setStepState} />
```

#### エラーハンドリング
```typescript
// 🛡️ 防御的プログラミング
const safeApiCall = async <T>(
  apiFunc: () => Promise<T>,
  fallback: T,
  errorHandler?: (error: Error) => void
): Promise<T> => {
  try {
    return await apiFunc();
  } catch (error) {
    console.error('API call failed:', error);
    errorHandler?.(error instanceof Error ? error : new Error(String(error)));
    return fallback;
  }
};
```

## 🔄 開発ワークフロー

### ブランチ戦略

```bash
main                    # 🚀 本番リリース用
├── develop            # 🧪 開発統合用  
├── feature/xxx        # ✨ 新機能開発
├── fix/xxx           # 🐛 バグ修正
└── hotfix/xxx        # 🚨 緊急修正
```

#### 開発フロー
```bash
# 1. 新機能開発開始
git checkout main
git pull origin main
git checkout -b feature/auto-title-generation

# 2. 開発作業
# ... コード変更 ...

# 3. コミット（Conventional Commits）
git add .
git commit -m "feat: add automatic title generation using Gemini API

- Add generateTitle method to GeminiTranscriber
- Update SummaryStep to integrate title generation
- Add progress indicator for title generation process
- Save generated titles to summary history

Closes #123"

# 4. プッシュ&プルリクエスト
git push origin feature/auto-title-generation
# GitHub でプルリクエスト作成

# 5. レビュー・マージ後のクリーンアップ
git checkout main
git pull origin main
git branch -d feature/auto-title-generation
```

### コミットメッセージ規約

#### Conventional Commits
```bash
# 基本形式
<type>[optional scope]: <description>

[optional body]

[optional footer(s)]

# タイプ一覧
feat:     # 新機能
fix:      # バグ修正  
docs:     # ドキュメント
style:    # スタイル修正（機能に影響なし）
refactor: # リファクタリング
perf:     # パフォーマンス改善
test:     # テスト追加・修正
chore:    # その他の変更

# 例
feat(summary): add automatic title generation
fix(audio): resolve splitting issue for large files  
docs: update API setup guide
style(ui): improve button hover effects
refactor(storage): simplify localStorage handling
```

### コードレビューガイドライン

#### レビューポイント
```markdown
🔍 機能性
- [ ] 要件通りに動作するか
- [ ] エッジケースの考慮があるか  
- [ ] エラーハンドリングが適切か

🏗️ 設計・アーキテクチャ
- [ ] Single Responsibility Principleに準拠しているか
- [ ] 既存のパターンと一貫性があるか
- [ ] 必要以上に複雑になっていないか

📝 コード品質
- [ ] TypeScript型が適切に定義されているか
- [ ] 変数・関数名が意図を表現しているか
- [ ] コメントが必要な箇所に適切にあるか

🎨 UI/UX  
- [ ] レスポンシブデザインに対応しているか
- [ ] アクセシビリティが考慮されているか
- [ ] 統一されたデザインシステムに準拠しているか

⚡ パフォーマンス
- [ ] 不要な再レンダリングが発生していないか
- [ ] メモリリークの可能性がないか
- [ ] バンドルサイズに影響がないか
```

## 🧪 テスト戦略

### テスト種別

#### ユニットテスト (推奨)
```typescript
// Vitest + Testing Library
import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { SummaryHistory } from '../components/SummaryHistory';

describe('SummaryHistory', () => {
  it('should display empty state when no history exists', () => {
    render(<SummaryHistory />);
    expect(screen.getByText('まだ要約履歴がありません')).toBeInTheDocument();
  });

  it('should switch between list and tile view modes', () => {
    const { container } = render(<SummaryHistory />);
    
    // タイル表示に切り替え
    fireEvent.click(screen.getByTitle('タイル表示'));
    expect(container.querySelector('.grid')).toBeInTheDocument();
    
    // リスト表示に戻す  
    fireEvent.click(screen.getByTitle('リスト表示'));
    expect(container.querySelector('.space-y-4')).toBeInTheDocument();
  });
});
```

#### 統合テスト
```typescript
// API統合テスト
describe('GeminiTranscriber Integration', () => {
  it('should generate title from summary content', async () => {
    const transcriber = new GeminiTranscriber(TEST_API_KEY, 'gemini-2.0-flash-lite');
    const summary = '本日の会議では新商品の価格設定について議論しました...';
    
    const title = await transcriber.generateTitle(summary);
    
    expect(title).toBeTruthy();
    expect(title.length).toBeLessThanOrEqual(20);
    expect(title).not.toContain('```'); // マークダウン記法が除去されている
  });
});
```

#### E2Eテスト (Playwright)
```typescript
// tests/e2e/summary-flow.spec.ts
import { test, expect } from '@playwright/test';

test('complete summary workflow', async ({ page }) => {
  await page.goto('/');
  
  // ファイルアップロード
  await page.setInputFiles('input[type="file"]', 'test-audio.wav');
  
  // API キー設定
  await page.fill('input[placeholder*="API"]', process.env.TEST_API_KEY!);
  
  // 文字起こし実行
  await page.click('button:text("文字起こし実行")');
  await expect(page.locator('text=文字起こしが完了しました')).toBeVisible({ timeout: 60000 });
  
  // 要約実行
  await page.click('button:text("要約実行")');  
  await expect(page.locator('text=まとめが完了しました')).toBeVisible({ timeout: 30000 });
  
  // タイトルが自動生成されている
  await expect(page.locator('[data-testid="generated-title"]')).not.toBeEmpty();
});
```

### テスト実行コマンド
```bash
# ユニットテスト
npm run test

# カバレッジ付きテスト  
npm run test:coverage

# E2Eテスト
npm run test:e2e

# 全テスト実行
npm run test:all
```

## 🔧 開発ツール・設定

### デバッグ設定

#### ブラウザデベロッパーツール
```javascript
// デバッグ用グローバル変数（開発環境のみ）
if (import.meta.env.DEV) {
  window.__DEBUG__ = {
    recoveryManager,
    summaryHistory: loadSummaryHistory(),
    clearStorage: () => localStorage.clear(),
    enableVerboseLogging: () => localStorage.setItem('debug', 'true')
  };
}
```

#### パフォーマンス監視
```typescript
// カスタムパフォーマンス計測
const measurePerformance = <T>(name: string, fn: () => T): T => {
  const start = performance.now();
  const result = fn();
  const duration = performance.now() - start;
  
  if (import.meta.env.DEV) {
    console.log(`⚡ ${name}: ${duration.toFixed(2)}ms`);
  }
  
  return result;
};

// 使用例
const processedAudio = measurePerformance('Audio Processing', () => {
  return splitAudioFile(audioBuffer, segmentCount);
});
```

### ビルド最適化

#### Vite設定 (vite.config.ts)
```typescript
export default defineConfig({
  plugins: [react()],
  
  // 開発サーバー設定
  server: {
    port: 5173,
    open: true,
    host: true // ネットワークアクセス許可
  },
  
  // ビルド最適化
  build: {
    target: 'es2020',
    sourcemap: true,
    rollupOptions: {
      output: {
        manualChunks: {
          // ベンダーライブラリの分離
          vendor: ['react', 'react-dom'],
          ffmpeg: ['@ffmpeg/ffmpeg', '@ffmpeg/util'],
          gemini: ['@google/generative-ai']
        }
      }
    }
  },
  
  // 型チェック
  esbuild: {
    logOverride: { 'this-is-undefined-in-esm': 'silent' }
  }
});
```

#### TypeScript設定 (tsconfig.json)
```json
{
  "compilerOptions": {
    "target": "ES2020",
    "lib": ["ES2020", "DOM", "DOM.Iterable"],
    "module": "ESNext",
    "skipLibCheck": true,
    
    "moduleResolution": "bundler",
    "allowImportingTsExtensions": true,
    "resolveJsonModule": true,
    "isolatedModules": true,
    "noEmit": true,
    "jsx": "react-jsx",
    
    "strict": true,
    "noUnusedLocals": true,
    "noUnusedParameters": true,
    "noFallthroughCasesInSwitch": true,
    
    "baseUrl": ".",
    "paths": {
      "@/*": ["src/*"],
      "@/components/*": ["src/components/*"],
      "@/utils/*": ["src/utils/*"],
      "@/types/*": ["src/types/*"]
    }
  }
}
```

## 🚀 デプロイメント

### GitHub Pages デプロイ

#### 自動デプロイ設定 (.github/workflows/deploy.yml)
```yaml
name: Deploy to GitHub Pages

on:
  push:
    branches: [ main ]
  pull_request:
    branches: [ main ]

jobs:
  build-and-deploy:
    runs-on: ubuntu-latest
    
    steps:
    - name: Checkout
      uses: actions/checkout@v4
      
    - name: Setup Node.js
      uses: actions/setup-node@v4
      with:
        node-version: '18'
        cache: 'npm'
        
    - name: Install dependencies
      run: npm ci
      
    - name: Type check
      run: npm run type-check
      
    - name: Lint
      run: npm run lint
      
    - name: Build
      run: npm run build
      
    - name: Deploy to GitHub Pages
      if: github.ref == 'refs/heads/main'
      uses: peaceiris/actions-gh-pages@v3
      with:
        github_token: ${{ secrets.GITHUB_TOKEN }}
        publish_dir: ./dist
```

### 手動デプロイ
```bash
# ビルド実行
npm run build

# 静的ファイルの確認
ls -la dist/

# GitHub Pages用の設定確認
# dist/index.html が存在することを確認
```

## 🐛 デバッグガイド

### よくある開発時問題

#### TypeScript エラー
```typescript
// ❌ 問題: 型エラーが発生
const history = loadSummaryHistory(); // Type error

// ✅ 解決: 型アサーションまたは型ガード
const history: SummaryHistoryItem[] = loadSummaryHistory().items || [];

// または型ガード関数を作成
function isSummaryHistoryItem(item: any): item is SummaryHistoryItem {
  return item && typeof item.id === 'string' && typeof item.timestamp === 'string';
}
```

#### React Hook エラー
```typescript
// ❌ 問題: useEffect依存配列の警告
useEffect(() => {
  loadHistory();
}, []); // ESLint warning: missing dependency

// ✅ 解決: useCallback でラップ
const loadHistory = useCallback(() => {
  const historyData = loadSummaryHistory();
  setHistory(historyData.items);
}, []);

useEffect(() => {
  loadHistory();
}, [loadHistory]);
```

#### LocalStorage エラー
```typescript
// ❌ 問題: プライベートモードでエラー
localStorage.setItem('key', 'value'); // DOMException

// ✅ 解決: try-catch で防御
const safeSetItem = (key: string, value: string) => {
  try {
    localStorage.setItem(key, value);
    return true;
  } catch (error) {
    console.warn('LocalStorage not available:', error);
    return false;
  }
};
```

### パフォーマンス問題

#### メモリリーク対策
```typescript
// ✅ ObjectURL の適切な管理
const urls: string[] = [];

const createObjectURL = (blob: Blob) => {
  const url = URL.createObjectURL(blob);
  urls.push(url);
  return url;
};

// クリーンアップ
useEffect(() => {
  return () => {
    urls.forEach(url => URL.revokeObjectURL(url));
    urls.length = 0;
  };
}, []);
```

#### 大量データの処理
```typescript
// ✅ バーチャルスクロール（将来的な改善案）
const VirtualizedHistory = () => {
  const [visibleItems, setVisibleItems] = useState<SummaryHistoryItem[]>([]);
  
  useEffect(() => {
    // 表示領域のアイテムのみをレンダリング
    const observer = new IntersectionObserver((entries) => {
      // 可視範囲の計算・更新
    });
    
    return () => observer.disconnect();
  }, []);
};
```

## 📊 コード品質・メトリクス

### 品質チェックリスト

#### コードレビュー前チェック
```bash
# 📝 型チェック
npm run type-check

# 📏 リンター
npm run lint

# 🧪 テスト
npm run test

# 🏗️ ビルド確認  
npm run build

# 📦 バンドルサイズ確認
npm run build:analyze
```

#### パフォーマンス指標
```markdown
目標値:
- First Contentful Paint (FCP): < 2秒
- Largest Contentful Paint (LCP): < 4秒  
- Time to Interactive (TTI): < 5秒
- Bundle Size: < 1MB (gzipped)

測定方法:
1. Chrome DevTools Lighthouse
2. webpack-bundle-analyzer
3. performance.measure() API
```

### 継続的改善

#### 定期的なリファクタリング対象
```markdown
月次チェック項目:
□ 依存関係の更新
□ 未使用コードの削除
□ TypeScript strict モードの段階的導入
□ パフォーマンス劣化の確認
□ セキュリティ脆弱性スキャン

四半期チェック項目:
□ アーキテクチャ見直し
□ 新しいベストプラクティスの導入
□ テストカバレッジ向上
□ ドキュメント更新
```

## 🤝 コントリビューション

### プルリクエストガイドライン

#### PR作成チェックリスト
```markdown
## 変更内容
- [ ] 機能追加 / バグ修正 / リファクタリング のいずれかを明記
- [ ] 変更の動機・背景を説明
- [ ] 既存機能への影響を評価

## テスト
- [ ] 新しいテストを追加（機能追加の場合）
- [ ] 既存テストが全て通過
- [ ] 手動テストを実施

## ドキュメント  
- [ ] README.mdを更新（必要に応じて）
- [ ] API変更時は API_SETUP.md を更新
- [ ] 新機能追加時は NEW_FEATURES.md を更新

## 技術的チェック
- [ ] TypeScript エラーなし
- [ ] ESLint エラーなし  
- [ ] ビルドが正常に完了
- [ ] パフォーマンスへの悪影響なし
```

### Issue報告ガイドライン

#### バグレポートテンプレート
```markdown
## 🐛 バグの概要
簡潔にバグの内容を説明してください。

## 📋 再現手順
1. ...
2. ...  
3. エラーが発生

## 🎯 期待する動作
正常な場合に期待される動作

## 😞 実際の動作
実際に起こった動作

## 🖥️ 環境情報
- OS: [Windows 11 / macOS 14 / Ubuntu 22.04]
- ブラウザ: [Chrome 120 / Firefox 118 / Safari 17]
- アプリバージョン: [v2.2.0]
- ファイル情報: [sample.mp3, 150MB]

## 📎 追加情報
- スクリーンショット
- ブラウザのコンソールエラー
- 関連するログ
```

### 機能要望テンプレート
```markdown  
## 💡 機能要望の概要
提案する機能を簡潔に説明してください。

## 🎯 動機・背景
なぜこの機能が必要なのか、どのような問題を解決するのか

## 📝 詳細な説明
具体的にどのような機能・動作を想定しているか

## 🎨 UI/UXのアイデア（任意）
画面設計やユーザー操作フローのアイデア

## 🔧 技術的な実装案（任意）
開発者向けの実装方法・技術選択のアイデア

## 📋 代替案
他に考えられるアプローチや解決方法
```

---

*最終更新: 2024年12月*  
*このドキュメントは爆速議事録 v2.2 の開発環境について説明しています*