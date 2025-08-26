import { useState, useEffect, useRef } from 'react';
import { Download, Loader2, Key, AlertCircle, StopCircle, CheckCircle, XCircle, Clock, Copy, Info, RefreshCw, Sparkles, ArrowRight, DollarSign } from 'lucide-react';
import { GeminiTranscriber, downloadTranscription } from '../../utils/geminiTranscriber';
import type { TranscriptionResult, TranscriptionProgress } from '../../utils/geminiTranscriber';
import type { SplitFile } from '../DownloadList';
import { apiKeyStorage, localStorage } from '../../utils/storage';
import { ResultsSummary } from '../ResultsSummary';

interface TranscriptionStepProps {
  splitFiles: SplitFile[];
  transcriptionResults?: TranscriptionResult[];
  onNext?: () => void;
  onBack?: () => void;
  showNext?: boolean;
  nextButtonText?: string;
  onDownloadSplit?: (file: SplitFile) => void;
  onDownloadAllSplits?: () => void;
  onTranscriptionComplete?: (results: TranscriptionResult[]) => void;
  onBackgroundInfoChange?: (backgroundInfo: string) => void;
  hideBackgroundInfo?: boolean;
  presetApiKey?: string;
  presetBackgroundInfo?: string;
  presetConcurrencySettings?: {
    enabled: boolean;
    count: number;
    delay: number;
  };
  presetCustomPrompt?: string;
}

