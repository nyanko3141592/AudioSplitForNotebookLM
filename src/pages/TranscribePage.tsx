import { useState, useCallback, useEffect, useTransition } from 'react';
import { FileUpload } from '../components/FileUpload';
import { TranscriptionStep } from '../components/steps/TranscriptionStep';
import { SummaryStep } from '../components/steps/SummaryStep';
import { type SplitFile } from '../components/DownloadList';
import { useFFmpeg } from '../hooks/useFFmpeg';
import { downloadFile, downloadAllAsZip } from '../utils/download';
import { 
  Loader2,
  AlertCircle,
  CheckCircle,
  MessageSquare,
  ArrowDown
} from 'lucide-react';
import type { TranscriptionResult } from '../utils/geminiTranscriber';
// import { GeminiTranscriber } from '../utils/geminiTranscriber';
import { apiEndpointStorage } from '../utils/storage';
import { RecordingPanel } from '../components/RecordingPanel';
import { RecordingIndicator } from '../utils/recordingIndicator';

type Props = {
  onRecordingStateChange?: (isActive: boolean) => void;
  onStepStateChange?: (stepState: {
    hasFile: boolean;
    hasApiKey: boolean;
    hasSplitFiles: boolean;
    hasTranscriptionResults: boolean;
  }) => void;
};

