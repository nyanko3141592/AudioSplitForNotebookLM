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
  transcriptionBackgroundInfo?: string;
  onDownloadSplit?: (file: SplitFile) => void;
  onDownloadAllSplits?: () => void;
  onDownloadTranscription?: () => void;
  onBackgroundInfoChange?: (backgroundInfo: string) => void;
  presetApiKey?: string;
}

export function SummaryStep({ 
  transcriptionResults,
  splitFiles = [],
  transcriptionBackgroundInfo = '',
  onDownloadSplit,
  onDownloadAllSplits,
  onDownloadTranscription,
  onBackgroundInfoChange,
  presetApiKey = ''
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
      prompt: `役割と目標：
* ユーザーの会議内容に基づいて、正確かつ詳細な議事録を作成すること。
* 決定事項、ネクストアクション、メモ（会話のテーマごとに整理）を明確に記録すること。
* 作成された議事録が見やすく、理解しやすい形式であること。

振る舞いとルール：
1) 初期設定：
a) ユーザーに議事録作成の専門家として挨拶する。
b) ユーザーに議事録の作成方法について理解していることを伝える。
c) ユーザーから提供された会議内容（または作成方法の指示）に基づいて議事録を作成する準備ができていることを示す。

2) 議事録の作成：
a) ユーザーが指定した形式（箇条書き、表など）で議事録を作成する。
b) 決定事項は「▼決まったこと」として明確に箇条書きで記述する。
c) ネクストアクションは「▼Next Action」として、担当者や期限が明記されていればそれらを含めて記述する。
d) メモは会話の主要なテーマごとに整理し、「▼Memo」以下に記述する。各テーマの中で、関連する発言や議論の内容を簡潔に箇条書きで記述する。
e) 曖昧な表現や不明確な点は避け、客観的な事実に基づいて記述する。
f) 必要に応じて、時間の経過や発言者の変更を記録する。

3) 出力と確認：
a) 作成した議事録をユーザーに提示する。
b) ユーザーに議事録の内容を確認してもらい、必要に応じて修正や追記を行う。
c) ユーザーからのフィードバックを真摯に受け止め、議事録の質を向上させる。

全体的なトーン：
* 専門的かつ丁寧な言葉遣いを心がける。
* 冷静かつ客観的な視点で議事録を作成する。
* ユーザーの指示を正確に理解し、迅速に対応する。

文字起こし結果：
{transcriptions}

上記の会議内容から議事録を作成してください。`
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
    // preset APIキーがある場合はそれを使用、なければストレージから読み込み
    if (presetApiKey) {
      setApiKey(presetApiKey);
      setShowApiKeyInput(false);
    } else {
      const savedApiKey = apiKeyStorage.get();
      if (savedApiKey) {
        setApiKey(savedApiKey);
        setShowApiKeyInput(false);
      } else {
        setShowApiKeyInput(true);
      }
    }
    
    const savedPrompt = localStorage.getSummaryCustomPrompt();
    const savedBackgroundInfo = localStorage.getSummaryBackgroundInfo();
    
    // デフォルトプロンプトを設定
    const defaultPrompt = formatPresets.summary.prompt;
    if (savedPrompt) {
      setSummarySettings(prev => ({ ...prev, customPrompt: savedPrompt }));
    } else {
      setSummarySettings(prev => ({ ...prev, customPrompt: defaultPrompt }));
    }
    
    // 文字起こしの背景情報を引き継ぐ
    const backgroundToUse = transcriptionBackgroundInfo || savedBackgroundInfo || '';
    setSummarySettings(prev => ({ ...prev, backgroundInfo: backgroundToUse }));
    if (backgroundToUse) {
      localStorage.saveSummaryBackgroundInfo(backgroundToUse);
    }
  }, [transcriptionBackgroundInfo, presetApiKey]);

  // 自動的にまとめを実行（APIキーがあり、結果がない場合）
  useEffect(() => {
    if (apiKey && transcriptionResults.length > 0 && !summarySettings.result && !summarySettings.isProcessing && !error) {
      // プロンプトが空の場合はデフォルトを設定
      if (!summarySettings.customPrompt) {
        setSummarySettings(prev => ({ ...prev, customPrompt: formatPresets.summary.prompt }));
      }
      setTimeout(() => {
        handleSummarize();
      }, 500);
    }
  }, [apiKey, transcriptionResults, summarySettings.customPrompt]); // eslint-disable-line react-hooks/exhaustive-deps

  const handleCustomPromptChange = (value: string) => {
    setSummarySettings(prev => ({ ...prev, customPrompt: value }));
    localStorage.saveSummaryCustomPrompt(value);
  };

  const handleBackgroundInfoChange = (value: string) => {
    setSummarySettings(prev => ({ ...prev, backgroundInfo: value }));
    localStorage.saveSummaryBackgroundInfo(value);
    onBackgroundInfoChange?.(value);
  };
  
  const handlePresetSelect = (presetKey: keyof typeof formatPresets) => {
    const preset = formatPresets[presetKey];
    setSummarySettings(prev => ({ ...prev, customPrompt: preset.prompt }));
    localStorage.saveSummaryCustomPrompt(preset.prompt);
  };

  const clearBackgroundInfo = () => {
    setSummarySettings(prev => ({ ...prev, backgroundInfo: '' }));
    localStorage.saveSummaryBackgroundInfo('');
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
      description={apiKey ? "文字起こし結果を自動的にまとめます" : "APIキーを設定してまとめを開始"}
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
      {!presetApiKey && (showApiKeyInput ? (
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
      ))}


      {/* まとめ形式選択 - 常時表示 */}
      <div className="space-y-3">
        <label className="text-sm font-medium text-gray-700">
          まとめ形式プリセット
        </label>
        <div className="grid grid-cols-2 gap-2">
          {Object.entries(formatPresets).map(([key, preset]) => (
            <button
              key={key}
              onClick={() => handlePresetSelect(key as keyof typeof formatPresets)}
              disabled={summarySettings.isProcessing}
              className={`px-3 py-2 rounded-lg transition-all text-sm font-medium disabled:opacity-50 disabled:cursor-not-allowed ${
                summarySettings.customPrompt === preset.prompt
                  ? 'bg-purple-100 border-2 border-purple-500 text-purple-700'
                  : 'bg-white border border-gray-300 text-gray-700 hover:bg-gray-50 hover:border-purple-400'
              }`}
            >
              {preset.name}
            </button>
          ))}
        </div>
      </div>

      {/* カスタムプロンプト - 常時表示 */}
      <div className="space-y-2">
        <label className="text-sm font-medium text-gray-700">
          カスタムプロンプト
        </label>
        <textarea
          value={summarySettings.customPrompt}
          onChange={(e) => handleCustomPromptChange(e.target.value)}
          placeholder="カスタムプロンプトを入力してください..."
          className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent min-h-32 text-sm resize-y font-mono"
          disabled={summarySettings.isProcessing}
        />
        <p className="text-xs text-gray-500">
          上のプリセットボタンでプロンプトを選択するか、直接カスタムプロンプトを入力できます
        </p>
      </div>

      {/* 背景情報入力 - 常時表示 */}
      <div className="space-y-2">
        <label className="text-sm font-medium text-gray-700 flex items-center gap-1">
          <Info className="w-4 h-4" />
          背景情報（オプション）
        </label>
        <textarea
          value={summarySettings.backgroundInfo}
          onChange={(e) => handleBackgroundInfoChange(e.target.value)}
          placeholder="例: 2024年1月26日の定例会議。参加者：田中、佐藤、鈴木。議題：新商品の戦略"
          className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent min-h-16 text-sm resize-y"
          disabled={summarySettings.isProcessing}
        />
        <p className="text-xs text-gray-500">
          会議の日時、参加者、目的などを入力するとまとめの精度が向上します
        </p>
      </div>
      
      {/* まとめ実行ボタン */}
      {!summarySettings.isProcessing && !summarySettings.result && apiKey && (
        <div className="flex justify-center">
          <button
            onClick={() => handleSummarize()}
            className="px-8 py-3 bg-gradient-to-r from-purple-600 to-pink-600 text-white font-semibold rounded-xl hover:from-purple-700 hover:to-pink-700 transition-all duration-200 flex items-center gap-2 shadow-lg hover:shadow-xl"
          >
            <Sparkles className="w-5 h-5" />
            まとめを作成
          </button>
        </div>
      )}

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
      
      {/* まとめ再実行ボタン */}
      {!summarySettings.isProcessing && summarySettings.result && (
        <div className="flex justify-center">
          <button
            onClick={() => {
              setSummarySettings(prev => ({ ...prev, result: '' }));
              setTimeout(() => handleSummarize(), 100);
            }}
            className="px-8 py-3 bg-gradient-to-r from-purple-600 to-pink-600 text-white font-semibold rounded-xl hover:from-purple-700 hover:to-pink-700 transition-all duration-200 flex items-center gap-2 shadow-lg hover:shadow-xl"
          >
            <RefreshCw className="w-5 h-5" />
            まとめを再実行
          </button>
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