export function TranscriptionStep({ 
  splitFiles, 
  transcriptionResults: parentTranscriptionResults,
  onNext, 
  onBack: _onBack,
  showNext = true, 
  nextButtonText = "まとめへ",
  onDownloadSplit,
  onDownloadAllSplits,
  onTranscriptionComplete,
  onBackgroundInfoChange,
  hideBackgroundInfo = false,
  presetApiKey = '',
  presetBackgroundInfo = '',
  presetConcurrencySettings,
  presetCustomPrompt = ''
}: TranscriptionStepProps) {
  const [apiKey, setApiKey] = useState('');
  const [selectedModel, setSelectedModel] = useState('gemini-2.0-flash-lite');
  const [isTranscribing, setIsTranscribing] = useState(false);
  const [transcriptionResults, setTranscriptionResults] = useState<TranscriptionResult[]>(parentTranscriptionResults || []);
  const [currentProgress, setCurrentProgress] = useState<TranscriptionProgress>({ 
    current: 0, 
    total: 0, 
    status: '', 
    fileStates: new Map() 
  });
  const [error, setError] = useState<string | null>(null);
  const [actualCost, setActualCost] = useState<number | null>(null);
  const transcriberRef = useRef<GeminiTranscriber | null>(null);
  const [customPrompt, setCustomPrompt] = useState('');
  const [backgroundInfo, setBackgroundInfo] = useState('');
  const [showApiKeyInput, setShowApiKeyInput] = useState(false);
  const [concurrencySettings, setConcurrencySettings] = useState({
    enabled: false,
    count: 2,
    delay: 1000
  });
  

  // 初回読み込み時にストレージからデータを復元またはpresetを使用
  useEffect(() => {
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
    
    // モデル選択をローカルストレージから復元
    const savedModel = window.localStorage.getItem('transcription_model');
    if (savedModel) {
      setSelectedModel(savedModel);
    }
    
    if (presetBackgroundInfo) {
      setBackgroundInfo(presetBackgroundInfo);
      onBackgroundInfoChange?.(presetBackgroundInfo);
    }
    
    // presetがある場合はそれを使用、なければストレージから読み込み
    if (presetCustomPrompt !== undefined) {
      setCustomPrompt(presetCustomPrompt);
    } else {
      const savedPrompt = localStorage.getCustomPrompt();
      if (savedPrompt) {
        setCustomPrompt(savedPrompt);
      }
    }
    
    if (presetConcurrencySettings) {
      setConcurrencySettings(presetConcurrencySettings);
    }
  }, [presetApiKey, presetBackgroundInfo, presetCustomPrompt, presetConcurrencySettings, onBackgroundInfoChange]);

  // Auto-start removed - transcription now requires manual trigger

  // 親コンポーネントから結果が渡された場合に更新
  useEffect(() => {
    if (parentTranscriptionResults && parentTranscriptionResults.length > 0) {
      setTranscriptionResults(parentTranscriptionResults);
    }
  }, [parentTranscriptionResults]);

  const handleApiKeyChange = (value: string) => {
    setApiKey(value);
    apiKeyStorage.save(value);
  };

  const handleModelChange = (value: string) => {
    setSelectedModel(value);
    window.localStorage.setItem('transcription_model', value);
  };

  // コスト計算関数
  const calculateCost = (durationInSeconds: number, model: string) => {
    const audioTokens = durationInSeconds * 32; // 1秒 = 32トークン
    const millionTokens = audioTokens / 1000000;
    
    const modelPricing = {
      'gemini-2.0-flash-lite': { input: 0.075, output: 0.30 }, // 音声も同じ価格
      'gemini-2.5-flash': { input: 1.00, output: 2.50 }, // 音声価格
      'gemini-2.5-pro': { input: 1.00, output: 2.50 }, // 音声価格（仮定）
    };
    
    const pricing = modelPricing[model as keyof typeof modelPricing] || modelPricing['gemini-2.0-flash-lite'];
    const inputCost = millionTokens * pricing.input;
    const outputCost = millionTokens * pricing.output * 0.1; // 出力は入力の約10%と仮定
    
    return {
      inputCost,
      outputCost,
      totalCost: inputCost + outputCost,
      tokens: audioTokens
    };
  };

  // 総再生時間を計算
  const getTotalDuration = () => {
    return splitFiles.reduce((total, file) => {
      // BlobのdurationプロパティまたはFile.sizeから推定
      // WAVファイルの場合、おおよそ1MB = 10秒と仮定
      const estimatedDuration = file.size / (1024 * 1024) * 10;
      return total + estimatedDuration;
    }, 0);
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
      const transcriber = new GeminiTranscriber(apiKey, selectedModel);
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

      // 実際のコストを計算
      const duration = getTotalDuration();
      const cost = calculateCost(duration, selectedModel);
      setActualCost(cost.totalCost);

      setTranscriptionResults(results);
      onTranscriptionComplete?.(results);
    } catch (error) {
      console.error('Transcription error:', error);
      if (error instanceof Error && error.message !== 'キャンセルされました') {
        setError(error.message);
      } else {
        setError('文字起こしに失敗しました');
      }
    } finally {
      setIsTranscribing(false);
      transcriberRef.current = null;
      setCurrentProgress({ current: 0, total: 0, status: '', fileStates: new Map() });
    }
  };

  const handleCopyTranscription = () => {
    if (transcriptionResults.length > 0) {
      const transcriber = new GeminiTranscriber();
      const formatted = transcriber.formatTranscriptions(transcriptionResults);
      navigator.clipboard.writeText(formatted);
      // TODO: Add toast notification for copy success
    }
  };

  const handleCancelTranscription = () => {
    if (transcriberRef.current) {
      transcriberRef.current.cancelTranscription();
    }
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
  const canProceed = hasResults && successCount > 0;

  if (isTranscribing) {
    return (
      <div className="space-y-4">
        <div className="p-3 bg-blue-50 border border-blue-200 rounded-lg">
          <p className="text-sm text-blue-700 font-medium">{currentProgress.status}</p>
        </div>
        
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
        
        <div className="flex justify-center">
          <button
            onClick={handleCancelTranscription}
            className="px-6 py-2 bg-red-600 text-white font-semibold rounded-lg hover:bg-red-700 transition-colors flex items-center gap-2"
          >
            <StopCircle className="w-5 h-5" />
            中止
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Previous Results Summary */}
      {splitFiles.length > 0 && (
        <ResultsSummary
          splitFiles={splitFiles}
          onDownloadSplit={onDownloadSplit}
          onDownloadAllSplits={onDownloadAllSplits}
          compact
        />
      )}

      {/* API Key Status/Input */}
      {!presetApiKey && (showApiKeyInput ? (
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

      {/* Model Selection */}
      {!isTranscribing && !hasResults && (
        <div className="space-y-4">
          <div>
            <label className="text-sm font-medium text-gray-700 flex items-center gap-1 mb-2">
              <Sparkles className="w-4 h-4" />
              文字起こしモデル選択
            </label>
            <select
              value={selectedModel}
              onChange={(e) => handleModelChange(e.target.value)}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-violet-500 focus:border-transparent text-sm"
            >
              <option value="gemini-2.0-flash-lite">Gemini 2.0 Flash-Lite (推奨 - 費用対効果)</option>
              <option value="gemini-2.5-flash">Gemini 2.5 Flash (高性能 - 適応思考)</option>
              <option value="gemini-2.5-pro">Gemini 2.5 Pro (最高性能 - 思考と推論)</option>
            </select>
            <p className="text-xs text-gray-500 mt-1">
              Flash-Lite &lt; Flash &lt; Pro の順にコストが上がります
            </p>
          </div>
        </div>
      )}

      {/* 背景情報 */}
      {!hideBackgroundInfo && !isTranscribing && !hasResults && (
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <label className="text-sm font-medium text-gray-700 flex items-center gap-1">
              <Info className="w-4 h-4" />
              背景情報（文字起こし精度向上・オプション）
            </label>
          </div>
          <textarea
            value={backgroundInfo}
            onChange={(e) => {
              setBackgroundInfo(e.target.value);
              onBackgroundInfoChange?.(e.target.value);
            }}
            placeholder="例: 2024年1月26日の定例会議。参加者：田中、佐藤、鈴木。議題：新商品の戦略"
            className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-violet-500 focus:border-transparent min-h-16 text-sm resize-y"
          />
          <p className="text-xs text-gray-500">
            会議の日時、参加者、議題などを入力すると精度が向上します
          </p>
        </div>
      )}
      
      {/* 背景情報表示（hideBackgroundInfo=trueの場合） */}
      {hideBackgroundInfo && presetBackgroundInfo && (
        <div className="mb-4 p-3 bg-blue-50 border border-blue-200 rounded-lg">
          <div className="flex items-center gap-2 mb-2">
            <Info className="w-4 h-4 text-blue-600" />
            <span className="text-sm font-medium text-blue-800">背景情報を使用中</span>
          </div>
          <p className="text-xs text-blue-700">{presetBackgroundInfo}</p>
        </div>
      )}

      {/* Error Message */}
      {error && (
        <div className="flex items-center gap-2 p-3 bg-red-50 border border-red-200 rounded-lg">
          <AlertCircle className="w-5 h-5 text-red-600 flex-shrink-0" />
          <p className="text-sm text-red-700">{error}</p>
        </div>
      )}

      {/* Cost Estimate */}
      {!isTranscribing && apiKey && splitFiles.length > 0 && (
        <div className="text-right">
          <p className="text-xs text-gray-500">
            予想コスト: ${(() => {
              const duration = getTotalDuration();
              const cost = calculateCost(duration, selectedModel);
              return cost.totalCost.toFixed(4);
            })()} ({Math.round(getTotalDuration())}秒)
          </p>
        </div>
      )}

      {/* Transcribe Button - 初回実行と再実行 */}
      {!isTranscribing && (
        <button
          onClick={handleTranscribe}
          disabled={!apiKey || splitFiles.length === 0}
          className="w-full px-6 py-3 bg-gradient-to-r from-violet-600 to-purple-600 text-white font-semibold rounded-xl hover:from-violet-700 hover:to-purple-700 disabled:opacity-50 disabled:cursor-not-allowed transition-all duration-200 flex items-center justify-center gap-2"
        >
          {hasResults || error ? (
            <>
              <RefreshCw className="w-5 h-5" />
              文字起こしを再実行 ({splitFiles.length}ファイル)
            </>
          ) : (
            <>
              <Sparkles className="w-5 h-5" />
              🚀 文字起こしを開始 ({splitFiles.length}ファイル)
            </>
          )}
        </button>
      )}

      {/* Results */}
      {hasResults && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <div className="text-sm text-gray-600">
              完了: {successCount}/{transcriptionResults.length} ファイル
            </div>
            <div className="flex gap-2">
              <button
                onClick={handleCopyTranscription}
                className="px-4 py-2 bg-blue-600 text-white font-medium rounded-lg hover:bg-blue-700 transition-colors flex items-center gap-2"
              >
                <Copy className="w-4 h-4" />
                コピー
              </button>
              <button
                onClick={handleDownloadTranscription}
                className="px-4 py-2 bg-green-600 text-white font-medium rounded-lg hover:bg-green-700 transition-colors flex items-center gap-2"
              >
                <Download className="w-4 h-4" />
                ダウンロード
              </button>
            </div>
          </div>

          {/* Results Preview */}
          <div className="max-h-60 overflow-y-auto border border-gray-200 rounded-lg p-4 space-y-4">
            {transcriptionResults.map((result) => (
              <div key={result.partNumber} className="space-y-2">
                <h3 className="font-semibold text-gray-800">
                  パート {result.partNumber}: {result.fileName}
                </h3>
                {result.error ? (
                  <p className="text-sm text-red-600">エラー: {result.error}</p>
                ) : (
                  <p className="text-sm text-gray-700 whitespace-pre-wrap">
                    {result.transcription.slice(0, 150)}
                    {result.transcription.length > 150 && '...'}
                  </p>
                )}
              </div>
            ))}
          </div>
          
          <div className="space-y-3">
            <div className="p-4 bg-green-50 border border-green-200 rounded-lg">
              <p className="text-sm text-green-800">
                💡 文字起こしが完了しました。下の要約セクションでまとめを作成できます。
              </p>
            </div>
            
            {/* Actual Cost Display */}
            {actualCost !== null && (
              <div className="text-right">
                <p className="text-xs text-gray-500">
                  コスト: ${actualCost.toFixed(4)} ({selectedModel === 'gemini-2.0-flash-lite' ? 'Flash-Lite' : 
                            selectedModel === 'gemini-2.5-flash' ? '2.5 Flash' : '2.5 Pro'})
                </p>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Navigation Buttons */}
      {canProceed && showNext && onNext && (
        <div className="flex justify-center">
          <button
            onClick={onNext}
            className="px-8 py-4 bg-gradient-to-r from-violet-600 to-purple-600 text-white font-semibold rounded-xl hover:from-violet-700 hover:to-purple-700 transition-all duration-200 flex items-center gap-2"
          >
            <Sparkles className="w-5 h-5" />
            {nextButtonText}
            <ArrowRight className="w-4 h-4" />
          </button>
        </div>
      )}
    </div>
  );
}