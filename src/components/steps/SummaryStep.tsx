import { useState, useEffect } from 'react';
import { Sparkles, Download, Loader2, AlertCircle, CheckCircle, Info, RefreshCw, Copy, Key } from 'lucide-react';
import { GeminiTranscriber, downloadTranscription } from '../../utils/geminiTranscriber';
import { markdownToHtml, plainToHtml, buildHtmlDocument, copyHtmlToClipboard } from '../../utils/format';
import type { TranscriptionResult } from '../../utils/geminiTranscriber';
import { apiKeyStorage, localStorage, apiEndpointStorage } from '../../utils/storage';

interface SummaryStepProps {
  transcriptionResults: TranscriptionResult[];
  transcriptionBackgroundInfo?: string;
  onBackgroundInfoChange?: (backgroundInfo: string) => void;
  presetApiKey?: string;
  presetApiEndpoint?: string;
}

export function SummaryStep({ 
  transcriptionResults,
  transcriptionBackgroundInfo = '',
  onBackgroundInfoChange,
  presetApiKey = '',
  presetApiEndpoint = ''
}: SummaryStepProps) {
  const [apiKey, setApiKey] = useState('');
  const [selectedModel, setSelectedModel] = useState('gemini-2.0-flash-lite');
  const [apiEndpoint, setApiEndpoint] = useState('https://generativelanguage.googleapis.com');
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
  const [useMarkdown, setUseMarkdown] = useState<boolean>(() => {
    const saved = window.localStorage.getItem('summary_use_markdown');
    return saved === '1';
  });
  const [showApiKeyInput, setShowApiKeyInput] = useState(false);
  const [actualSummaryCost, setActualSummaryCost] = useState<number | null>(null);

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
    
    // モデル選択の復元
    const savedModel = window.localStorage.getItem('summary_model');
    if (savedModel) {
      setSelectedModel(savedModel);
    }

    // APIエンドポイント設定を読み込み（presetがある場合はそれを優先）
    if (presetApiEndpoint) {
      setApiEndpoint(presetApiEndpoint);
    } else {
      const savedEndpoint = apiEndpointStorage.get();
      setApiEndpoint(savedEndpoint);
    }
    
    const savedPrompt = localStorage.getSummaryCustomPrompt();
    
    // 保存されたプロンプトがある場合はそれを使用、なければ議事録プリセットをデフォルトに
    const defaultPrompt = formatPresets.meeting.prompt;
    if (savedPrompt) {
      setSummarySettings(prev => ({ ...prev, customPrompt: savedPrompt }));
    } else {
      setSummarySettings(prev => ({ ...prev, customPrompt: defaultPrompt }));
      // デフォルトプロンプトも保存しておく
      localStorage.saveSummaryCustomPrompt(defaultPrompt);
    }
    
    // 文字起こしの背景情報のみ引き継ぐ（リロードで永続化しない）
    const backgroundToUse = transcriptionBackgroundInfo || '';
    setSummarySettings(prev => ({ ...prev, backgroundInfo: backgroundToUse }));
  }, [transcriptionBackgroundInfo, presetApiKey]);

  const handleModelChange = (value: string) => {
    setSelectedModel(value);
    window.localStorage.setItem('summary_model', value);
  };


  // コスト計算関数（要約用）
  const calculateSummaryCost = (textLength: number, model: string) => {
    const inputTokens = textLength / 4; // おおよそ4文字 = 1トークン
    const millionTokens = inputTokens / 1000000;
    
    const modelPricing = {
      'gemini-2.0-flash-lite': { input: 0.075, output: 0.30 },
      'gemini-2.5-flash': { input: 0.30, output: 2.50 }, // テキスト価格
      'gemini-2.5-pro': { input: 0.30, output: 2.50 }, // テキスト価格（仮定）
    };
    
    const pricing = modelPricing[model as keyof typeof modelPricing] || modelPricing['gemini-2.0-flash-lite'];
    const inputCost = millionTokens * pricing.input;
    const outputCost = millionTokens * pricing.output * 0.3; // 出力は入力の約30%と仮定
    
    return {
      inputCost,
      outputCost,
      totalCost: inputCost + outputCost,
      tokens: inputTokens
    };
  };

  // 文字起こし結果の総文字数を計算
  const getTotalTextLength = () => {
    return transcriptionResults.reduce((total, result) => {
      return total + (result.transcription?.length || 0);
    }, 0);
  };

  // Auto-summarization removed - summary now requires manual trigger

  const handleCustomPromptChange = (value: string) => {
    setSummarySettings(prev => ({ ...prev, customPrompt: value }));
    localStorage.saveSummaryCustomPrompt(value);
  };

  const handleBackgroundInfoChange = (value: string) => {
    setSummarySettings(prev => ({ ...prev, backgroundInfo: value }));
    // リロードで永続化しない。親へはセッション内で引き回すため通知
    onBackgroundInfoChange?.(value);
  };
  
  const handlePresetSelect = (presetKey: keyof typeof formatPresets) => {
    const preset = formatPresets[presetKey];
    setSummarySettings(prev => ({ ...prev, customPrompt: preset.prompt }));
    localStorage.saveSummaryCustomPrompt(preset.prompt);
  };


  const handleCopySummary = async () => {
    if (!summarySettings.result) return;
    const htmlBody = useMarkdown
      ? markdownToHtml(summarySettings.result)
      : plainToHtml(summarySettings.result);
    await copyHtmlToClipboard(`<div>${htmlBody}</div>`, summarySettings.result);
    // TODO: Add toast notification for copy success
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
      const transcriber = new GeminiTranscriber(apiKey, selectedModel, apiEndpoint);
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

      // 出力形式の明示（デフォルト: プレーンテキスト）
      const outputDirectivePlain = `\n\n出力形式: プレーンテキスト。Markdown記法（#, *, -, 1., \`\`\`, _ など）は使用しない。\n箇条書きは「・」や「▼」などのテキスト記号で表現し、見出しはテキストのみで装飾（例: 【見出し】）とする。\n余分な説明や前置きは出力しない。`;
      const outputDirectiveMarkdown = `\n\n出力形式: Markdown。適切な見出し（#）、リスト（- / 1.）、強調（**）等を用いて整形し、余分な説明は出力しない。`;
      formatPrompt = (formatPrompt || '') + (useMarkdown ? outputDirectiveMarkdown : outputDirectivePlain);

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

      // 実際のコストを計算
      const textLength = getTotalTextLength();
      const cost = calculateSummaryCost(textLength, selectedModel);
      setActualSummaryCost(cost.totalCost);

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

  const handleDownloadAsHtml = () => {
    if (!summarySettings.result) return;
    const htmlBody = useMarkdown
      ? markdownToHtml(summarySettings.result)
      : plainToHtml(summarySettings.result);
    const fullHtml = buildHtmlDocument(htmlBody, 'Summary');
    downloadTranscription(fullHtml, 'summary.html', 'text/html;charset=utf-8');
  };

  if (transcriptionResults.length === 0) {
    return (
      <div className="text-center py-8 text-gray-500">
        前のステップで文字起こしを完了してください
      </div>
    );
  }

  return (
    <div className="space-y-8">

      {/* まとめ設定（統合） */}
      {apiKey && (
        <div className="bg-purple-50 rounded-xl p-6 border border-purple-200">
          <h3 className="text-lg font-semibold text-gray-800 mb-4 flex items-center gap-2">
            <Sparkles className="w-5 h-5" />
            まとめ設定
          </h3>
          
          <div className="space-y-5">
            {/* Compact Model Selection */}
            <div className="flex items-center gap-4">
              <label className="text-sm font-medium text-gray-700 min-w-0">
                モデル:
              </label>
              <select
                value={selectedModel}
                onChange={(e) => handleModelChange(e.target.value)}
                disabled={summarySettings.isProcessing}
                className="flex-1 px-3 py-1.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent disabled:opacity-50 text-sm"
              >
                <option value="gemini-2.0-flash-lite">Flash-Lite (推奨)</option>
                <option value="gemini-2.5-flash">2.5 Flash (高性能)</option>
                <option value="gemini-2.5-pro">2.5 Pro (最高性能)</option>
              </select>
            </div>

            {/* Format Presets */}
            <div>
              <label className="text-sm font-medium text-gray-700 mb-3 block">
                形式プリセット（下のテキストエリアに自動入力）
              </label>
              <div className="grid grid-cols-2 gap-3">
                {Object.entries(formatPresets).map(([key, preset]) => (
                  <button
                    key={key}
                    onClick={() => handlePresetSelect(key as keyof typeof formatPresets)}
                    disabled={summarySettings.isProcessing}
                    className="px-4 py-3 rounded-lg transition-all text-sm font-medium disabled:opacity-50 bg-white border border-gray-300 text-gray-700 hover:bg-purple-50 hover:border-purple-300 focus:ring-2 focus:ring-purple-500"
                  >
                    {preset.name}
                  </button>
                ))}
              </div>
            </div>

            {/* Custom Prompt Text Area */}
            <div>
              <label className="text-sm font-medium text-gray-700 mb-2 block">
                プロンプト（編集可能）
              </label>
              <textarea
                value={summarySettings.customPrompt}
                onChange={(e) => handleCustomPromptChange(e.target.value)}
                placeholder="上のプリセットを選択するか、独自のプロンプトを入力してください..."
                className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent min-h-32 text-sm resize-y font-mono bg-white"
                disabled={summarySettings.isProcessing}
              />
              <p className="text-xs text-gray-500 mt-1">
                プリセットで定型文を挿入後、自由に編集できます
              </p>
            </div>

            {/* Background Info - moved from detailed settings */}
            <div>
              <label className="text-sm font-medium text-gray-700 mb-2 block">
                背景情報（オプション）
              </label>
              <textarea
                value={summarySettings.backgroundInfo}
                onChange={(e) => handleBackgroundInfoChange(e.target.value)}
                placeholder="例: 2024年1月26日の定例会議。参加者：田中、佐藤、鈴木。議題：新商品の戦略"
                className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent min-h-20 text-sm resize-y"
                disabled={summarySettings.isProcessing}
              />
              <p className="text-xs text-gray-500 mt-1">
                会議の詳細情報を入力すると、より精度の高いまとめが生成されます
              </p>
            </div>

            {/* Output Format */}
            <div className="flex items-center gap-4">
              <label className="text-sm font-medium text-gray-700">
                出力形式:
              </label>
              <label className="flex items-center gap-2 text-sm text-gray-700">
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
                Markdown形式
              </label>
            </div>
          </div>
        </div>
      )}

      {/* API Key - Show separately if needed */}
      {!presetApiKey && !apiKey && (
        <div className="bg-gray-50 rounded-xl p-6 border">
          <h3 className="text-lg font-semibold text-gray-800 mb-4 flex items-center gap-2">
            <Key className="w-5 h-5" />
            API設定が必要です
          </h3>
          
          <div className="space-y-2">
            <label className="text-sm font-medium text-gray-700">
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
        </div>
      )}

      {/* API Key Status - Show when configured */}
      {!presetApiKey && apiKey && (
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


      {/* 再生成ボタン（入力・出力セクション間） */}
      {apiKey && !summarySettings.isProcessing && (
        <div className="text-center space-y-3">
          <button
            onClick={() => handleSummarize()}
            className="px-8 py-3 bg-gradient-to-r from-purple-600 to-pink-600 text-white font-semibold rounded-xl hover:from-purple-700 hover:to-pink-700 transition-all duration-200 flex items-center gap-2 shadow-lg hover:shadow-xl mx-auto"
          >
            {summarySettings.result ? (
              <>
                <RefreshCw className="w-5 h-5" />
                再生成
              </>
            ) : (
              <>
                <Sparkles className="w-5 h-5" />
                まとめ作成
              </>
            )}
          </button>
          
          <div className="text-sm text-gray-600">
            予想コスト: <span className="font-mono font-semibold">${(() => {
              const textLength = getTotalTextLength();
              const cost = calculateSummaryCost(textLength, selectedModel);
              return cost.totalCost.toFixed(4);
            })()}</span>
            <span className="ml-2 text-xs">({getTotalTextLength().toLocaleString()}文字)</span>
          </div>
        </div>
      )}

      {/* Processing Status */}
      {summarySettings.isProcessing && (
        <div className="bg-purple-50 rounded-xl p-6 border border-purple-200">
          <div className="text-center space-y-4">
            <div className="flex items-center justify-center gap-3">
              <Loader2 className="w-6 h-6 text-purple-600 animate-spin" />
              <span className="text-lg font-semibold text-purple-800">まとめ作成中...</span>
            </div>
            
            <div className="space-y-3">
              <div className="flex justify-between text-sm text-gray-700">
                <span>進行状況</span>
                <span>{Math.round((summarySettings.currentStep / summarySettings.totalSteps) * 100)}%</span>
              </div>
              <div className="w-full bg-purple-200 rounded-full h-3">
                <div 
                  className="bg-gradient-to-r from-purple-500 to-pink-500 h-3 rounded-full transition-all duration-500"
                  style={{ width: `${(summarySettings.currentStep / summarySettings.totalSteps) * 100}%` }}
                />
              </div>
              <p className="text-sm text-purple-700 font-medium">{summarySettings.progress}</p>
            </div>
          </div>
        </div>
      )}

      {/* Error Message */}
      {error && (
        <div className="bg-red-50 rounded-xl p-4 border border-red-200">
          <div className="flex items-center gap-3">
            <AlertCircle className="w-5 h-5 text-red-600 flex-shrink-0" />
            <p className="text-sm text-red-700">{error}</p>
          </div>
        </div>
      )}

      {/* Summary Result */}
      {summarySettings.result && (
        <div className="bg-green-50 rounded-xl p-6 border border-green-200">
          <div className="space-y-4">
            <h3 className="text-lg font-semibold text-green-800 flex items-center gap-2 justify-center mb-2">
              <CheckCircle className="w-5 h-5" />
              まとめ結果
            </h3>

            <div className="bg-white rounded-lg border border-green-200 p-4 max-h-80 overflow-y-auto">
              <pre className="text-sm text-gray-800 whitespace-pre-wrap leading-relaxed">{summarySettings.result}</pre>
            </div>
            
            <div className="flex flex-wrap gap-2 justify-center">
              <button
                onClick={handleCopySummary}
                className="px-6 py-3 bg-blue-600 text-white font-medium rounded-lg hover:bg-blue-700 transition-all flex items-center gap-2 shadow-md hover:shadow-lg"
              >
                <Copy className="w-4 h-4" />
                コピー
              </button>
              <button
                onClick={handleDownloadSummary}
                className="px-6 py-3 bg-purple-600 text-white font-medium rounded-lg hover:bg-purple-700 transition-all flex items-center gap-2 shadow-md hover:shadow-lg"
              >
                <Download className="w-4 h-4" />
                テキスト
              </button>
              <button
                onClick={handleDownloadAsHtml}
                className="px-6 py-3 bg-pink-600 text-white font-medium rounded-lg hover:bg-pink-700 transition-all flex items-center gap-2 shadow-md hover:shadow-lg"
              >
                <Download className="w-4 h-4" />
                HTML
              </button>
            </div>

            {actualSummaryCost !== null && (
              <div className="text-center text-sm text-gray-600">
                実際のコスト: <span className="font-mono font-semibold">${actualSummaryCost.toFixed(4)}</span>
              </div>
            )}
          </div>
        </div>
      )}

    </div>
  );
}
