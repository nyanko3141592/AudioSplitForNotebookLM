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
  MessageSquare
} from 'lucide-react';
import type { TranscriptionResult } from '../utils/geminiTranscriber';
import { GeminiTranscriber, downloadTranscription } from '../utils/geminiTranscriber';
import { RecordingPanel } from '../components/RecordingPanel';

type Props = {
  onRecordingStateChange?: (isActive: boolean) => void;
};

export function TranscribePage({ onRecordingStateChange }: Props) {
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [isPending, startTransition] = useTransition();
  const [splitFiles, setSplitFiles] = useState<SplitFile[]>([]);
  const [transcriptionResults, setTranscriptionResults] = useState<TranscriptionResult[]>([]);
  const [transcriptionBackgroundInfo, setTranscriptionBackgroundInfo] = useState<string>('');
  const [summaryBackgroundInfo, setSummaryBackgroundInfo] = useState<string>('');
  const [error, setError] = useState<string | null>(null);
  const [apiKey, setApiKey] = useState<string>('');
  const [isRecordingActive, setIsRecordingActive] = useState<boolean>(false);
  
  const handleRecordingStateChange = (isActive: boolean) => {
    setIsRecordingActive(isActive);
    onRecordingStateChange?.(isActive);
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

  // Clean up function to release memory
  const cleanupSplitFiles = useCallback(() => {
    splitFiles.forEach(file => {
      if (file.blob && (file as any).url) {
        URL.revokeObjectURL((file as any).url);
      }
    });
    console.log('Cleaned up previous split files');
  }, [splitFiles]);

  // APIキーの初期化
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

  // ステップの状態を計算
  const currentStep = !selectedFile ? 1 : transcriptionResults.length > 0 ? 3 : 2;

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-5xl mx-auto px-6 py-8">
        
        {/* ステップインジケーター */}
        <div className="mb-8">
          <div className="flex items-center justify-center">
            <div className="flex items-center space-x-4">
              {/* Step 1 */}
              <div className={`flex items-center ${currentStep >= 1 ? 'text-violet-600' : 'text-gray-400'}`}>
                <div className={`w-10 h-10 rounded-full flex items-center justify-center font-bold border-2 ${
                  currentStep >= 1 ? 'bg-violet-600 text-white border-violet-600' : 'bg-white border-gray-300'
                }`}>
                  1
                </div>
                <span className="ml-2 font-medium hidden sm:inline">音声選択</span>
              </div>
              
              <div className={`w-16 h-0.5 ${currentStep >= 2 ? 'bg-violet-600' : 'bg-gray-300'}`}></div>
              
              {/* Step 2 */}
              <div className={`flex items-center ${currentStep >= 2 ? 'text-violet-600' : 'text-gray-400'}`}>
                <div className={`w-10 h-10 rounded-full flex items-center justify-center font-bold border-2 ${
                  currentStep >= 2 ? 'bg-violet-600 text-white border-violet-600' : 'bg-white border-gray-300'
                }`}>
                  2
                </div>
                <span className="ml-2 font-medium hidden sm:inline">文字起こし</span>
              </div>
              
              <div className={`w-16 h-0.5 ${currentStep >= 3 ? 'bg-violet-600' : 'bg-gray-300'}`}></div>
              
              {/* Step 3 */}
              <div className={`flex items-center ${currentStep >= 3 ? 'text-violet-600' : 'text-gray-400'}`}>
                <div className={`w-10 h-10 rounded-full flex items-center justify-center font-bold border-2 ${
                  currentStep >= 3 ? 'bg-violet-600 text-white border-violet-600' : 'bg-white border-gray-300'
                }`}>
                  3
                </div>
                <span className="ml-2 font-medium hidden sm:inline">要約作成</span>
              </div>
            </div>
          </div>
        </div>
        
        {/* Status Messages */}
        {isProcessing && (
          <div className="mb-6 p-4 bg-blue-50 border border-blue-200 rounded-xl">
            <div className="flex items-center">
              <Loader2 className="w-5 h-5 mr-3 text-blue-600 animate-spin" />
              <p className="text-blue-800">
                {selectedFile && selectedFile.size > 200 * 1024 * 1024
                  ? '大きなファイルを分割中...'
                  : 'ファイルを処理中...'}
              </p>
            </div>
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
        <div className="bg-white rounded-2xl shadow-lg p-8 mb-8" id="upload">
          <div className="flex items-center mb-6">
            <div className="w-8 h-8 bg-violet-600 text-white rounded-full flex items-center justify-center font-bold mr-3">
              1
            </div>
            <h2 className="text-2xl font-bold text-gray-900">音声ファイルを準備</h2>
          </div>
          
          {!apiKey ? (
            <div className="bg-amber-50 border border-amber-200 rounded-xl p-6 mb-6">
              <p className="text-amber-800 mb-4">🔑 まずAPIキーを設定してください</p>
              <div className="flex items-center gap-4">
                <a 
                  href="https://aistudio.google.com/app/apikey" 
                  target="_blank" 
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-2 px-4 py-2 bg-amber-600 text-white rounded-lg hover:bg-amber-700 transition-colors"
                >
                  <MessageSquare className="w-4 h-4" />
                  APIキーを取得
                </a>
                <input
                  type="password"
                  value={apiKey}
                  onChange={(e) => handleApiKeyChange(e.target.value)}
                  placeholder="AIzaSy... で始まるAPIキー"
                  className="flex-1 px-4 py-2 border border-amber-300 rounded-lg focus:ring-2 focus:ring-amber-500"
                />
              </div>
            </div>
          ) : (
            <div className="bg-green-50 border border-green-200 rounded-xl p-4 mb-6">
              <p className="text-green-800">✅ APIキー設定済み</p>
            </div>
          )}

          {apiKey && (
            <div id="record">
              <h3 className="text-lg font-semibold text-gray-700 mb-4">録音または選択してください</h3>
              
              <RecordingPanel 
                onRecorded={handleFileSelect} 
                onRecordingStateChange={handleRecordingStateChange}
              />

              {!selectedFile && !isRecordingActive && (
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
              )}
            </div>
          )}
        </div>

        {/* Step 2: Background Info & Start */}
        {selectedFile && (
          <div className="bg-white rounded-2xl shadow-lg p-8 mb-8">
            <div className="flex items-center mb-6">
              <div className="w-8 h-8 bg-violet-600 text-white rounded-full flex items-center justify-center font-bold mr-3">
                2
              </div>
              <h2 className="text-2xl font-bold text-gray-900">背景情報を入力</h2>
            </div>
            
            <div className="mb-6 p-4 bg-green-50 border border-green-200 rounded-xl">
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
                  }}
                  className="text-green-700 hover:text-green-800 underline"
                >
                  変更
                </button>
              </div>
            </div>

            <div className="mb-6">
              <label className="block text-lg font-semibold text-gray-900 mb-3">
                背景情報 <span className="text-sm text-amber-600">(推奨)</span>
              </label>
              <p className="text-sm text-gray-600 mb-4">
                参加者名、企業名、専門用語などを入力すると文字起こしの精度が向上します
              </p>
              <textarea
                value={transcriptionBackgroundInfo}
                onChange={(e) => setTranscriptionBackgroundInfo(e.target.value)}
                placeholder="例：田中部長、佐藤さん、鈴木さんの定例会議。新商品「スマートウォッチX1」のマーケティング戦略について討議。"
                className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-violet-500 focus:border-transparent resize-y"
                rows={3}
              />
            </div>

            <button
              onClick={() => {
                // 文字起こしを自動開始
                console.log('Start transcription for files:', splitFiles.length);
              }}
              disabled={!selectedFile || splitFiles.length === 0}
              className="w-full px-6 py-4 bg-gradient-to-r from-violet-600 to-purple-600 text-white font-semibold rounded-xl hover:from-violet-700 hover:to-purple-700 transition-all transform hover:scale-105 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              🚀 文字起こしを開始
            </button>
          </div>
        )}

        {/* Step 3: Results */}
        {splitFiles.length > 0 && (
          <>
            <div className="bg-white rounded-2xl shadow-lg p-8 mb-8">
              <div className="flex items-center mb-6">
                <div className="w-8 h-8 bg-violet-600 text-white rounded-full flex items-center justify-center font-bold mr-3">
                  3
                </div>
                <h2 className="text-2xl font-bold text-gray-900">文字起こし & 要約</h2>
              </div>
              
              <TranscriptionStep
                splitFiles={splitFiles}
                transcriptionResults={transcriptionResults}
                onNext={() => {}}
                onDownloadSplit={handleDownload}
                onDownloadAllSplits={handleDownloadAll}
                onTranscriptionComplete={handleTranscriptionComplete}
                onBackgroundInfoChange={() => {}}
                hideBackgroundInfo={true}
                presetApiKey={apiKey}
                presetBackgroundInfo={transcriptionBackgroundInfo}
                presetConcurrencySettings={transcriptionSettings.concurrencySettings}
                presetCustomPrompt={transcriptionSettings.customPrompt}
              />
            </div>

            {transcriptionResults.length > 0 && (
              <div className="bg-gradient-to-r from-violet-50 to-purple-50 rounded-2xl p-8">
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
                  presetApiKey={apiKey}
                />
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}
