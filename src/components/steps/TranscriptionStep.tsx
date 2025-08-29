import { useState, useEffect, useRef } from 'react';
import { Download, Loader2, AlertCircle, StopCircle, CheckCircle, XCircle, Clock, Copy, Info, RefreshCw, Sparkles, ArrowRight, Cpu, Cloud } from 'lucide-react';
import { downloadTranscription } from '../../utils/geminiTranscriber';
import type { TranscriptionResult, TranscriptionProgress } from '../../utils/geminiTranscriber';
import { TranscriptionService } from '../../utils/transcriptionService';
import type { TranscriptionMode } from '../../utils/transcriptionService';
import { LocalTranscriber } from '../../utils/localTranscriber';
import type { SplitFile } from '../DownloadList';
import { apiKeyStorage, localStorage, apiEndpointStorage } from '../../utils/storage';

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
  presetApiEndpoint?: string;
  presetBackgroundInfo?: string;
  presetConcurrencySettings?: {
    enabled: boolean;
    count: number;
    delay: number;
  };
  presetCustomPrompt?: string;
  presetTranscriptionMode?: TranscriptionMode;
}

export function TranscriptionStep({ 
  splitFiles, 
  transcriptionResults: parentTranscriptionResults,
  onNext, 
  onBack: _onBack,
  showNext = true, 
  nextButtonText = "要約作成へ",
  onDownloadSplit,
  onDownloadAllSplits,
  onTranscriptionComplete,
  onBackgroundInfoChange,
  hideBackgroundInfo = false,
  presetApiKey = '',
  presetApiEndpoint = '',
  presetBackgroundInfo = '',
  presetConcurrencySettings,
  presetCustomPrompt = '',
  presetTranscriptionMode = 'local'
}: TranscriptionStepProps) {
  const [apiKey, setApiKey] = useState('');
  const [selectedModel, setSelectedModel] = useState('gemini-2.0-flash-lite');
  const [apiEndpoint, setApiEndpoint] = useState('https://generativelanguage.googleapis.com');
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
  const transcriptionServiceRef = useRef<TranscriptionService>(TranscriptionService.getInstance());
  const [customPrompt, setCustomPrompt] = useState('');
  const [backgroundInfo, setBackgroundInfo] = useState('');
  const [showApiKeyInput, setShowApiKeyInput] = useState(false);
  const [concurrencySettings, setConcurrencySettings] = useState({
    enabled: false,
    count: 2,
    delay: 1000
  });
  const [transcriptionMode, setTranscriptionMode] = useState<TranscriptionMode>(presetTranscriptionMode || 'local');
  const [whisperLanguage, setWhisperLanguage] = useState<string>('auto');
  const [localModelName, setLocalModelName] = useState('Xenova/whisper-tiny');
  

  // presetTranscriptionModeが変更されたらtranscriptionModeを更新
  useEffect(() => {
    setTranscriptionMode(presetTranscriptionMode);
  }, [presetTranscriptionMode]);
  
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
        // APIキーがない場合、ローカル処理を使うので入力欄は非表示
        setShowApiKeyInput(false);
      }
    }
    
    // モデル選択をローカルストレージから復元
    const savedModel = window.localStorage.getItem('transcription_model');
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
    // ローカル処理の場合はAPIキー不要、Gemini APIの場合のみキーチェック
    if (transcriptionMode === 'gemini' && !apiKey) {
      setError('Gemini APIを使用するにはAPIキーを入力してください');
      return;
    }
    
    // autoモードの場合、APIキーがなければローカル処理を使用
    if (transcriptionMode === 'auto' && !apiKey) {
      setTranscriptionMode('local');
    }

    if (splitFiles.length === 0) {
      setError('文字起こしする音声ファイルがありません');
      return;
    }

    setError(null);
    setIsTranscribing(true);
    setTranscriptionResults([]);

    try {
      const service = transcriptionServiceRef.current;
      
      // サービスの設定
      service.configure({
        mode: transcriptionMode,
        geminiApiKey: apiKey,
        geminiModelName: selectedModel,
        geminiEndpoint: apiEndpoint,
        localModelName: localModelName
      });
      
      const concurrency = concurrencySettings.enabled ? concurrencySettings.count : 1;
      const delay = concurrencySettings.delay;
      
      // 背景情報をプロンプトに組み込む
      const fullPrompt = backgroundInfo ? 
        `背景情報: ${backgroundInfo}\n\n${customPrompt || ''}` : 
        customPrompt;
      
      const results = await service.transcribeMultipleBlobs(
        splitFiles.map(f => f.blob),
        splitFiles.map(f => f.name),
        (progress: TranscriptionProgress) => {
          setCurrentProgress(progress);
        },
        {
          delay,
          language: whisperLanguage,
          customPrompt: fullPrompt || undefined,
          concurrency
        }
      );

      // 実際のコストを計算（Gemini APIの場合のみ）
      if (transcriptionMode !== 'local') {
        const duration = getTotalDuration();
        const cost = calculateCost(duration, selectedModel);
        setActualCost(cost.totalCost);
      }

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
      setCurrentProgress({ current: 0, total: 0, status: '', fileStates: new Map() });
    }
  };

  const handleCopyTranscription = () => {
    if (transcriptionResults.length > 0) {
      const formatted = formatTranscriptions(transcriptionResults);
      navigator.clipboard.writeText(formatted);
      // TODO: Add toast notification for copy success
    }
  };

  const formatTranscriptions = (results: TranscriptionResult[]): string => {
    let formatted = '# 音声文字起こし結果\n\n';
    
    for (const result of results) {
      formatted += `## パート ${result.partNumber}: ${result.fileName}\n\n`;
      
      if (result.error) {
        formatted += `⚠️ エラー: ${result.error}\n\n`;
      } else {
        formatted += `${result.transcription}\n\n`;
      }
      
      formatted += '---\n\n';
    }
    
    return formatted;
  };

  const handleCancelTranscription = () => {
    if (transcriptionServiceRef.current) {
      transcriptionServiceRef.current.cancelTranscription();
    }
  };

  const handleDownloadTranscription = () => {
    if (transcriptionResults.length > 0) {
      const formatted = formatTranscriptions(transcriptionResults);
      downloadTranscription(formatted);
    }
  };

  const hasResults = transcriptionResults.length > 0;
  const successCount = transcriptionResults.filter(r => !r.error).length;
  const canProceed = hasResults && successCount > 0;


  return (
    <div className="space-y-8">
      {/* 入力設定セクション */}
      <div className="bg-violet-50 rounded-xl p-6 border border-violet-200">
        <h3 className="text-lg font-semibold text-gray-800 mb-4 flex items-center gap-2">
          <Sparkles className="w-5 h-5" />
          文字起こし設定
        </h3>
        
        <div className="space-y-5">
          {/* Display current mode */}
          <div className="p-3 bg-violet-50 border border-violet-200 rounded-lg">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                {transcriptionMode === 'local' ? (
                  <>
                    <Cpu className="w-5 h-5 text-violet-600" />
                    <span className="text-sm font-medium text-violet-800">ローカル処理モード</span>
                  </>
                ) : (
                  <>
                    <Cloud className="w-5 h-5 text-violet-600" />
                    <span className="text-sm font-medium text-violet-800">Gemini APIモード</span>
                  </>
                )}
              </div>
              <p className="text-xs text-violet-600">
                {transcriptionMode === 'local' ? '無料・プライバシー重視' : '高精度・高速'}
              </p>
            </div>
          </div>

          {/* Local Settings */}
          {transcriptionMode === 'local' && (
            <div className="space-y-4">
              <div className="space-y-2">
                <label className="text-sm font-medium text-gray-700">
                  言語設定
                </label>
                <select
                  value={whisperLanguage}
                  onChange={(e) => setWhisperLanguage(e.target.value)}
                  disabled={isTranscribing}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-violet-500 focus:border-transparent"
                >
                  {LocalTranscriber.getAvailableLanguages().map(lang => (
                    <option key={lang.code} value={lang.code}>
                      {lang.name}
                    </option>
                  ))}
                </select>
                <p className="text-xs text-gray-500">
                  文字起こしする音声の言語を選択してください
                </p>
              </div>
              
              <div className="space-y-2">
                <label className="text-sm font-medium text-gray-700">
                  Whisperモデル
                </label>
              <select
                value={localModelName}
                onChange={(e) => setLocalModelName(e.target.value)}
                disabled={isTranscribing}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-violet-500 focus:border-transparent"
              >
                {LocalTranscriber.getAvailableModels().map(model => (
                  <option key={model.id} value={model.id}>
                    {model.name} ({model.size}, {model.speed}, 精度: {model.accuracy})
                  </option>
                ))}
              </select>
                <p className="text-xs text-gray-500">
                  初回はモデルのダウンロードが必要です（キャッシュされます）
                </p>
              </div>
            </div>
          )}

          {/* API Key */}
          {transcriptionMode === 'gemini' && !presetApiKey && (showApiKeyInput || !apiKey ? (
            <div className="space-y-2">
              <label className="text-sm font-medium text-gray-700">
                Gemini API キー
              </label>
              <input
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

          {/* Compact Model Selection */}
          {transcriptionMode !== 'local' && apiKey && (
            <div className="flex items-center gap-4">
              <label className="text-sm font-medium text-gray-700 min-w-0">
                モデル:
              </label>
              <select
                value={selectedModel}
                onChange={(e) => handleModelChange(e.target.value)}
                disabled={isTranscribing}
                className="flex-1 px-3 py-1.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-violet-500 focus:border-transparent disabled:opacity-50 text-sm"
              >
                <option value="gemini-2.0-flash-lite">Flash-Lite (推奨)</option>
                <option value="gemini-2.5-flash">2.5 Flash (高性能)</option>
                <option value="gemini-2.5-pro">2.5 Pro (最高性能)</option>
              </select>
            </div>
          )}

          {/* 背景情報 - 常時表示 */}
          {!hideBackgroundInfo && (
            <div>
              <label className="text-sm font-medium text-gray-700 mb-2 block flex items-center gap-1">
                <Info className="w-4 h-4" />
                背景情報（精度向上・オプション）
              </label>
              <textarea
                value={backgroundInfo}
                onChange={(e) => {
                  setBackgroundInfo(e.target.value);
                  onBackgroundInfoChange?.(e.target.value);
                }}
                placeholder="例: 2024年1月26日の定例会議。参加者：田中、佐藤、鈴木。議題：新商品の戦略"
                className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-violet-500 focus:border-transparent min-h-20 text-sm resize-y"
                disabled={isTranscribing}
              />
              <p className="text-xs text-gray-500 mt-1">
                会議の詳細情報を入力すると精度が向上します
              </p>
            </div>
          )}
          
          {/* 背景情報表示（hideBackgroundInfo=trueの場合） */}
          {hideBackgroundInfo && presetBackgroundInfo && (
            <div className="p-3 bg-blue-50 border border-blue-200 rounded-lg">
              <div className="flex items-center gap-2 mb-2">
                <Info className="w-4 h-4 text-blue-600" />
                <span className="text-sm font-medium text-blue-800">背景情報を使用中</span>
              </div>
              <p className="text-xs text-blue-700">{presetBackgroundInfo}</p>
            </div>
          )}
        </div>
      </div>

      {/* エラー表示 */}
      {error && (
        <div className="bg-red-50 rounded-xl p-4 border border-red-200">
          <div className="flex items-center gap-3">
            <AlertCircle className="w-5 h-5 text-red-600 flex-shrink-0" />
            <p className="text-sm text-red-700">{error}</p>
          </div>
        </div>
      )}

      {/* 処理中表示 */}
      {isTranscribing && (
        <div className="bg-blue-50 rounded-xl p-6 border border-blue-200">
          <div className="space-y-4">
            <div className="text-center">
              <div className="flex items-center justify-center gap-3 mb-3">
                <Loader2 className="w-6 h-6 text-blue-600 animate-spin" />
                <span className="text-lg font-semibold text-blue-800">文字起こし実行中...</span>
              </div>
              <p className="text-sm text-blue-700 font-medium">{currentProgress.status}</p>
            </div>
            
            {currentProgress.fileStates.size > 0 && (
              <div className="space-y-2">
                <p className="text-sm font-medium text-gray-700">各ファイルの状態</p>
                <div className="grid gap-2">
                  {Array.from(currentProgress.fileStates.entries()).map(([partNumber, result]) => (
                    <div key={partNumber} className="flex items-center justify-between p-2 bg-white/60 rounded-lg">
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
        </div>
      )}

      {/* 再生成ボタン（入力・出力セクション間） */}
      {!isTranscribing && (
        <div className="text-center space-y-3">
          <button
            onClick={handleTranscribe}
            disabled={splitFiles.length === 0 || (transcriptionMode === 'gemini' && !apiKey)}
            className="px-8 py-3 bg-gradient-to-r from-violet-600 to-purple-600 text-white font-semibold rounded-xl hover:from-violet-700 hover:to-purple-700 disabled:opacity-50 disabled:cursor-not-allowed transition-all duration-200 flex items-center gap-2 shadow-lg hover:shadow-xl mx-auto"
          >
            {hasResults || error ? (
              <>
                <RefreshCw className="w-5 h-5" />
                再生成
              </>
            ) : (
              <>
                <Sparkles className="w-5 h-5" />
                文字起こし開始
              </>
            )}
          </button>
          
          {transcriptionMode !== 'local' && (
            <div className="text-sm text-gray-600">
              予想コスト: <span className="font-mono font-semibold">${(() => {
                const duration = getTotalDuration();
                const cost = calculateCost(duration, selectedModel);
                return cost.totalCost.toFixed(4);
              })()}</span>
              <span className="ml-2 text-xs">({Math.round(getTotalDuration())}秒)</span>
            </div>
          )}
        </div>
      )}

      {/* 出力結果セクション */}
      {hasResults && (
        <div className="bg-green-50 rounded-xl p-6 border border-green-200">
          <div className="space-y-4">
            {/* Completion Header */}
            <h3 className="text-lg font-semibold text-green-800 flex items-center gap-2 mb-2">
              <CheckCircle className="w-5 h-5" />
              文字起こし完了
            </h3>
            <div className="text-sm text-green-700 text-center">
              成功: {successCount}/{transcriptionResults.length} ファイル
            </div>

            {/* Statistics */}
            <div className="bg-white/80 rounded-lg p-4 border border-green-300">
              <div className="grid grid-cols-3 gap-4 text-center">
                <div>
                  <div className="text-xl font-bold text-green-600">{splitFiles.length}</div>
                  <div className="text-xs text-green-700">音声ファイル</div>
                </div>
                <div>
                  <div className="text-xl font-bold text-green-600">{successCount}</div>
                  <div className="text-xs text-green-700">成功</div>
                </div>
                <div>
                  <div className="text-xl font-bold text-green-600">
                    {transcriptionResults.reduce((total, result) => total + (result.transcription?.length || 0), 0).toLocaleString()}
                  </div>
                  <div className="text-xs text-green-700">総文字数</div>
                </div>
              </div>
            </div>

            {/* Download Section */}
            <div className="bg-white/60 rounded-lg p-4 border border-green-200">
              <h4 className="text-sm font-semibold text-green-800 mb-3">ダウンロード</h4>
              <div className="space-y-3">
                <div>
                  <div className="text-xs text-gray-600 mb-2">音声ファイル</div>
                  <div className="flex flex-wrap gap-2">
                    {onDownloadSplit && splitFiles.map(file => (
                      <button
                        key={file.name}
                        onClick={() => onDownloadSplit(file)}
                        className="px-3 py-1.5 bg-blue-100 text-blue-700 rounded-lg hover:bg-blue-200 transition-colors text-xs font-medium"
                      >
                        🎵 {file.name}
                      </button>
                    ))}
                    {onDownloadAllSplits && splitFiles.length > 1 && (
                      <button
                        onClick={onDownloadAllSplits}
                        className="px-3 py-1.5 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors text-xs font-medium"
                      >
                        📦 全音声ファイル一括
                      </button>
                    )}
                  </div>
                </div>
                
                <div>
                  <div className="text-xs text-gray-600 mb-2">文字起こし結果</div>
                  <div className="flex gap-2">
                    <button
                      onClick={handleCopyTranscription}
                      className="px-4 py-2 bg-green-100 text-green-700 rounded-lg hover:bg-green-200 transition-colors flex items-center gap-2 text-sm font-medium"
                    >
                      <Copy className="w-4 h-4" />
                      コピー
                    </button>
                    <button
                      onClick={handleDownloadTranscription}
                      className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors flex items-center gap-2 text-sm font-medium"
                    >
                      <Download className="w-4 h-4" />
                      テキストファイル
                    </button>
                  </div>
                </div>
              </div>
            </div>

            {/* Transcription Results Preview */}
            <div className="bg-white rounded-lg border border-green-200">
              <div className="p-3 border-b border-green-200">
                <h4 className="text-sm font-semibold text-green-800">文字起こし結果プレビュー</h4>
              </div>
              <div className="max-h-80 overflow-y-auto">
                {transcriptionResults.map((result) => (
                  <div key={result.partNumber} className="border-b border-gray-100 last:border-b-0">
                    <div className="p-4 space-y-2">
                      <div className="flex items-center justify-between">
                        <span className="text-sm font-medium text-gray-800">
                          パート {result.partNumber}: {result.fileName}
                        </span>
                        <span className="text-xs text-gray-500">
                          {result.error ? 'エラー' : `${result.transcription.length}文字`}
                        </span>
                      </div>
                      {result.error ? (
                        <p className="text-sm text-red-600">エラー: {result.error}</p>
                      ) : (
                        <div className="text-sm text-gray-700 whitespace-pre-wrap leading-relaxed">
                          {(() => {
                            const lines = result.transcription.split('\n');
                            const displayLines = lines.slice(0, 100);
                            const truncated = lines.length > 100;
                            return (
                              <>
                                {displayLines.join('\n')}
                                {truncated && (
                                  <div className="mt-2 pt-2 border-t border-gray-200">
                                    <span className="text-xs text-gray-500 italic">
                                      ...残り{lines.length - 100}行（全{lines.length}行）
                                    </span>
                                  </div>
                                )}
                              </>
                            );
                          })()}
                        </div>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Next Step Guide */}
            <div className="p-4 bg-emerald-100 border border-emerald-300 rounded-lg">
              <p className="text-sm text-emerald-800 text-center">
                <strong>📋 次のステップ:</strong> 下の要約作成セクションでAIによる自動まとめを作成できます。
              </p>
            </div>

            {/* Cost Display */}
            {transcriptionMode !== 'local' && actualCost !== null && (
              <div className="text-center text-sm text-gray-600">
                実際のコスト: <span className="font-mono font-semibold">${actualCost.toFixed(4)}</span>
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
