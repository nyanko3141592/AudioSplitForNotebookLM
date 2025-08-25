import { useState, useCallback, useEffect, useTransition } from 'react';
import { FileUpload } from '../components/FileUpload';
import { TranscriptionStep } from '../components/steps/TranscriptionStep';
import { SummaryStep } from '../components/steps/SummaryStep';
import { type SplitFile } from '../components/DownloadList';
import { useFFmpeg } from '../hooks/useFFmpeg';
import { downloadFile, downloadAllAsZip } from '../utils/download';
import { 
  FileAudio, 
  Loader2,
  AlertCircle,
  Key,
  CheckCircle,
  FileText,
  Sparkles,
  Settings,
  RotateCcw,
  ChevronDown,
  ChevronUp,
  Cpu,
  MessageSquare,
  Info,
  ArrowRight
} from 'lucide-react';
import type { TranscriptionResult } from '../utils/geminiTranscriber';
import { GeminiTranscriber, downloadTranscription } from '../utils/geminiTranscriber';

export function TranscribePage() {
  const [currentStep, setCurrentStep] = useState<1 | 2 | 3>(1);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [isPending, startTransition] = useTransition();
  const [splitFiles, setSplitFiles] = useState<SplitFile[]>([]);
  const [transcriptionResults, setTranscriptionResults] = useState<TranscriptionResult[]>([]);
  const [transcriptionBackgroundInfo, setTranscriptionBackgroundInfo] = useState<string>('');
  const [summaryBackgroundInfo, setSummaryBackgroundInfo] = useState<string>('');
  const [error, setError] = useState<string | null>(null);
  const [apiKey, setApiKey] = useState<string>('');
  const [showAdvancedSettings, setShowAdvancedSettings] = useState<boolean>(false);
  const [transcriptionSettings, setTranscriptionSettings] = useState({
    concurrencySettings: {
      enabled: false,
      count: 2,
      delay: 1000
    },
    customPrompt: ''
  });
  
  const { splitAudio } = useFFmpeg();

  // Clean up function to release memory
  const cleanupSplitFiles = useCallback(() => {
    splitFiles.forEach(file => {
      if (file.blob && (file as any).url) {
        URL.revokeObjectURL((file as any).url);
      }
    });
    console.log('Cleaned up previous split files');
  }, [splitFiles]);

  // APIキーと詳細設定の初期化
  useEffect(() => {
    const savedApiKey = localStorage.getItem('gemini_api_key');
    if (savedApiKey) {
      try {
        // 簡単な暗号化で保存されたキーを復号
        const decoded = atob(savedApiKey);
        setApiKey(decoded);
      } catch (error) {
        console.error('Failed to decode API key:', error);
        localStorage.removeItem('gemini_api_key');
      }
    }
    
    // 詳細設定の読み込み
    const savedSettings = localStorage.getItem('transcription_settings');
    if (savedSettings) {
      try {
        const settings = JSON.parse(savedSettings);
        setTranscriptionSettings(settings);
      } catch (error) {
        console.error('Failed to load transcription settings:', error);
      }
    }
  }, []);

  const handleApiKeyChange = (key: string) => {
    setApiKey(key);
    if (key) {
      // 簡単な暗号化で保存
      const encoded = btoa(key);
      localStorage.setItem('gemini_api_key', encoded);
    } else {
      localStorage.removeItem('gemini_api_key');
    }
  };

  const handleApiKeyReset = () => {
    setApiKey('');
    localStorage.removeItem('gemini_api_key');
  };

  const handleTranscriptionSettingsChange = (newSettings: typeof transcriptionSettings) => {
    setTranscriptionSettings(newSettings);
    localStorage.setItem('transcription_settings', JSON.stringify(newSettings));
  };

  const handleFileSelect = useCallback(async (file: File) => {
    cleanupSplitFiles();
    setSelectedFile(file);
    setSplitFiles([]);
    setTranscriptionResults([]);
    setError(null);
    
    // Check if file needs splitting (>200MB)
    const MAX_FILE_SIZE = 200 * 1024 * 1024; // 200MB in bytes
    
    if (file.size > MAX_FILE_SIZE) {
      // Auto-split large files
      setIsProcessing(true);
      
      // Use requestAnimationFrame to ensure smooth UI updates
      requestAnimationFrame(async () => {
        try {
          const maxSizeMB = 190; // Safe margin under 200MB
          const blobs = await splitAudio(file, 'size', { maxSize: maxSizeMB });
          
          const files: SplitFile[] = blobs.map((blob, index) => {
            const baseName = file.name.replace(/\.[^/.]+$/, '');
            const extension = 'wav'; // FFmpeg outputs WAV
            return {
              name: `${baseName}_part${index + 1}.${extension}`,
              size: blob.size,
              blob
            };
          });
          
          // Use startTransition for non-urgent state updates
          startTransition(() => {
            setSplitFiles(files);
          });
        } catch (error) {
          console.error('Error splitting audio:', error);
          setError('音声ファイルの自動分割中にエラーが発生しました。');
          return;
        } finally {
          setIsProcessing(false);
        }
      });
    } else {
      // Use file directly without splitting - defer to prevent blocking
      requestAnimationFrame(() => {
        const fileAsBlob = new Blob([file], { type: file.type });
        const splitFile: SplitFile = {
          name: file.name,
          size: file.size,
          blob: fileAsBlob
        };
        
        startTransition(() => {
          setSplitFiles([splitFile]);
        });
      });
    }
  }, [cleanupSplitFiles, splitAudio]);

  const handleDownload = useCallback((file: SplitFile) => {
    downloadFile(file);
  }, []);

  const handleDownloadAll = useCallback(() => {
    if (selectedFile && splitFiles.length > 0) {
      downloadAllAsZip(splitFiles, selectedFile.name);
    }
  }, [splitFiles, selectedFile]);

  const handleTranscriptionComplete = (results: TranscriptionResult[]) => {
    setTranscriptionResults(results);
    if (results.length > 0 && results.some(r => !r.error)) {
      setCurrentStep(3);
      // 文字起こしの背景情報を要約に引き継ぐ
      setSummaryBackgroundInfo(transcriptionBackgroundInfo);
    }
  };

  // Clean up on component unmount
  useEffect(() => {
    return () => {
      cleanupSplitFiles();
    };
  }, [cleanupSplitFiles]);

  return (
    <div className="container mx-auto px-6 py-8">
      <div className="max-w-4xl mx-auto">
        
        {/* Processing Indicator */}
        {isProcessing && (
          <div className="mb-6 p-4 bg-blue-50 border border-blue-200 rounded-lg">
            <div className="flex items-center">
              <Loader2 className="w-5 h-5 mr-2 text-blue-600 animate-spin" />
              <p className="text-sm text-blue-800">
                {selectedFile && selectedFile.size > 200 * 1024 * 1024
                  ? '200MBを超えるファイルを自動分割中...'
                  : 'ファイルを処理中...'}
              </p>
            </div>
          </div>
        )}

        {/* Error Message */}
        {error && (
          <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-lg">
            <div className="flex items-center">
              <AlertCircle className="w-5 h-5 mr-2 text-red-600" />
              <p className="text-sm text-red-800">{error}</p>
            </div>
          </div>
        )}

        {/* Progress Indicator */}
        <div className="mb-8">
          <div className="flex items-center justify-center">
            <div className="flex items-center space-x-8">
              {/* Step 1 */}
              <div className="flex items-center">
                <div className={`w-10 h-10 rounded-full flex items-center justify-center font-semibold ${
                  currentStep >= 1 ? 'bg-violet-600 text-white' : 'bg-gray-200 text-gray-500'
                }`}>
                  1
                </div>
                <span className={`ml-3 font-medium ${
                  currentStep >= 1 ? 'text-violet-600' : 'text-gray-500'
                }`}>
                  ファイル & 背景情報
                </span>
              </div>
              
              {/* Arrow */}
              <div className={`w-8 h-1 ${
                currentStep >= 2 ? 'bg-violet-600' : 'bg-gray-200'
              }`}></div>
              
              {/* Step 2 */}
              <div className="flex items-center">
                <div className={`w-10 h-10 rounded-full flex items-center justify-center font-semibold ${
                  currentStep >= 2 ? 'bg-violet-600 text-white' : 'bg-gray-200 text-gray-500'
                }`}>
                  2
                </div>
                <span className={`ml-3 font-medium ${
                  currentStep >= 2 ? 'text-violet-600' : 'text-gray-500'
                }`}>
                  文字起こし
                </span>
              </div>
              
              {/* Arrow */}
              <div className={`w-8 h-1 ${
                currentStep >= 3 ? 'bg-violet-600' : 'bg-gray-200'
              }`}></div>
              
              {/* Step 3 */}
              <div className="flex items-center">
                <div className={`w-10 h-10 rounded-full flex items-center justify-center font-semibold ${
                  currentStep >= 3 ? 'bg-violet-600 text-white' : 'bg-gray-200 text-gray-500'
                }`}>
                  3
                </div>
                <span className={`ml-3 font-medium ${
                  currentStep >= 3 ? 'text-violet-600' : 'text-gray-500'
                }`}>
                  要約作成
                </span>
              </div>
            </div>
          </div>
        </div>

        {/* Step Content */}
        {/* API Key Setup */}
        {!apiKey && (
          <div className="mb-8 bg-white/80 backdrop-blur-sm rounded-2xl shadow-xl p-8">
            <div className="flex items-center gap-3 mb-6">
              <div className="flex items-center justify-center p-3 bg-gradient-to-br from-blue-500 to-cyan-600 rounded-xl shadow-lg">
                <Key className="w-6 h-6 text-white" />
              </div>
              <div>
                <h2 className="text-2xl font-bold text-gray-800">APIキー設定</h2>
                <p className="text-sm text-gray-600 mt-1">文字起こしを使用するためにGemini APIキーが必要です</p>
              </div>
            </div>
            
            {/* Step-by-step guide */}
            <div className="mb-6 p-4 bg-blue-50 border border-blue-200 rounded-lg">
              <h3 className="font-semibold text-blue-800 mb-3 flex items-center gap-2">
                <Info className="w-4 h-4" />
                APIキー取得手順
              </h3>
              <ol className="space-y-2 text-sm text-blue-700">
                <li className="flex items-start gap-2">
                  <span className="flex-shrink-0 w-5 h-5 bg-blue-500 text-white text-xs rounded-full flex items-center justify-center">1</span>
                  <span>下のリンクから Google AI Studio にアクセス</span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="flex-shrink-0 w-5 h-5 bg-blue-500 text-white text-xs rounded-full flex items-center justify-center">2</span>
                  <span>「Create API Key」ボタンをクリック</span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="flex-shrink-0 w-5 h-5 bg-blue-500 text-white text-xs rounded-full flex items-center justify-center">3</span>
                  <span>生成されたAPIキー（AIzaSy... で始まる文字列）をコピー</span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="flex-shrink-0 w-5 h-5 bg-blue-500 text-white text-xs rounded-full flex items-center justify-center">4</span>
                  <span>下の入力フィールドに貼り付け</span>
                </li>
              </ol>
              <div className="mt-4">
                <a 
                  href="https://aistudio.google.com/app/apikey" 
                  target="_blank" 
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
                >
                  <MessageSquare className="w-4 h-4" />
                  Google AI Studio を開く
                </a>
              </div>
            </div>
            
            <div className="space-y-4">
              <div className="flex gap-2">
                <input
                  type="password"
                  value={apiKey}
                  onChange={(e) => handleApiKeyChange(e.target.value)}
                  placeholder="AIzaSy... で始まるAPIキーを入力してください"
                  className="flex-1 px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-violet-500 focus:border-transparent text-lg"
                />
                {apiKey && (
                  <button
                    onClick={handleApiKeyReset}
                    className="px-4 py-3 bg-gray-100 text-gray-600 rounded-lg hover:bg-gray-200 transition-colors flex items-center gap-2"
                    title="APIキーをリセット"
                  >
                    <RotateCcw className="w-4 h-4" />
                  </button>
                )}
              </div>
              <div className="flex items-start gap-2 text-sm text-gray-600">
                <div className="flex-shrink-0">🔒</div>
                <div>
                  <p>APIキーはブラウザに安全に保存され、サーバーには送信されません。</p>
                  <p className="mt-1">本アプリケーションは完全にクライアントサイドで動作します。</p>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Step 1: File Upload & Background Info */}
        {currentStep === 1 && apiKey && (
          <div className="bg-white/80 backdrop-blur-sm rounded-2xl shadow-xl p-8">
            <div className="flex items-center gap-3 mb-6">
              <div className="flex items-center justify-center p-3 bg-gradient-to-br from-violet-500 to-purple-600 rounded-xl shadow-lg">
                <FileAudio className="w-6 h-6 text-white" />
              </div>
              <div>
                <h2 className="text-2xl font-bold text-gray-800">ステップ1: ファイル & 背景情報</h2>
                <p className="text-sm text-gray-600 mt-1">音声ファイルと背景情報を入力</p>
              </div>
            </div>
            
            {/* APIキー管理セクション */}
            <div className="mb-6 p-4 bg-blue-50 border border-blue-200 rounded-lg">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Key className="w-4 h-4 text-blue-600" />
                  <span className="text-sm font-medium text-blue-800">APIキー設定済み</span>
                </div>
                <button
                  onClick={handleApiKeyReset}
                  className="px-3 py-1 bg-blue-100 text-blue-700 rounded hover:bg-blue-200 transition-colors flex items-center gap-2 text-sm"
                  title="APIキーをリセット"
                >
                  <RotateCcw className="w-3 h-3" />
                  リセット
                </button>
              </div>
            </div>

            {!selectedFile ? (
              <>
                <FileUpload
                  onFileSelect={handleFileSelect}
                  disabled={isProcessing || isPending}
                />
                {(isProcessing || isPending) && (
                  <div className="mt-4 p-4 bg-blue-50 border border-blue-200 rounded-lg">
                    <div className="flex items-center gap-3">
                      <Loader2 className="w-5 h-5 text-blue-600 animate-spin" />
                      <div>
                        <p className="text-sm font-medium text-blue-800">
                          {isProcessing ? '音声ファイルを処理中...' : 'ファイルを準備中...'}
                        </p>
                        <p className="text-xs text-blue-600 mt-1">
                          大きなファイルの場合、数分かかることがあります
                        </p>
                      </div>
                    </div>
                  </div>
                )}
                {!isProcessing && !isPending && (
                  <div className="mt-4 p-4 bg-amber-50 border border-amber-200 rounded-lg">
                    <p className="text-sm text-amber-800">
                      💡 200MB以上のファイルは自動的に分割されます
                    </p>
                  </div>
                )}
              </>
            ) : (
              <>
                <div className="mb-6 p-4 bg-green-50 border border-green-200 rounded-lg">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <CheckCircle className="w-5 h-5 text-green-600" />
                      <span className="text-sm font-medium text-green-800">
                        {selectedFile.name} ({(selectedFile.size / (1024 * 1024)).toFixed(2)} MB)
                      </span>
                    </div>
                    <button
                      onClick={() => {
                        setSelectedFile(null);
                        setSplitFiles([]);
                      }}
                      className="text-sm text-green-700 hover:text-green-800 underline"
                    >
                      変更
                    </button>
                  </div>
                </div>
                
                <div className="space-y-6">
                  <div>
                    <div className="flex items-center gap-2 mb-3">
                      <label className="block text-sm font-medium text-gray-700">
                        背景情報（文字起こし精度向上のため）
                      </label>
                      <span className="px-2 py-1 bg-amber-100 text-amber-800 text-xs rounded-md font-medium">推奨</span>
                    </div>
                    
                    {/* 背景情報の重要性説明 */}
                    <div className="mb-4 p-3 bg-amber-50 border border-amber-200 rounded-lg">
                      <div className="flex items-start gap-2">
                        <Info className="w-4 h-4 text-amber-600 flex-shrink-0 mt-0.5" />
                        <div className="text-sm">
                          <p className="text-amber-800 font-medium mb-1">なぜ背景情報が重要？</p>
                          <ul className="text-amber-700 space-y-1 text-xs">
                            <li>• 固有名詞（人名、会社名、商品名）の認識精度が向上</li>
                            <li>• 専門用語の正確な文字起こしが可能</li>
                            <li>• 話者の識別がより正確に</li>
                          </ul>
                        </div>
                      </div>
                    </div>

                    <textarea
                      value={transcriptionBackgroundInfo}
                      onChange={(e) => setTranscriptionBackgroundInfo(e.target.value)}
                      placeholder="例: 2024年1月26日の定例会議。参加者：田中部長、佐藤さん、鈴木さん。議題：新商品「スマートウォッチX1」のマーケティング戦略について討議。主要な検討事項はターゲット層とプロモーション手法。"
                      className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-violet-500 focus:border-transparent min-h-24 resize-y"
                    />
                    
                    {/* 入力例の提示 */}
                    <div className="mt-3 p-3 bg-gray-50 border border-gray-200 rounded-lg">
                      <p className="text-xs font-medium text-gray-700 mb-2">📝 入力例:</p>
                      <div className="space-y-1 text-xs text-gray-600">
                        <p><strong>会議:</strong> 参加者名、会議の目的、主要な議題</p>
                        <p><strong>インタビュー:</strong> インタビュイーの職種、テーマ、専門分野</p>
                        <p><strong>講演:</strong> 講師名、講演テーマ、対象聴衆</p>
                        <p><strong>商談:</strong> 企業名、商品名、担当者名</p>
                      </div>
                    </div>
                  </div>
                  
                  {/* 詳細設定セクション */}
                  <div className="border border-gray-200 rounded-lg p-4">
                    <button
                      onClick={() => setShowAdvancedSettings(!showAdvancedSettings)}
                      className="flex items-center justify-between w-full text-left"
                    >
                      <div className="flex items-center gap-2">
                        <Settings className="w-4 h-4 text-gray-600" />
                        <span className="text-sm font-medium text-gray-700">詳細設定</span>
                      </div>
                      {showAdvancedSettings ? (
                        <ChevronUp className="w-4 h-4 text-gray-600" />
                      ) : (
                        <ChevronDown className="w-4 h-4 text-gray-600" />
                      )}
                    </button>
                    
                    {showAdvancedSettings && (
                      <div className="mt-4 space-y-4">
                        {/* 並列処理設定 */}
                        <div>
                          <div className="flex items-center gap-2 mb-2">
                            <Cpu className="w-4 h-4 text-gray-600" />
                            <label className="text-sm font-medium text-gray-700">並列処理</label>
                          </div>
                          <div className="space-y-3">
                            <label className="flex items-center gap-2">
                              <input
                                type="checkbox"
                                checked={transcriptionSettings.concurrencySettings.enabled}
                                onChange={(e) => {
                                  const newSettings = {
                                    ...transcriptionSettings,
                                    concurrencySettings: {
                                      ...transcriptionSettings.concurrencySettings,
                                      enabled: e.target.checked
                                    }
                                  };
                                  handleTranscriptionSettingsChange(newSettings);
                                }}
                                className="rounded border-gray-300 text-violet-600 focus:ring-violet-500"
                              />
                              <span className="text-sm text-gray-600">複数ファイルの同時処理を有効化</span>
                            </label>
                            
                            {transcriptionSettings.concurrencySettings.enabled && (
                              <div className="ml-6 space-y-3">
                                <div>
                                  <label className="block text-xs font-medium text-gray-600 mb-1">
                                    同時処理数: {transcriptionSettings.concurrencySettings.count}
                                  </label>
                                  <input
                                    type="range"
                                    min="1"
                                    max="5"
                                    value={transcriptionSettings.concurrencySettings.count}
                                    onChange={(e) => {
                                      const newSettings = {
                                        ...transcriptionSettings,
                                        concurrencySettings: {
                                          ...transcriptionSettings.concurrencySettings,
                                          count: parseInt(e.target.value)
                                        }
                                      };
                                      handleTranscriptionSettingsChange(newSettings);
                                    }}
                                    className="w-full"
                                  />
                                </div>
                                <div>
                                  <label className="block text-xs font-medium text-gray-600 mb-1">
                                    処理間隔: {transcriptionSettings.concurrencySettings.delay}ms
                                  </label>
                                  <input
                                    type="range"
                                    min="500"
                                    max="3000"
                                    step="500"
                                    value={transcriptionSettings.concurrencySettings.delay}
                                    onChange={(e) => {
                                      const newSettings = {
                                        ...transcriptionSettings,
                                        concurrencySettings: {
                                          ...transcriptionSettings.concurrencySettings,
                                          delay: parseInt(e.target.value)
                                        }
                                      };
                                      handleTranscriptionSettingsChange(newSettings);
                                    }}
                                    className="w-full"
                                  />
                                </div>
                              </div>
                            )}
                          </div>
                        </div>
                        
                        {/* カスタムプロンプト設定 */}
                        <div>
                          <div className="flex items-center gap-2 mb-2">
                            <MessageSquare className="w-4 h-4 text-gray-600" />
                            <label className="text-sm font-medium text-gray-700">カスタムプロンプト</label>
                          </div>
                          <textarea
                            value={transcriptionSettings.customPrompt}
                            onChange={(e) => {
                              const newSettings = {
                                ...transcriptionSettings,
                                customPrompt: e.target.value
                              };
                              handleTranscriptionSettingsChange(newSettings);
                            }}
                            placeholder="デフォルトのプロンプトを使用する場合は空白にしてください"
                            className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-violet-500 focus:border-transparent min-h-20 resize-y"
                          />
                          <p className="text-xs text-gray-500 mt-1">
                            空白の場合はデフォルトの文字起こしプロンプトが使用されます
                          </p>
                        </div>
                      </div>
                    )}
                  </div>
                  
                  {/* Navigation buttons */}
                  <div className="flex gap-3 pt-4">
                    <button
                      onClick={() => {
                        setSelectedFile(null);
                        setSplitFiles([]);
                        setCurrentStep(1);
                      }}
                      className="px-6 py-3 bg-gray-100 text-gray-700 font-medium rounded-xl hover:bg-gray-200 transition-colors flex items-center gap-2"
                    >
                      <ArrowRight className="w-4 h-4 rotate-180" />
                      ファイルを変更
                    </button>
                    <button
                      onClick={() => setCurrentStep(2)}
                      disabled={!selectedFile}
                      className="flex-1 px-6 py-3 bg-gradient-to-r from-violet-600 to-purple-600 text-white font-semibold rounded-xl hover:from-violet-700 hover:to-purple-700 transition-all duration-200 flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      <FileAudio className="w-5 h-5" />
                      文字起こしを開始
                      <ArrowRight className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              </>
            )}
          </div>
        )}
        
        {/* Step 2: Transcription */}
        {currentStep === 2 && splitFiles.length > 0 && (
          <div className="bg-white/80 backdrop-blur-sm rounded-2xl shadow-xl p-8">
            <div className="flex items-center gap-3 mb-6">
              <div className="flex items-center justify-center p-3 bg-gradient-to-br from-green-500 to-emerald-600 rounded-xl shadow-lg">
                <FileText className="w-6 h-6 text-white" />
              </div>
              <div>
                <h2 className="text-2xl font-bold text-gray-800">ステップ2: 文字起こし</h2>
                <p className="text-sm text-gray-600 mt-1">音声ファイルを文字起こし中...</p>
              </div>
            </div>
            
            <TranscriptionStep
              splitFiles={splitFiles}
              transcriptionResults={transcriptionResults}
              onNext={() => setCurrentStep(3)}
              onBack={() => setCurrentStep(1)}
              onDownloadSplit={handleDownload}
              onDownloadAllSplits={handleDownloadAll}
              onTranscriptionComplete={handleTranscriptionComplete}
              onBackgroundInfoChange={() => {}} // 背景情報はステップ1で設定済み
              hideBackgroundInfo={true}
              presetApiKey={apiKey}
              presetBackgroundInfo={transcriptionBackgroundInfo}
              presetConcurrencySettings={transcriptionSettings.concurrencySettings}
              presetCustomPrompt={transcriptionSettings.customPrompt}
            />
          </div>
        )}
        
        {/* Step 3: Summary */}
        {currentStep === 3 && transcriptionResults.length > 0 && (
          <div className="bg-white/80 backdrop-blur-sm rounded-2xl shadow-xl p-8">
            <div className="flex items-center gap-3 mb-6">
              <div className="flex items-center justify-center p-3 bg-gradient-to-br from-purple-500 to-pink-600 rounded-xl shadow-lg">
                <Sparkles className="w-6 h-6 text-white" />
              </div>
              <div>
                <h2 className="text-2xl font-bold text-gray-800">ステップ3: 要約作成</h2>
                <p className="text-sm text-gray-600 mt-1">文字起こし結果をまとめます</p>
              </div>
            </div>
            
            <SummaryStep
              transcriptionResults={transcriptionResults}
              splitFiles={splitFiles}
              transcriptionBackgroundInfo={summaryBackgroundInfo}
              onDownloadSplit={handleDownload}
              onDownloadAllSplits={handleDownloadAll}
              onDownloadTranscription={() => {
                const transcriber = new GeminiTranscriber();
                const formatted = transcriber.formatTranscriptions(transcriptionResults);
                downloadTranscription(formatted);
              }}
              onBackgroundInfoChange={setSummaryBackgroundInfo}
              onBack={() => setCurrentStep(2)}
              presetApiKey={apiKey}
            />
          </div>
        )}
      </div>
    </div>
  );
}