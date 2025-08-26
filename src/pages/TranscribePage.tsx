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
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-4xl mx-auto px-6 py-8">
        
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

        {/* API Key Setup */}
        {!apiKey && (
          <div className="mb-8 bg-white rounded-2xl shadow-lg p-8" id="upload">
            <div className="text-center mb-6">
              <h2 className="text-2xl font-bold text-gray-900 mb-2">APIキーを設定</h2>
              <p className="text-gray-600">文字起こしにGemini APIキーが必要です</p>
            </div>
            
            <div className="mb-6">
              <a 
                href="https://aistudio.google.com/app/apikey" 
                target="_blank" 
                rel="noopener noreferrer"
                className="inline-flex items-center gap-2 px-6 py-3 bg-blue-600 text-white rounded-xl hover:bg-blue-700 transition-colors"
              >
                <MessageSquare className="w-4 h-4" />
                APIキーを取得
              </a>
              <p className="text-sm text-gray-500 mt-2">
                Google AI Studioで「Create API Key」をクリック
              </p>
            </div>
            
            <div className="space-y-4">
              <input
                type="password"
                value={apiKey}
                onChange={(e) => handleApiKeyChange(e.target.value)}
                placeholder="AIzaSy... で始まるAPIキー"
                className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              />
              <p className="text-sm text-gray-500">
                🔒 APIキーはブラウザ内に安全に保存されます
              </p>
            </div>
          </div>
        )}

        {/* Main Content */}
        {apiKey && (
          <div className="space-y-8">
            {/* Recording Panel */}
            <div className="bg-white rounded-2xl shadow-lg p-8" id="record">
              <h2 className="text-2xl font-bold text-gray-900 mb-6">音声を録音または選択</h2>
              
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

            {/* File Selected & Background Info */}
            {selectedFile && (
              <div className="bg-white rounded-2xl shadow-lg p-8">
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
                    className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent resize-y"
                    rows={3}
                  />
                </div>

                <button
                  onClick={() => {
                    // 文字起こしと要約を自動で実行する簡単なフローに変更
                    console.log('Start transcription for files:', splitFiles.length);
                  }}
                  disabled={!selectedFile || splitFiles.length === 0}
                  className="w-full px-6 py-4 bg-blue-600 text-white font-semibold rounded-xl hover:bg-blue-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  文字起こしを開始
                </button>
              </div>
            )}

            {/* Transcription & Summary - Unified Flow */}
            {splitFiles.length > 0 && (
              <div className="bg-white rounded-2xl shadow-lg p-8">
                <TranscriptionStep
                  splitFiles={splitFiles}
                  transcriptionResults={transcriptionResults}
                  onNext={() => {}} // No navigation needed
                  onBack={() => {}} // No navigation needed  
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
            )}

            {/* Summary Section */}
            {transcriptionResults.length > 0 && (
              <div className="bg-white rounded-2xl shadow-lg p-8">
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
                  onBack={() => {}} // No navigation needed
                  presetApiKey={apiKey}
                />
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
