import { useState, useEffect, useRef } from 'react';
import { FileText, Download, Loader2, Key, AlertCircle, Shield, Trash2, StopCircle, CheckCircle, XCircle, Clock, Sparkles, Copy } from 'lucide-react';
import { GeminiTranscriber, downloadTranscription } from '../utils/geminiTranscriber';
import { markdownToHtml, plainToHtml, buildHtmlDocument, copyHtmlToClipboard } from '../utils/format';
import type { TranscriptionResult, TranscriptionProgress } from '../utils/geminiTranscriber';
import type { SplitFile } from './DownloadList';
import { apiKeyStorage, localStorage, storage, storageMode } from '../utils/storage';

interface TranscriptionPanelProps {
  splitFiles: SplitFile[];
  isProcessing: boolean;
}

export function TranscriptionPanel({ splitFiles, isProcessing }: TranscriptionPanelProps) {
  const [apiKey, setApiKey] = useState('');
  const [isTranscribing, setIsTranscribing] = useState(false);
  const [transcriptionResults, setTranscriptionResults] = useState<TranscriptionResult[]>([]);
  const [currentProgress, setCurrentProgress] = useState<TranscriptionProgress>({ 
    current: 0, 
    total: 0, 
    status: '', 
    fileStates: new Map() 
  });
  const [error, setError] = useState<string | null>(null);
  const transcriberRef = useRef<GeminiTranscriber | null>(null);
  const [customPrompt, setCustomPrompt] = useState('');
  const [showPromptEditor, setShowPromptEditor] = useState(false);
  const [showSecurityInfo, setShowSecurityInfo] = useState(false);
  const [storageSettings, setStorageSettings] = useState({
    mode: storageMode.getMode()
  });
  const [concurrencySettings, setConcurrencySettings] = useState({
    enabled: false,
    count: 2,
    delay: 1000
  });
  const [summarySettings, setSummarySettings] = useState({
    customPrompt: '',
    showEditor: false,
    isProcessing: false,
    result: '',
    progress: '',
    currentStep: 0,
    totalSteps: 3
  });
  const [useMarkdown, setUseMarkdown] = useState<boolean>(() => {
    const saved = window.localStorage.getItem('summary_use_markdown');
    return saved === '1';
  });
  
  const defaultPrompt = `この音声ファイルの内容を正確に文字起こししてください。
以下の点に注意してください：
- 話者の発言を忠実に文字起こしする
- 適切な句読点を追加する
- 専門用語や固有名詞は正確に記載する
- フィラー語（えー、あのー等）は適度に省略して読みやすくする
- 複数の話者がいる場合は、話者を区別して記載する

文字起こし結果のみを出力してください。`;

  // フォーマットプリセット
  const formatPresets = {
    meeting: {
      name: '議事録形式',
      prompt: `以下の音声文字起こし結果を議事録形式でまとめてください。

要求事項：
- 日時、参加者、議題を明記（推測可能な場合）
- 主要な議論ポイントを箇条書きで整理
- 決定事項と次回のアクションアイテムを明確にする
- 話者が特定できる場合は発言者を明記
- 重要なキーワードは太字で強調

文字起こし結果：
{transcriptions}

上記を議事録として整理してください。`
    },
    summary: {
      name: '要約形式',
      prompt: `以下の音声文字起こし結果を簡潔に要約してください。

要求事項：
- 主要なポイントを3-5つに絞って整理
- 各ポイントは簡潔に1-2文で表現
- 結論や重要な決定事項を最後に記載
- 不要な詳細は省略し、本質的な内容に焦点を当てる

文字起こし結果：
{transcriptions}

上記の内容を要約してください。`
    },
    interview: {
      name: 'インタビュー形式',
      prompt: `以下の音声文字起こし結果をインタビュー記事の形式でまとめてください。

要求事項：
- Q&A形式で整理（可能な場合）
- インタビュイーの主要な発言を引用形式で記載
- 話の流れに沿って段落分けする
- 重要な発言は見出しとして抜き出す
- 背景情報があれば補足として追加

文字起こし結果：
{transcriptions}

上記をインタビュー記事として整理してください。`
    },
    lecture: {
      name: '講義ノート形式',
      prompt: `以下の音声文字起こし結果を講義ノート形式でまとめてください。

要求事項：
- 主要なトピックごとに見出しを設定
- 重要なポイントは箇条書きで整理
- キーワードや専門用語を明確にマーク
- 例や具体例があれば別途整理
- 学習のポイントを最後にまとめる

文字起こし結果：
{transcriptions}

上記を講義ノートとして整理してください。`
    }
  };

  // 初回読み込み時にストレージからデータを復元
  useEffect(() => {
    const savedApiKey = apiKeyStorage.get();
    const savedPrompt = localStorage.getCustomPrompt();
    
    if (savedApiKey) {
      setApiKey(savedApiKey);
    }
    if (savedPrompt) {
      setCustomPrompt(savedPrompt);
    }
  }, []);

  // APIキーの保存（モード対応）
  const handleApiKeyChange = (value: string) => {
    setApiKey(value);
    apiKeyStorage.save(value);
  };

  // ストレージモードの変更
  const handleStorageModeChange = (mode: 'session' | 'persistent' | 'none') => {
    const currentApiKey = apiKey;
    storageMode.setMode(mode);
    setStorageSettings({ mode });
    
    // 新しいモードで再保存
    if (currentApiKey) {
      apiKeyStorage.save(currentApiKey);
    }
  };

  // カスタムプロンプトの保存（ローカルストレージ）
  const handleCustomPromptChange = (value: string) => {
    setCustomPrompt(value);
    localStorage.saveCustomPrompt(value);
  };

  const clearStoredData = () => {
    storage.clearAll();
    setApiKey('');
    setCustomPrompt('');
  };

  const handleTranscribe = async () => {
    if (!apiKey) {
      setError('APIキーを入力してください');
      return;
    }

    if (splitFiles.length === 0) {
      setError('文字起こしする音声ファイルがありません');
      return;
    }

    setError(null);
    setIsTranscribing(true);
    setTranscriptionResults([]);
    
    try {
      const transcriber = new GeminiTranscriber(apiKey);
      transcriberRef.current = transcriber;
      
      const concurrency = concurrencySettings.enabled ? concurrencySettings.count : 1;
      const delay = concurrencySettings.delay;
      
      const results = await transcriber.transcribeMultipleBlobs(
        splitFiles.map(f => f.blob),
        splitFiles.map(f => f.name),
        (progress: TranscriptionProgress) => {
          setCurrentProgress(progress);
        },
        delay,
        customPrompt || undefined,
        concurrency
      );

      setTranscriptionResults(results);
    } catch (error) {
      console.error('Transcription error:', error);
      if (error instanceof Error && error.message !== 'キャンセルされました') {
        setError(error.message);
      } else {
        setError('処理に失敗しました');
      }
    } finally {
      setIsTranscribing(false);
      transcriberRef.current = null;
      setCurrentProgress({ current: 0, total: 0, status: '', fileStates: new Map() });
    }
  };

  const handleCancelTranscription = () => {
    if (transcriberRef.current) {
      transcriberRef.current.cancelTranscription();
    }
  };

  // まとめ処理
  const handleSummarize = async (preset?: keyof typeof formatPresets) => {
    if (!apiKey || transcriptionResults.length === 0) {
      setError('APIキーと文字起こし結果が必要です');
      return;
    }

    setSummarySettings(prev => ({ 
      ...prev, 
      isProcessing: true, 
      result: '',
      progress: '処理を開始しています...',
      currentStep: 0 
    }));
    setError(null);

    try {
      const transcriber = new GeminiTranscriber(apiKey);
      let formatPrompt = summarySettings.customPrompt;

      // プリセットが指定されている場合
      if (preset && formatPresets[preset]) {
        formatPrompt = formatPresets[preset].prompt;
        setSummarySettings(prev => ({ 
          ...prev, 
          progress: `${formatPresets[preset].name}形式で処理中...`,
          currentStep: 1 
        }));
      } else {
        setSummarySettings(prev => ({ 
          ...prev, 
          progress: 'カスタムプロンプトで処理中...',
          currentStep: 1 
        }));
      }

      // Step 2: 文字起こし結果を統合
      setSummarySettings(prev => ({ 
        ...prev, 
        progress: '文字起こし結果を統合しています...',
        currentStep: 2 
      }));

      // 出力形式の明示（デフォルト: プレーンテキスト）
      const outputDirectivePlain = `\n\n出力形式: プレーンテキスト。Markdown記法（#, *, -, 1., \`\`\`, _ など）は使用しない。\n箇条書きは「・」や「▼」などのテキスト記号で表現し、見出しはテキストのみで装飾（例: 【見出し】）とする。\n余分な説明や前置きは出力しない。`;
      const outputDirectiveMarkdown = `\n\n出力形式: Markdown。適切な見出し（#）、リスト（- / 1.）、強調（**）等を用いて整形し、余分な説明は出力しない。`;
      const promptWithFormat = (formatPrompt || '') + (useMarkdown ? outputDirectiveMarkdown : outputDirectivePlain);

      const summary = await transcriber.summarizeTranscriptions(
        transcriptionResults,
        promptWithFormat || undefined,
        (status: string) => {
          setSummarySettings(prev => ({ 
            ...prev, 
            progress: status,
            currentStep: 3 
          }));
        }
      );

      setSummarySettings(prev => ({ 
        ...prev, 
        result: summary,
        progress: 'まとめが完了しました！',
        currentStep: 3 
      }));
    } catch (error) {
      console.error('Summary error:', error);
      setError(error instanceof Error ? error.message : 'まとめ処理に失敗しました');
    } finally {
      setSummarySettings(prev => ({ ...prev, isProcessing: false }));
    }
  };

  const handleDownloadSummary = () => {
    if (summarySettings.result) {
      if (useMarkdown) {
        downloadTranscription(summarySettings.result, 'summary.md', 'text/markdown;charset=utf-8');
      } else {
        downloadTranscription(summarySettings.result, 'summary.txt', 'text/plain;charset=utf-8');
      }
    }
  };

  const handleCopySummary = async () => {
    if (!summarySettings.result) return;
    const htmlBody = useMarkdown
      ? markdownToHtml(summarySettings.result)
      : plainToHtml(summarySettings.result);
    await copyHtmlToClipboard(`<div>${htmlBody}</div>`, summarySettings.result);
  };

  const handleDownloadAsHtml = () => {
    if (!summarySettings.result) return;
    const htmlBody = useMarkdown
      ? markdownToHtml(summarySettings.result)
      : plainToHtml(summarySettings.result);
    const fullHtml = buildHtmlDocument(htmlBody, 'Summary');
    downloadTranscription(fullHtml, 'summary.html', 'text/html;charset=utf-8');
  };

  const handleDownloadTranscription = () => {
    if (transcriptionResults.length > 0) {
      const transcriber = new GeminiTranscriber();
      const formatted = transcriber.formatTranscriptions(transcriptionResults);
      downloadTranscription(formatted);
    }
  };

  const hasResults = transcriptionResults.length > 0;
  const successCount = transcriptionResults.filter(r => !r.error).length;

  return (
    <div className="bg-white rounded-2xl shadow-xl p-8 space-y-6">
      <div className="flex items-center gap-3">
        <FileText className="w-6 h-6 text-violet-600" />
        <h2 className="text-2xl font-bold text-gray-800">
          Gemini APIで文字起こし
        </h2>
      </div>

      {/* API Key Input */}
      <div className="space-y-2">
        <label htmlFor="api-key" className="flex items-center gap-2 text-sm font-medium text-gray-700">
          <Key className="w-4 h-4" />
          Gemini API キー
        </label>
        <input
          id="api-key"
          type="password"
          value={apiKey}
          onChange={(e) => handleApiKeyChange(e.target.value)}
          placeholder="AIzaSy..."
          className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-violet-500 focus:border-transparent"
          disabled={isTranscribing}
        />
        <p className="text-xs text-gray-500">
          <a 
            href="https://aistudio.google.com/app/apikey" 
            target="_blank" 
            rel="noopener noreferrer"
            className="text-violet-600 hover:underline"
          >
            Google AI Studio
          </a>
          でAPIキーを取得してください
        </p>
      </div>

      {/* Prompt Editor Toggle */}
      <div className="space-y-2">
        <button
          onClick={() => setShowPromptEditor(!showPromptEditor)}
          className="text-sm text-violet-600 hover:text-violet-700 font-medium"
        >
          {showPromptEditor ? '▼' : '▶'} プロンプトをカスタマイズ
        </button>
        
        {showPromptEditor && (
          <div className="space-y-2">
            <label htmlFor="custom-prompt" className="text-sm font-medium text-gray-700">
              カスタムプロンプト（空欄の場合はデフォルトを使用）
            </label>
            <textarea
              id="custom-prompt"
              value={customPrompt}
              onChange={(e) => handleCustomPromptChange(e.target.value)}
              placeholder={defaultPrompt}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-violet-500 focus:border-transparent h-32 font-mono text-sm"
              disabled={isTranscribing}
            />
            <div className="flex gap-2">
              <button
                onClick={() => handleCustomPromptChange(defaultPrompt)}
                className="text-xs text-gray-500 hover:text-gray-700"
              >
                デフォルトに戻す
              </button>
              <button
                onClick={() => handleCustomPromptChange('')}
                className="text-xs text-gray-500 hover:text-gray-700"
              >
                クリア
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Concurrency Settings */}
      <div className="space-y-3">
        <div className="space-y-2">
          <label className="text-sm font-medium text-gray-700">処理設定</label>
          <div className="space-y-3">
            <label className="flex items-center">
              <input
                type="checkbox"
                checked={concurrencySettings.enabled}
                onChange={(e) => setConcurrencySettings(prev => ({ ...prev, enabled: e.target.checked }))}
                className="mr-2"
                disabled={isTranscribing}
              />
              <span className="text-sm">並列処理を有効にする（高速化・API使用量増加）</span>
            </label>
            
            {concurrencySettings.enabled && (
              <div className="ml-6 space-y-2">
                <div>
                  <label className="text-xs text-gray-600">同時処理数</label>
                  <select
                    value={concurrencySettings.count}
                    onChange={(e) => setConcurrencySettings(prev => ({ ...prev, count: parseInt(e.target.value) }))}
                    className="ml-2 px-2 py-1 border border-gray-300 rounded text-sm"
                    disabled={isTranscribing}
                  >
                    <option value={2}>2個</option>
                    <option value={3}>3個</option>
                    <option value={4}>4個</option>
                    <option value={5}>5個</option>
                  </select>
                </div>
                
                <div>
                  <label className="text-xs text-gray-600">リクエスト間隔（ms）</label>
                  <select
                    value={concurrencySettings.delay}
                    onChange={(e) => setConcurrencySettings(prev => ({ ...prev, delay: parseInt(e.target.value) }))}
                    className="ml-2 px-2 py-1 border border-gray-300 rounded text-sm"
                    disabled={isTranscribing}
                  >
                    <option value={500}>500ms（高速）</option>
                    <option value={1000}>1000ms（標準）</option>
                    <option value={2000}>2000ms（安全）</option>
                    <option value={3000}>3000ms（保守的）</option>
                  </select>
                </div>
                
                <p className="text-xs text-orange-600">
                  ⚠️ 並列処理はAPI使用量が増加し、レート制限に引っかかる可能性があります
                </p>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Storage Settings */}
      <div className="space-y-3">
        <div className="space-y-2">
          <label className="text-sm font-medium text-gray-700">APIキー保存方式</label>
          <div className="space-y-2">
            <label className="flex items-center">
              <input
                type="radio"
                value="session"
                checked={storageSettings.mode === 'session'}
                onChange={(e) => handleStorageModeChange(e.target.value as any)}
                className="mr-2"
                disabled={isTranscribing}
              />
              <span className="text-sm">セッションのみ（タブを閉じると削除）🔒</span>
            </label>
            <label className="flex items-center">
              <input
                type="radio"
                value="persistent"
                checked={storageSettings.mode === 'persistent'}
                onChange={(e) => handleStorageModeChange(e.target.value as any)}
                className="mr-2"
                disabled={isTranscribing}
              />
              <span className="text-sm">永続保存（タブを閉じても保持）⚠️</span>
            </label>
            <label className="flex items-center">
              <input
                type="radio"
                value="none"
                checked={storageSettings.mode === 'none'}
                onChange={(e) => handleStorageModeChange(e.target.value as any)}
                className="mr-2"
                disabled={isTranscribing}
              />
              <span className="text-sm">保存しない（毎回入力）🛡️</span>
            </label>
          </div>
        </div>

        <button
          onClick={() => setShowSecurityInfo(!showSecurityInfo)}
          className="flex items-center gap-2 text-sm text-gray-600 hover:text-gray-700"
        >
          <Shield className="w-4 h-4" />
          {showSecurityInfo ? '▼' : '▶'} セキュリティ詳細
        </button>
        
        {showSecurityInfo && (
          <div className="p-3 bg-blue-50 border border-blue-200 rounded-lg text-sm">
            <div className="space-y-2">
              <p><strong>🔐 APIキー:</strong> {storage.getSecurityInfo().apiKeyStorage}</p>
              <p><strong>📝 カスタムプロンプト:</strong> ローカルストレージ（永続保存）</p>
              <p><strong>🛡️ 暗号化:</strong> 簡易難読化済み</p>
              <div className="mt-3 pt-2 border-t border-blue-300">
                <p className="text-blue-800 font-medium mb-2">推奨事項:</p>
                <ul className="text-blue-700 text-xs space-y-1">
                  {storage.getSecurityInfo().recommendations.map((rec, i) => (
                    <li key={i}>• {rec}</li>
                  ))}
                </ul>
              </div>
              <div className="mt-3">
                <button
                  onClick={clearStoredData}
                  className="flex items-center gap-1 px-3 py-1.5 bg-red-100 text-red-700 rounded text-xs hover:bg-red-200 transition-colors"
                >
                  <Trash2 className="w-3 h-3" />
                  すべてのデータをクリア
                </button>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Error Message */}
      {error && (
        <div className="flex items-center gap-2 p-3 bg-red-50 border border-red-200 rounded-lg">
          <AlertCircle className="w-5 h-5 text-red-600 flex-shrink-0" />
          <p className="text-sm text-red-700">{error}</p>
        </div>
      )}

      {/* Transcribe Button */}
      <div className="flex gap-2">
        <button
          onClick={handleTranscribe}
          disabled={!apiKey || splitFiles.length === 0 || isTranscribing || isProcessing}
          className="flex-1 px-6 py-3 bg-gradient-to-r from-violet-600 to-purple-600 text-white font-semibold rounded-xl hover:from-violet-700 hover:to-purple-700 disabled:opacity-50 disabled:cursor-not-allowed transition-all duration-200 flex items-center justify-center gap-2"
        >
          {isTranscribing ? (
            <>
              <Loader2 className="w-5 h-5 animate-spin" />
              文字起こし中... {currentProgress.current}/{currentProgress.total}
            </>
          ) : (
            <>
              <FileText className="w-5 h-5" />
              文字起こしを開始 ({splitFiles.length}ファイル)
            </>
          )}
        </button>
        
        {isTranscribing && (
          <button
            onClick={handleCancelTranscription}
            className="px-4 py-3 bg-red-600 text-white font-semibold rounded-xl hover:bg-red-700 transition-colors flex items-center justify-center gap-2"
          >
            <StopCircle className="w-5 h-5" />
            中止
          </button>
        )}
      </div>

      {/* Progress Status and File States */}
      {isTranscribing && (
        <div className="space-y-3">
          <div className="p-3 bg-blue-50 border border-blue-200 rounded-lg">
            <p className="text-sm text-blue-700 font-medium">{currentProgress.status}</p>
          </div>
          
          {/* Individual File States */}
          {currentProgress.fileStates.size > 0 && (
            <div className="space-y-2">
              <p className="text-sm font-medium text-gray-700">各ファイルの状態</p>
              <div className="grid gap-2">
                {Array.from(currentProgress.fileStates.entries()).map(([partNumber, result]) => (
                  <div key={partNumber} className="flex items-center justify-between p-2 bg-gray-50 rounded-lg">
                    <div className="flex items-center gap-2">
                      <div className="flex items-center gap-1">
                        {result.status === 'pending' && <Clock className="w-4 h-4 text-gray-400" />}
                        {result.status === 'processing' && <Loader2 className="w-4 h-4 text-blue-500 animate-spin" />}
                        {result.status === 'completed' && <CheckCircle className="w-4 h-4 text-green-500" />}
                        {result.status === 'error' && <XCircle className="w-4 h-4 text-red-500" />}
                        {result.status === 'cancelled' && <StopCircle className="w-4 h-4 text-orange-500" />}
                      </div>
                      <span className="text-sm text-gray-700">{result.fileName}</span>
                    </div>
                    <div className="text-xs text-gray-500">
                      {result.status === 'pending' && '待機中'}
                      {result.status === 'processing' && '処理中'}
                      {result.status === 'completed' && '完了'}
                      {result.status === 'error' && 'エラー'}
                      {result.status === 'cancelled' && 'キャンセル'}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {/* Results */}
      {hasResults && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <div className="text-sm text-gray-600">
              完了: {successCount}/{transcriptionResults.length} ファイル
            </div>
            <button
              onClick={handleDownloadTranscription}
              className="px-4 py-2 bg-green-600 text-white font-medium rounded-lg hover:bg-green-700 transition-colors flex items-center gap-2"
            >
              <Download className="w-4 h-4" />
              文字起こし結果をダウンロード
            </button>
          </div>

          {/* Summary Section */}
          <div className="space-y-4 p-6 bg-gradient-to-r from-purple-50 to-pink-50 rounded-lg border border-purple-200">
            <div className="flex items-center gap-2">
              <Sparkles className="w-6 h-6 text-purple-600" />
              <h3 className="text-xl font-bold text-gray-800">✨ Gemini APIでまとめ</h3>
            </div>
            
            {/* Processing Status */}
            {summarySettings.isProcessing && (
              <div className="space-y-3 p-4 bg-white rounded-lg border border-purple-300">
                <div className="flex items-center gap-2">
                  <Loader2 className="w-5 h-5 text-purple-600 animate-spin" />
                  <span className="font-medium text-purple-800">まとめ処理中...</span>
                </div>
                
                {/* Progress Bar */}
                <div className="space-y-2">
                  <div className="flex justify-between text-sm text-gray-600">
                    <span>ステップ {summarySettings.currentStep}/{summarySettings.totalSteps}</span>
                    <span>{Math.round((summarySettings.currentStep / summarySettings.totalSteps) * 100)}%</span>
                  </div>
                  <div className="w-full bg-gray-200 rounded-full h-2">
                    <div 
                      className="bg-gradient-to-r from-purple-500 to-pink-500 h-2 rounded-full transition-all duration-300"
                      style={{ width: `${(summarySettings.currentStep / summarySettings.totalSteps) * 100}%` }}
                    ></div>
                  </div>
                  <p className="text-sm text-purple-700 font-medium">{summarySettings.progress}</p>
                </div>

                {/* Processing Steps */}
                <div className="grid grid-cols-3 gap-2">
                  {['準備', '統合', 'AI処理'].map((step, index) => (
                    <div key={index} className={`text-xs text-center p-2 rounded ${
                      summarySettings.currentStep > index 
                        ? 'bg-purple-100 text-purple-800 font-semibold' 
                        : summarySettings.currentStep === index
                        ? 'bg-purple-200 text-purple-900 font-semibold animate-pulse'
                        : 'bg-gray-100 text-gray-500'
                    }`}>
                      {step}
                    </div>
                  ))}
                </div>
              </div>
            )}
            
            {/* Preset Buttons & Markdown Toggle */}
            {!summarySettings.isProcessing && (
              <>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                  {Object.entries(formatPresets).map(([key, preset]) => (
                    <button
                      key={key}
                      onClick={() => handleSummarize(key as keyof typeof formatPresets)}
                      disabled={!apiKey}
                      className="px-4 py-3 bg-white border border-purple-300 text-purple-700 rounded-lg hover:bg-purple-50 hover:border-purple-400 disabled:opacity-50 disabled:cursor-not-allowed transition-all text-sm font-medium shadow-sm hover:shadow-md"
                    >
                      {preset.name}
                    </button>
                  ))}
                </div>

                <label className="mt-1 flex items-center gap-2 text-sm text-gray-700">
                  <input
                    type="checkbox"
                    className="rounded border-gray-300 text-purple-600 focus:ring-purple-500"
                    checked={useMarkdown}
                    onChange={(e) => {
                      setUseMarkdown(e.target.checked);
                      window.localStorage.setItem('summary_use_markdown', e.target.checked ? '1' : '0');
                    }}
                    disabled={summarySettings.isProcessing}
                  />
                  Markdown形式にする
                </label>

                <div className="space-y-3">
                  <button
                    onClick={() => setSummarySettings(prev => ({ ...prev, showEditor: !prev.showEditor }))}
                    className="text-sm text-purple-600 hover:text-purple-700 font-medium flex items-center gap-1"
                  >
                    {summarySettings.showEditor ? '▼' : '▶'} カスタムプロンプトで実行
                  </button>
                  
                  {summarySettings.showEditor && (
                    <div className="space-y-3 p-4 bg-white rounded-lg border border-purple-200">
                      <textarea
                        value={summarySettings.customPrompt}
                        onChange={(e) => setSummarySettings(prev => ({ ...prev, customPrompt: e.target.value }))}
                        placeholder="例: この会話を営業報告書の形式でまとめてください。顧客の反応、課題、次のアクションを明確にしてください。"
                        className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent h-24 font-mono text-sm resize-none"
                      />
                      <button
                        onClick={() => handleSummarize()}
                        disabled={!summarySettings.customPrompt || !apiKey}
                        className="px-6 py-3 bg-gradient-to-r from-purple-600 to-pink-600 text-white font-medium rounded-lg hover:from-purple-700 hover:to-pink-700 disabled:opacity-50 disabled:cursor-not-allowed transition-all flex items-center gap-2 shadow-lg hover:shadow-xl"
                      >
                        <Sparkles className="w-4 h-4" />
                        カスタムまとめ実行
                      </button>
                    </div>
                  )}
                </div>
              </>
            )}

            {/* Summary Result */}
            {summarySettings.result && (
              <div className="space-y-3 p-4 bg-white rounded-lg border border-purple-300">
                <div className="flex items-center justify-between">
                  <h4 className="font-semibold text-gray-800 flex items-center gap-2">
                    <CheckCircle className="w-5 h-5 text-green-500" />
                    まとめ結果
                  </h4>
                  <div className="flex gap-2 flex-wrap justify-end">
                    <button
                      onClick={handleCopySummary}
                      className="px-4 py-2 bg-purple-600 text-white font-medium rounded-lg hover:bg-purple-700 transition-all flex items-center gap-2 shadow-md hover:shadow-lg"
                    >
                      <Copy className="w-4 h-4" />
                      コピー
                    </button>
                    <button
                      onClick={handleDownloadSummary}
                      className="px-4 py-2 bg-gradient-to-r from-purple-600 to-pink-600 text-white font-medium rounded-lg hover:from-purple-700 hover:to-pink-700 transition-all flex items-center gap-2 shadow-md hover:shadow-lg"
                    >
                      <Download className="w-4 h-4" />
                      ダウンロード
                    </button>
                    <button
                      onClick={handleDownloadAsHtml}
                      className="px-4 py-2 bg-gradient-to-r from-purple-600 to-pink-600 text-white font-medium rounded-lg hover:from-purple-700 hover:to-pink-700 transition-all flex items-center gap-2 shadow-md hover:shadow-lg"
                    >
                      <Download className="w-4 h-4" />
                      HTMLでダウンロード
                    </button>
                  </div>
                </div>
                <div className="max-h-64 overflow-y-auto border border-purple-200 rounded-lg p-4 bg-gray-50">
                  <pre className="text-sm text-gray-700 whitespace-pre-wrap leading-relaxed">{summarySettings.result}</pre>
                </div>
              </div>
            )}
          </div>

          {/* Transcription Preview */}
          <div className="max-h-96 overflow-y-auto border border-gray-200 rounded-lg p-4 space-y-4">
            {transcriptionResults.map((result) => (
              <div key={result.partNumber} className="space-y-2">
                <h3 className="font-semibold text-gray-800">
                  パート {result.partNumber}: {result.fileName}
                </h3>
                {result.error ? (
                  <p className="text-sm text-red-600">エラー: {result.error}</p>
                ) : (
                  <p className="text-sm text-gray-700 whitespace-pre-wrap">
                    {result.transcription.slice(0, 200)}
                    {result.transcription.length > 200 && '...'}
                  </p>
                )}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
