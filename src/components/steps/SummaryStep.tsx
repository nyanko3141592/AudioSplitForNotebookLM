import { useState, useEffect } from 'react';
import { Sparkles, Download, Loader2, AlertCircle, CheckCircle, Info, RefreshCw, Copy, Key } from 'lucide-react';
import { GeminiTranscriber, downloadTranscription } from '../../utils/geminiTranscriber';
import type { TranscriptionResult } from '../../utils/geminiTranscriber';
import { apiKeyStorage, localStorage } from '../../utils/storage';
import { StepContent } from '../StepContent';
import { ResultsSummary } from '../ResultsSummary';
import type { SplitFile } from '../DownloadList';

interface SummaryStepProps {
  transcriptionResults: TranscriptionResult[];
  splitFiles?: SplitFile[];
  onDownloadSplit?: (file: SplitFile) => void;
  onDownloadAllSplits?: () => void;
  onDownloadTranscription?: () => void;
}

export function SummaryStep({ 
  transcriptionResults,
  splitFiles = [],
  onDownloadSplit,
  onDownloadAllSplits,
  onDownloadTranscription
}: SummaryStepProps) {
  const [apiKey, setApiKey] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [summarySettings, setSummarySettings] = useState({
    customPrompt: '',
    backgroundInfo: '',
    isProcessing: false,
    result: '',
    progress: '',
    currentStep: 0,
    totalSteps: 3
  });
  const [showApiKeyInput, setShowApiKeyInput] = useState(false);

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

  useEffect(() => {
    const savedApiKey = apiKeyStorage.get();
    const savedPrompt = localStorage.getSummaryCustomPrompt();
    
    if (savedApiKey) {
      setApiKey(savedApiKey);
      setShowApiKeyInput(false); // APIキーがある場合は非表示
    } else {
      setShowApiKeyInput(true); // APIキーがない場合は表示
    }
    
    if (savedPrompt) {
      setSummarySettings(prev => ({ ...prev, customPrompt: savedPrompt }));
    }
  }, []);

  const handleCustomPromptChange = (value: string) => {
    setSummarySettings(prev => ({ ...prev, customPrompt: value }));
    localStorage.saveSummaryCustomPrompt(value);
  };

  const clearBackgroundInfo = () => {
    setSummarySettings(prev => ({ ...prev, backgroundInfo: '' }));
  };

  const handleCopySummary = () => {
    if (summarySettings.result) {
      navigator.clipboard.writeText(summarySettings.result);
      // TODO: Add toast notification for copy success
    }
  };

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
      
      // 背景情報をプロンプトに追加（プリセット・カスタム両方対応）
      if (summarySettings.backgroundInfo) {
        const backgroundContext = `

## 追加情報・背景
${summarySettings.backgroundInfo}

上記の背景情報を踏まえて、文字起こし結果をまとめてください。
`;
        if (formatPrompt && formatPrompt.includes('{transcriptions}')) {
          formatPrompt = formatPrompt.replace('{transcriptions}', backgroundContext + '\n{transcriptions}');
        } else if (formatPrompt) {
          // {transcriptions}プレースホルダーがない場合
          formatPrompt = backgroundContext + '\n\n' + formatPrompt;
        } else {
          // プロンプトが空の場合
          formatPrompt = backgroundContext;
        }
      }

      // Step 2: 文字起こし結果を統合
      setSummarySettings(prev => ({ 
        ...prev, 
        progress: '文字起こし結果を統合しています...',
        currentStep: 2 
      }));

      const summary = await transcriber.summarizeTranscriptions(
        transcriptionResults,
        formatPrompt || undefined,
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
      downloadTranscription(summarySettings.result, 'summary.md');
    }
  };

  if (transcriptionResults.length === 0) {
    return (
      <StepContent
        title="✨ まとめ"
        description="文字起こし結果がありません"
        showNext={false}
      >
        <div className="text-center py-8 text-gray-500">
          前のステップで文字起こしを完了してください
        </div>
      </StepContent>
    );
  }

  return (
    <StepContent
      title="✨ まとめ"
      description="Gemini APIを使用して文字起こし結果をまとめます"
      showNext={false}
    >
      {/* Previous Results Summary */}
      <ResultsSummary
        splitFiles={splitFiles}
        transcriptionResults={transcriptionResults}
        onDownloadSplit={onDownloadSplit}
        onDownloadAllSplits={onDownloadAllSplits}
        onDownloadTranscription={onDownloadTranscription}
        compact
      />

      {/* API Key Status/Input */}
      {showApiKeyInput ? (
        <div className="space-y-2">
          <label className="flex items-center gap-2 text-sm font-medium text-gray-700">
            <Key className="w-4 h-4" />
            Gemini API キー
          </label>
          <input
            type="password"
            value={apiKey}
            onChange={(e) => setApiKey(e.target.value)}
            placeholder="AIzaSy..."
            className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent"
          />
          <p className="text-xs text-gray-500">
            <a 
              href="https://aistudio.google.com/app/apikey" 
              target="_blank" 
              rel="noopener noreferrer"
              className="text-purple-600 hover:underline"
            >
              Google AI Studio
            </a>
            でAPIキーを取得してください
          </p>
        </div>
      ) : (
        <div className="flex items-center justify-between p-3 bg-green-50 border border-green-200 rounded-lg">
          <div className="flex items-center gap-2">
            <CheckCircle className="w-5 h-5 text-green-600" />
            <span className="text-sm font-medium text-green-800">APIキー設定済み</span>
          </div>
          <button
            onClick={() => setShowApiKeyInput(true)}
            className="text-xs text-green-700 hover:text-green-800 underline"
          >
            変更
          </button>
        </div>
      )}

      {/* プロンプト入力 - 必須 */}
      <div className="space-y-2">
        <label className="text-sm font-medium text-purple-900 flex items-center gap-1">
          プロンプト <span className="text-red-500">*</span>
        </label>
        <div className="p-3 bg-blue-50 border border-blue-200 rounded-lg mb-2">
          <p className="text-sm text-blue-800">
            <strong>重要：</strong> プロンプトには必ず <code className="bg-blue-100 px-1 rounded">{"{transcriptions}"}</code> を含めてください。
            この部分が実際の文字起こし結果に置き換えられます。
          </p>
        </div>
        <textarea
          value={summarySettings.customPrompt}
          onChange={(e) => handleCustomPromptChange(e.target.value)}
          placeholder="例: 以下の会議内容を営業報告書の形式でまとめてください。

文字起こし結果：
{transcriptions}

上記の内容から、顧客の反応、課題、次のアクションを明確にしてまとめてください。"
          className="w-full px-4 py-3 border border-purple-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent h-40 font-mono text-sm resize-none"
          disabled={summarySettings.isProcessing}
          required
        />
        <div className="flex justify-between items-center">
          <button
            onClick={() => handleCustomPromptChange('')}
            className="text-xs text-purple-600 hover:text-purple-700"
            disabled={summarySettings.isProcessing}
          >
            クリア
          </button>
          <div className="text-xs text-gray-500">
            {summarySettings.customPrompt.includes('{transcriptions}') ? (
              <span className="text-green-600 flex items-center gap-1">
                <CheckCircle className="w-3 h-3" />
                {"{transcriptions}"} が含まれています
              </span>
            ) : (
              <span className="text-red-600 flex items-center gap-1">
                <AlertCircle className="w-3 h-3" />
                {"{transcriptions}"} が必要です
              </span>
            )}
          </div>
        </div>
      </div>

      {/* プリセットボタン */}
      {!summarySettings.isProcessing && (
        <div className="space-y-2">
          <label className="text-sm font-medium text-gray-700">
            プリセットを選択（プロンプトに自動入力されます）
          </label>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
            {Object.entries(formatPresets).map(([key, preset]) => (
              <button
                key={key}
                onClick={() => setSummarySettings(prev => ({ ...prev, customPrompt: preset.prompt }))}
                className="px-3 py-2 bg-white border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 hover:border-purple-400 transition-all text-xs font-medium shadow-sm hover:shadow-md"
              >
                {preset.name}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* 背景情報入力 - 必須 */}
      <div className="space-y-2 p-4 bg-purple-50 rounded-lg border border-purple-200">
        <div className="flex items-center justify-between">
          <label className="text-sm font-medium text-purple-900 flex items-center gap-1">
            <Info className="w-4 h-4" />
            背景情報 <span className="text-red-500">*</span>
          </label>
          <button
            onClick={clearBackgroundInfo}
            className="text-xs text-purple-600 hover:text-purple-700 flex items-center gap-1"
            disabled={summarySettings.isProcessing}
          >
            <RefreshCw className="w-3 h-3" />
            クリア
          </button>
        </div>
        <textarea
          value={summarySettings.backgroundInfo}
          onChange={(e) => setSummarySettings(prev => ({ ...prev, backgroundInfo: e.target.value }))}
          placeholder="例: 2024年1月26日の定例会議です。参加者：田中（営業部長）、佐藤（マーケティング）、鈴木（開発）。今四半期の売上目標達成状況と来四半期の戦略について議論しました。"
          className="w-full px-4 py-3 border border-purple-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent h-24 font-mono text-sm resize-none bg-white"
          disabled={summarySettings.isProcessing}
          required
        />
        <p className="text-xs text-purple-600">
          ※ 会議の日時、参加者、目的など、文字起こし結果に含まれない情報を入力してください
        </p>
      </div>

      {/* Processing Status */}
      {summarySettings.isProcessing && (
        <div className="space-y-3 p-4 bg-purple-50 rounded-lg border border-purple-300">
          <div className="flex items-center gap-2">
            <Loader2 className="w-5 h-5 text-purple-600 animate-spin" />
            <span className="font-medium text-purple-800">まとめ処理中...</span>
          </div>
          
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
      
      {/* まとめ実行ボタン */}
      {!summarySettings.isProcessing && (
        <div className="flex justify-center">
          <button
            onClick={() => handleSummarize()}
            disabled={!summarySettings.customPrompt || !summarySettings.backgroundInfo || !apiKey || !summarySettings.customPrompt.includes('{transcriptions}')}
            className="px-8 py-4 bg-gradient-to-r from-purple-600 to-pink-600 text-white font-bold text-lg rounded-lg hover:from-purple-700 hover:to-pink-700 disabled:opacity-50 disabled:cursor-not-allowed transition-all flex items-center gap-3 shadow-lg hover:shadow-xl"
          >
            <Sparkles className="w-5 h-5" />
            まとめを実行
          </button>
        </div>
      )}
      
      {/* 必須項目の注意書き */}
      {(!summarySettings.customPrompt || !summarySettings.backgroundInfo || !summarySettings.customPrompt.includes('{transcriptions}')) && !summarySettings.isProcessing && (
        <div className="text-center text-sm text-gray-500 space-y-1">
          <div>※ 以下の項目を確認してください：</div>
          <div className="text-xs space-y-1">
            {!summarySettings.customPrompt && <div>• プロンプトを入力してください</div>}
            {summarySettings.customPrompt && !summarySettings.customPrompt.includes('{transcriptions}') && <div>• プロンプトに {"{transcriptions}"} を含めてください</div>}
            {!summarySettings.backgroundInfo && <div>• 背景情報を入力してください</div>}
          </div>
        </div>
      )}

      {/* Error Message */}
      {error && (
        <div className="flex items-center gap-2 p-3 bg-red-50 border border-red-200 rounded-lg">
          <AlertCircle className="w-5 h-5 text-red-600 flex-shrink-0" />
          <p className="text-sm text-red-700">{error}</p>
        </div>
      )}

      {/* Summary Result */}
      {summarySettings.result && (
        <div className="space-y-3 p-4 bg-purple-50 rounded-lg border border-purple-300">
          <div className="flex items-center justify-between">
            <h4 className="font-semibold text-gray-800 flex items-center gap-2">
              <CheckCircle className="w-5 h-5 text-green-500" />
              まとめ結果
            </h4>
            <div className="flex gap-2">
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
            </div>
          </div>
          <div className="max-h-64 overflow-y-auto border border-purple-200 rounded-lg p-4 bg-white">
            <pre className="text-sm text-gray-700 whitespace-pre-wrap leading-relaxed">{summarySettings.result}</pre>
          </div>
        </div>
      )}

      <div className="p-4 bg-green-50 border border-green-200 rounded-lg">
        <p className="text-sm text-green-800">
          🎉 お疲れさまでした！すべての処理が完了しています。
          結果をダウンロードしてNotebookLMなどでご活用ください。
        </p>
      </div>
    </StepContent>
  );
}