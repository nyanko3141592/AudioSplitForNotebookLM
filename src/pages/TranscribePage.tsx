import { useState, useCallback, useEffect } from 'react';
import { FileUpload } from '../components/FileUpload';
import { TranscriptionStep } from '../components/steps/TranscriptionStep';
import { SummaryStep } from '../components/steps/SummaryStep';
import { type SplitFile } from '../components/DownloadList';
import { useFFmpeg } from '../hooks/useFFmpeg';
import { downloadFile, downloadAllAsZip } from '../utils/download';
import { 
  FileAudio, 
  Loader2,
  AlertCircle
} from 'lucide-react';
import type { TranscriptionResult } from '../utils/geminiTranscriber';
import { GeminiTranscriber, downloadTranscription } from '../utils/geminiTranscriber';

export function TranscribePage() {
  const [currentView, setCurrentView] = useState<'upload' | 'transcription' | 'summary'>('upload');
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [splitFiles, setSplitFiles] = useState<SplitFile[]>([]);
  const [transcriptionResults, setTranscriptionResults] = useState<TranscriptionResult[]>([]);
  const [transcriptionBackgroundInfo, setTranscriptionBackgroundInfo] = useState<string>('');
  const [autoProcessing, setAutoProcessing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  
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

  const handleFileSelect = useCallback(async (file: File) => {
    cleanupSplitFiles();
    setSelectedFile(file);
    setSplitFiles([]);
    setTranscriptionResults([]);
    setAutoProcessing(true);
    setError(null);
    
    // Check if file needs splitting (>200MB)
    const MAX_FILE_SIZE = 200 * 1024 * 1024; // 200MB in bytes
    
    if (file.size > MAX_FILE_SIZE) {
      // Auto-split large files
      setIsProcessing(true);
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
        
        setSplitFiles(files);
        setCurrentView('transcription');
      } catch (error) {
        console.error('Error splitting audio:', error);
        setError('音声ファイルの自動分割中にエラーが発生しました。');
      } finally {
        setIsProcessing(false);
        setAutoProcessing(false);
      }
    } else {
      // Use file directly without splitting
      const fileAsBlob = new Blob([file], { type: file.type });
      const splitFile: SplitFile = {
        name: file.name,
        size: file.size,
        blob: fileAsBlob
      };
      
      setSplitFiles([splitFile]);
      setCurrentView('transcription');
      setAutoProcessing(false);
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
      setCurrentView('summary');
    }
  };

  // Clean up on component unmount
  useEffect(() => {
    return () => {
      cleanupSplitFiles();
    };
  }, [cleanupSplitFiles]);

  return (
    <div className="min-h-screen bg-gradient-to-br from-violet-50 via-blue-50 to-cyan-50">
      <div className="container mx-auto px-6 py-8">
        <div className="max-w-4xl mx-auto">
          
          {/* Auto Processing Indicator */}
          {autoProcessing && (
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
          
          {/* View Content */}
          {currentView === 'upload' && !selectedFile && (
            <div className="bg-white/80 backdrop-blur-sm rounded-2xl shadow-xl p-8">
              <div className="flex items-center gap-3 mb-6">
                <div className="flex items-center justify-center p-3 bg-gradient-to-br from-violet-500 to-purple-600 rounded-xl shadow-lg">
                  <FileAudio className="w-6 h-6 text-white" />
                </div>
                <div>
                  <h2 className="text-2xl font-bold text-gray-800">音声ファイルをアップロード</h2>
                  <p className="text-sm text-gray-600 mt-1">文字起こししたい音声ファイルを選択</p>
                </div>
              </div>
              
              <FileUpload
                onFileSelect={handleFileSelect}
                isProcessing={isProcessing}
              />
              
              <div className="mt-4 p-4 bg-amber-50 border border-amber-200 rounded-lg">
                <p className="text-sm text-amber-800">
                  💡 200MB以上のファイルは自動的に分割して処理されます
                </p>
              </div>
            </div>
          )}
          
          {currentView === 'transcription' && splitFiles.length > 0 && (
            <TranscriptionStep
              splitFiles={splitFiles}
              transcriptionResults={transcriptionResults}
              onNext={() => setCurrentView('summary')}
              onDownloadSplit={handleDownload}
              onDownloadAllSplits={handleDownloadAll}
              onTranscriptionComplete={handleTranscriptionComplete}
              onBackgroundInfoChange={setTranscriptionBackgroundInfo}
            />
          )}
          
          {currentView === 'summary' && transcriptionResults.length > 0 && (
            <SummaryStep
              transcriptionResults={transcriptionResults}
              splitFiles={splitFiles}
              transcriptionBackgroundInfo={transcriptionBackgroundInfo}
              onDownloadSplit={handleDownload}
              onDownloadAllSplits={handleDownloadAll}
              onDownloadTranscription={() => {
                const transcriber = new GeminiTranscriber();
                const formatted = transcriber.formatTranscriptions(transcriptionResults);
                downloadTranscription(formatted);
              }}
            />
          )}
        </div>
      </div>
    </div>
  );
}