export function TranscribePage({ onRecordingStateChange, onStepStateChange }: Props) {
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [isPending, startTransition] = useTransition();
  const [splitFiles, setSplitFiles] = useState<SplitFile[]>([]);
  const [transcriptionResults, setTranscriptionResults] = useState<TranscriptionResult[]>([]);
  const [transcriptionBackgroundInfo, setTranscriptionBackgroundInfo] = useState<string>('');
  const [summaryBackgroundInfo, setSummaryBackgroundInfo] = useState<string>('');
  const [error, setError] = useState<string | null>(null);
  const [apiKey, setApiKey] = useState<string>('');
  const [apiEndpoint, setApiEndpoint] = useState<string>('https://generativelanguage.googleapis.com');
  const [isRecordingActive, setIsRecordingActive] = useState<boolean>(false);
  const [hasRecordedSegments, setHasRecordedSegments] = useState<boolean>(false);
  // const [isTestingConnection, setIsTestingConnection] = useState<boolean>(false);
  // const [connectionTestResult, setConnectionTestResult] = useState<'success' | 'error' | null>(null);
  
  const handleRecordingStateChange = (isActive: boolean) => {
    setIsRecordingActive(isActive);
    onRecordingStateChange?.(isActive);
    // Update recording indicator (favicon and title)
    RecordingIndicator.setRecording(isActive);
  };
  
  const handleSegmentsStateChange = (hasSegments: boolean) => {
    setHasRecordedSegments(hasSegments);
  };
  
  const handleTabMetadataExtracted = (metadata: string) => {
    console.log('🏷️ Tab metadata received:', metadata);
    // Auto-populate background information with tab metadata
    if (metadata) {
      setTranscriptionBackgroundInfo(prev => {
        // If there's already background info, append the tab info
        if (prev.trim()) {
          return prev + '\n\n' + metadata;
        } else {
          return metadata;
        }
      });
    }
  };
  
  const [transcriptionSettings] = useState({
    concurrencySettings: {
      enabled: false,
      count: 2,
      delay: 1000
    },
    customPrompt: ''
  });
  
  const { splitAudio } = useFFmpeg();

  // Notify parent of step state changes
  useEffect(() => {
    onStepStateChange?.({
      hasFile: !!selectedFile,
      hasApiKey: !!apiKey,
      hasSplitFiles: splitFiles.length > 0,
      hasTranscriptionResults: transcriptionResults.length > 0
    });
  }, [selectedFile, apiKey, splitFiles.length, transcriptionResults.length, onStepStateChange]);

  // Clean up function to release memory
  const cleanupSplitFiles = useCallback(() => {
    splitFiles.forEach(file => {
      if (file.blob && (file as any).url) {
        URL.revokeObjectURL((file as any).url);
      }
    });
    console.log('Cleaned up previous split files');
  }, [splitFiles]);

  // APIキーとエンドポイントの初期化
  useEffect(() => {
    const savedApiKey = localStorage.getItem('gemini_api_key');
    if (savedApiKey) {
      try {
        const decoded = atob(savedApiKey);
        setApiKey(decoded);
      } catch (error) {
        console.error('Failed to decode API key:', error);
        localStorage.removeItem('gemini_api_key');
      }
    }
    
    // APIエンドポイント設定を読み込み
    const savedEndpoint = apiEndpointStorage.get();
    setApiEndpoint(savedEndpoint);
    
    // Cleanup recording indicator when component unmounts
    return () => {
      RecordingIndicator.reset();
    };
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

  // const handleEndpointChange = (endpoint: string) => {
  //   setApiEndpoint(endpoint);
  //   apiEndpointStorage.save(endpoint);
  // };


  const handleFileSelect = useCallback(async (file: File | File[]) => {
    cleanupSplitFiles();
    setSplitFiles([]);
    setTranscriptionResults([]);
    setError(null);
    
    if (Array.isArray(file)) {
      // Multiple segments: create SplitFiles from all segments
      console.log(`📁 ${file.length}個のセグメントを受信。個別に文字起こしします。`);
      
      const splitFiles: SplitFile[] = file.map((segment, index) => {
        const fileAsBlob = new Blob([segment], { type: segment.type });
        return {
          name: segment.name || `segment_${index + 1}.webm`,
          size: segment.size,
          blob: fileAsBlob
        };
      });
      
      // Use the first segment as the selected file for UI purposes
      setSelectedFile(file[0]);
      
      startTransition(() => {
        setSplitFiles(splitFiles);
      });
      return;
    }
    
    // Single file processing (existing logic)
    setSelectedFile(file);
    
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

  // Warn before page unload if there's unsaved data
  useEffect(() => {
    const handleBeforeUnload = (event: BeforeUnloadEvent) => {
      const hasUnsavedData = 
        isRecordingActive || // 録音中
        splitFiles.length > 0 || // 音声ファイルあり
        transcriptionResults.length > 0 || // 文字起こし結果あり
        transcriptionBackgroundInfo.trim() !== '' || // 背景情報入力済み
        summaryBackgroundInfo.trim() !== ''; // 要約用背景情報あり

      if (hasUnsavedData) {
        let message = '';
        
        if (isRecordingActive) {
          message = '録音中です。ページを離れると録音データが失われます。';
        } else {
          const dataTypes = [];
          if (splitFiles.length > 0) dataTypes.push('音声ファイル');
          if (transcriptionResults.length > 0) dataTypes.push('文字起こし結果');
          if (transcriptionBackgroundInfo.trim() !== '' || summaryBackgroundInfo.trim() !== '') {
            dataTypes.push('入力された背景情報');
          }
          
          if (dataTypes.length > 0) {
            message = `${dataTypes.join('・')}が失われます。本当にページを離れますか？`;
          } else {
            message = '処理したデータが失われます。本当にページを離れますか？';
          }
        }
        
        event.preventDefault();
        return message;
      }
    };

    window.addEventListener('beforeunload', handleBeforeUnload);

    return () => {
      window.removeEventListener('beforeunload', handleBeforeUnload);
    };
  }, [isRecordingActive, splitFiles.length, transcriptionResults.length, transcriptionBackgroundInfo, summaryBackgroundInfo]);

  // ステップの状態を計算
  const currentStep = !selectedFile ? 1 : 
                     splitFiles.length === 0 ? 2 : 
                     transcriptionResults.length === 0 ? 3 : 4;

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-5xl mx-auto px-6 py-8">
        
        {/* ステップインジケーター */}
        <div className="mb-8">
          <div className="flex items-center justify-center">
            <div className="flex items-center space-x-2 sm:space-x-4">
              {/* Step 1 */}
              <div className={`flex items-center ${currentStep >= 1 ? 'text-violet-600' : 'text-gray-400'}`}>
                <div className={`w-8 h-8 sm:w-10 sm:h-10 rounded-full flex items-center justify-center font-bold border-2 ${
                  currentStep >= 1 ? 'bg-violet-600 text-white border-violet-600' : 'bg-white border-gray-300'
                }`}>
                  1
                </div>
                <span className="ml-1 sm:ml-2 font-medium hidden sm:inline text-sm">音声選択</span>
              </div>
              
              <div className={`w-8 sm:w-16 h-0.5 ${currentStep >= 2 ? 'bg-violet-600' : 'bg-gray-300'}`}></div>
              
              {/* Step 2 */}
              <div className={`flex items-center ${currentStep >= 2 ? 'text-violet-600' : 'text-gray-400'}`}>
                <div className={`w-8 h-8 sm:w-10 sm:h-10 rounded-full flex items-center justify-center font-bold border-2 ${
                  currentStep >= 2 ? 'bg-violet-600 text-white border-violet-600' : 'bg-white border-gray-300'
                }`}>
                  2
                </div>
                <span className="ml-1 sm:ml-2 font-medium hidden sm:inline text-sm">設定</span>
              </div>
              
              <div className={`w-8 sm:w-16 h-0.5 ${currentStep >= 3 ? 'bg-violet-600' : 'bg-gray-300'}`}></div>
              
              {/* Step 3 */}
              <div className={`flex items-center ${currentStep >= 3 ? 'text-violet-600' : 'text-gray-400'}`}>
                <div className={`w-8 h-8 sm:w-10 sm:h-10 rounded-full flex items-center justify-center font-bold border-2 ${
                  currentStep >= 3 ? 'bg-violet-600 text-white border-violet-600' : 'bg-white border-gray-300'
                }`}>
                  3
                </div>
                <span className="ml-1 sm:ml-2 font-medium hidden sm:inline text-sm">文字起こし</span>
              </div>
              
              <div className={`w-8 sm:w-16 h-0.5 ${currentStep >= 4 ? 'bg-violet-600' : 'bg-gray-300'}`}></div>
              
              {/* Step 4 */}
              <div className={`flex items-center ${currentStep >= 4 ? 'text-violet-600' : 'text-gray-400'}`}>
                <div className={`w-8 h-8 sm:w-10 sm:h-10 rounded-full flex items-center justify-center font-bold border-2 ${
                  currentStep >= 4 ? 'bg-violet-600 text-white border-violet-600' : 'bg-white border-gray-300'
                }`}>
                  4
                </div>
                <span className="ml-1 sm:ml-2 font-medium hidden sm:inline text-sm">要約作成</span>
              </div>
            </div>
          </div>
        </div>

        {/* Unsaved Data Indicator */}
        {(isRecordingActive || splitFiles.length > 0 || transcriptionResults.length > 0 || transcriptionBackgroundInfo.trim() !== '' || summaryBackgroundInfo.trim() !== '') && (
          <div className="mb-4 p-3 bg-amber-50 border border-amber-200 rounded-lg flex items-center">
            <div className="w-2 h-2 bg-amber-500 rounded-full animate-pulse mr-3"></div>
            <p className="text-sm text-amber-800">
              {isRecordingActive 
                ? '録音中 - ブラウザを閉じると録音データが失われます'
                : 'データが未保存です - ブラウザを閉じる前に必要なファイルをダウンロードしてください'
              }
            </p>
          </div>
        )}
        

        {error && (
          <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-xl">
            <div className="flex items-center">
              <AlertCircle className="w-5 h-5 mr-3 text-red-600" />
              <p className="text-red-800">{error}</p>
            </div>
          </div>
        )}

        {/* Step 1: API Key & File Selection */}
        <div className="bg-white rounded-2xl shadow-lg p-8 mb-16" id="upload">
          <div className="flex items-center mb-6">
            <div className="w-8 h-8 bg-violet-600 text-white rounded-full flex items-center justify-center font-bold mr-3">
              1
            </div>
            <h2 className="text-2xl font-bold text-gray-900">音声ファイルを準備</h2>
          </div>
          
          <div id="record">
            <h3 className="text-lg font-semibold text-gray-700 mb-4">録音または選択してください</h3>
              
              {!selectedFile && (
                <>
                  <RecordingPanel 
                    onRecorded={handleFileSelect} 
                    onRecordingStateChange={handleRecordingStateChange}
                    onSegmentsStateChange={handleSegmentsStateChange}
                    onTabMetadataExtracted={handleTabMetadataExtracted}
                  />
                  
                  {!isRecordingActive && !hasRecordedSegments && (
                    <div className="mt-6">
                      <div className="relative">
                        <div className="absolute inset-0 flex items-center">
                          <div className="w-full border-t border-gray-300" />
                        </div>
                        <div className="relative flex justify-center text-sm">
                          <span className="px-2 bg-white text-gray-500">または</span>
                        </div>
                      </div>
                      
                      <div className="mt-6">
                        <FileUpload
                          onFileSelect={handleFileSelect}
                          disabled={isProcessing || isPending}
                        />
                        {!isProcessing && !isPending && (
                          <p className="text-sm text-gray-500 mt-3 text-center">
                            💡 200MB以上のファイルは自動分割されます
                          </p>
                        )}
                      </div>
                    </div>
                  )}
                  
                  {hasRecordedSegments && !isRecordingActive && (
                    <div className="mt-6 p-4 bg-blue-50 border-2 border-blue-200 rounded-xl text-center">
                      <div className="flex items-center justify-center w-12 h-12 bg-blue-500 rounded-full mx-auto mb-3">
                        <span className="text-white text-lg">🎙️</span>
                      </div>
                      <h3 className="text-lg font-bold text-blue-800 mb-2">録音セグメントが準備されています</h3>
                      <p className="text-sm text-blue-600 mb-3">
                        録音を続けるか、完了ボタンを押して文字起こしを開始してください
                      </p>
                      <p className="text-xs text-blue-500">
                        💡 録音完了前は音声ファイルのアップロードはできません
                      </p>
                    </div>
                  )}
                </>
              )}
              
              {/* Selected File Display */}
              {selectedFile && (
                <div className="mt-6 p-4 bg-green-50 border border-green-200 rounded-xl">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <CheckCircle className="w-5 h-5 text-green-600" />
                      <span className="font-medium text-green-800">
                        {selectedFile.name} ({(selectedFile.size / (1024 * 1024)).toFixed(2)} MB)
                      </span>
                    </div>
                    <button
                      onClick={() => {
                        setSelectedFile(null);
                        setSplitFiles([]);
                        setTranscriptionResults([]);
                        setTranscriptionBackgroundInfo('');
                        setSummaryBackgroundInfo('');
                      }}
                      className="text-green-700 hover:text-green-800 underline text-sm"
                    >
                      変更
                    </button>
                  </div>
                  {selectedFile.size > 200 * 1024 * 1024 && (
                    <p className="text-sm text-green-700 mt-2">
                      💡 ファイルサイズが大きいため、自動的に分割されます
                    </p>
                  )}
                </div>
              )}
          </div>
        </div>

        {/* Processing Status - Between Step 2 and 3 */}
        {selectedFile && isProcessing && (
          <div className="mb-6 p-4 bg-blue-50 border border-blue-200 rounded-xl">
            <div className="flex items-center justify-between">
              <div className="flex items-center">
                <Loader2 className="w-5 h-5 mr-3 text-blue-600 animate-spin" />
                <div>
                  <p className="text-blue-800 font-medium">
                    {selectedFile.size > 200 * 1024 * 1024
                      ? '大きなファイルを分割中...'
                      : 'ファイルを処理中...'}
                  </p>
                  <p className="text-sm text-blue-600 mt-1">
                    {selectedFile.size > 200 * 1024 * 1024
                      ? `${selectedFile.name} (${(selectedFile.size / (1024 * 1024)).toFixed(1)}MB) を190MB以下に分割しています`
                      : 'しばらくお待ちください...'}
                  </p>
                </div>
              </div>
              <div className="text-right">
                <p className="text-xs text-blue-600">処理中...</p>
                <p className="text-xs text-blue-500 mt-1">ブラウザを閉じないでください</p>
              </div>
            </div>
          </div>
        )}

        {/* Arrow between file selection and settings */}
        {selectedFile && !isProcessing && (
          <div className="flex justify-center mb-8">
            <div className="flex flex-col items-center">
              <ArrowDown className="w-8 h-8 text-violet-400 animate-bounce" />
              <span className="text-sm text-violet-600 font-medium mt-2">次のステップ</span>
            </div>
          </div>
        )}

        {/* Step 2: AI設定 - コンパクト版 */}
        {selectedFile && !isProcessing && (
          apiKey ? (
            // 設定済みの場合 - 超コンパクト
            <div className="bg-white rounded-xl shadow-md p-4 mb-8" data-step="settings">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="w-6 h-6 bg-violet-600 text-white rounded-full flex items-center justify-center font-bold text-sm">
                    2
                  </div>
                  <h2 className="text-lg font-semibold text-gray-900">AI設定</h2>
                  <CheckCircle className="w-5 h-5 text-green-600" />
                  <span className="text-sm text-green-700 font-medium">設定完了</span>
                </div>
                <button
                  onClick={() => handleApiKeyChange('')}
                  className="text-sm text-gray-600 hover:text-gray-800 underline"
                >
                  変更
                </button>
              </div>
            </div>
          ) : (
            // 未設定の場合 - 通常サイズ
            <div className="bg-white rounded-xl shadow-lg p-6 mb-12" data-step="settings">
              <div className="flex items-center mb-4">
                <div className="w-7 h-7 bg-violet-600 text-white rounded-full flex items-center justify-center font-bold mr-3 text-sm">
                  2
                </div>
                <h2 className="text-xl font-semibold text-gray-900">AI設定</h2>
                <span className="ml-3 text-sm text-gray-500">(文字起こし・要約を使う場合)</span>
              </div>

              {/* API Key Section */}
              <div className="mb-4">
                <div className="bg-amber-50 border border-amber-200 rounded-lg p-4">
                  <p className="text-amber-800 mb-3 text-sm">
                    🔑 文字起こし・要約機能を使用するにはAPIキーが必要です
                  </p>
                  <div className="flex flex-col sm:flex-row items-start sm:items-center gap-3">
                    <a 
                      href="https://aistudio.google.com/app/apikey" 
                      target="_blank" 
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-2 px-3 py-2 bg-amber-600 text-white rounded-lg hover:bg-amber-700 transition-colors text-sm"
                    >
                      <MessageSquare className="w-4 h-4" />
                      APIキーを取得
                    </a>
                    <input
                      type="password"
                      value={apiKey}
                      onChange={(e) => handleApiKeyChange(e.target.value)}
                      placeholder="AIzaSy... で始まるAPIキー"
                      className="flex-1 px-3 py-2 border border-amber-300 rounded-lg focus:ring-2 focus:ring-amber-500 text-sm"
                    />
                  </div>
                  <p className="text-xs text-amber-600 mt-2">
                    💡 APIキーなしでも音声ファイルの分割は可能です
                  </p>
                </div>
              </div>

              <div className="text-center">
                <p className="text-gray-600 text-sm">音声分割のみ利用可能</p>
                <p className="text-xs text-gray-500 mt-1">
                  APIキーを設定すると文字起こし・要約機能も使えます
                </p>
              </div>
            </div>
          )
        )}

        {/* Step 3: Transcription or Split Results */}
        {/* Arrow between settings and transcription */}
        {splitFiles.length > 0 && (
          <div className="flex justify-center mb-8">
            <div className="flex flex-col items-center">
              <ArrowDown className="w-8 h-8 text-violet-400 animate-bounce" />
              <span className="text-sm text-violet-600 font-medium mt-2">次のステップ</span>
            </div>
          </div>
        )}

        {splitFiles.length > 0 && (
          <>
            {apiKey ? (
              /* With API Key - Show Transcription */
              <div className="bg-white rounded-2xl shadow-lg p-8 mb-16" data-step="transcription">
                <div className="flex items-center mb-6">
                  <div className="w-8 h-8 bg-violet-600 text-white rounded-full flex items-center justify-center font-bold mr-3">
                    3
                  </div>
                  <h2 className="text-2xl font-bold text-gray-900">文字起こし</h2>
                </div>
                
                <TranscriptionStep
                  splitFiles={splitFiles}
                  transcriptionResults={transcriptionResults}
                  onNext={() => {}}
                  onDownloadSplit={handleDownload}
                  onDownloadAllSplits={handleDownloadAll}
                  onTranscriptionComplete={handleTranscriptionComplete}
                  onBackgroundInfoChange={setTranscriptionBackgroundInfo}
                  hideBackgroundInfo={false}
                  showNext={false}
                  presetApiKey={apiKey}
                  presetApiEndpoint={apiEndpoint}
                  presetBackgroundInfo={transcriptionBackgroundInfo}
                  presetConcurrencySettings={transcriptionSettings.concurrencySettings}
                  presetCustomPrompt={transcriptionSettings.customPrompt}
                />
              </div>
            ) : (
              /* Without API Key - Show Split Results Only */
              <div className="bg-white rounded-2xl shadow-lg p-8 mb-16" data-step="transcription">
                <div className="flex items-center mb-6">
                  <div className="w-8 h-8 bg-violet-600 text-white rounded-full flex items-center justify-center font-bold mr-3">
                    3
                  </div>
                  <h2 className="text-2xl font-bold text-gray-900">音声分割完了</h2>
                </div>
                
                <div className="bg-green-50 border border-green-200 rounded-xl p-6 mb-6">
                  <div className="flex items-center mb-4">
                    <CheckCircle className="w-6 h-6 text-green-600 mr-3" />
                    <div>
                      <p className="text-green-800 font-medium">
                        音声ファイルの分割が完了しました
                      </p>
                      <p className="text-sm text-green-700 mt-1">
                        {splitFiles.length}個のファイルに分割されました
                      </p>
                    </div>
                  </div>
                </div>

                <div className="space-y-4">
                  <h3 className="text-lg font-semibold text-gray-900">分割されたファイル</h3>
                  <div className="space-y-3">
                    {splitFiles.map((file, index) => (
                      <div key={index} className="flex items-center justify-between p-4 bg-gray-50 rounded-xl">
                        <div className="flex items-center gap-3">
                          <div className="w-8 h-8 bg-blue-100 rounded-lg flex items-center justify-center">
                            <span className="text-sm font-semibold text-blue-600">{index + 1}</span>
                          </div>
                          <div>
                            <p className="font-medium text-gray-900">{file.name}</p>
                            <p className="text-sm text-gray-600">
                              {(file.size / (1024 * 1024)).toFixed(1)} MB
                            </p>
                          </div>
                        </div>
                        <button
                          onClick={() => handleDownload(file)}
                          className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors text-sm font-medium"
                        >
                          ダウンロード
                        </button>
                      </div>
                    ))}
                  </div>
                  
                  {splitFiles.length > 1 && (
                    <div className="pt-4 border-t border-gray-200">
                      <button
                        onClick={handleDownloadAll}
                        className="w-full px-6 py-3 bg-gradient-to-r from-green-600 to-emerald-600 text-white font-semibold rounded-xl hover:from-green-700 hover:to-emerald-700 transition-all duration-200"
                      >
                        すべてをZIPでダウンロード
                      </button>
                    </div>
                  )}
                </div>

                <div className="mt-6 p-4 bg-blue-50 border border-blue-200 rounded-xl">
                  <p className="text-blue-800 text-sm">
                    💡 <strong>文字起こし・要約機能を使用するには：</strong><br />
                    上のステップ2でGemini APIキーを設定してください。文字起こしと議事録の自動生成が利用できるようになります。
                  </p>
                </div>
              </div>
            )}


            {/* Arrow between transcription and summary */}
            {apiKey && transcriptionResults.length > 0 && (
              <div className="flex justify-center mb-8">
                <div className="flex flex-col items-center">
                  <ArrowDown className="w-8 h-8 text-violet-400 animate-bounce" />
                  <span className="text-sm text-violet-600 font-medium mt-2">次のステップ</span>
                </div>
              </div>
            )}
            
            {/* Step 4: Summary - Only show if we have transcription results */}
            {apiKey && transcriptionResults.length > 0 && (
              <div className="bg-white rounded-2xl shadow-lg p-8" data-step="summary">
                <div className="flex items-center mb-6">
                  <div className="w-8 h-8 bg-violet-600 text-white rounded-full flex items-center justify-center font-bold mr-3">
                    4
                  </div>
                  <h2 className="text-2xl font-bold text-gray-900">要約作成</h2>
                </div>
                
                <SummaryStep
                  transcriptionResults={transcriptionResults}
                  transcriptionBackgroundInfo={summaryBackgroundInfo}
                  onBackgroundInfoChange={setSummaryBackgroundInfo}
                  presetApiKey={apiKey}
                  presetApiEndpoint={apiEndpoint}
                />
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}
