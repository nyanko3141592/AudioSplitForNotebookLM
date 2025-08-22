import { useState, useCallback } from 'react';
import { FileUpload } from './components/FileUpload';
import { SplitOptions, type SplitMode } from './components/SplitOptions';
import { ProgressBar } from './components/ProgressBar';
import { DownloadList, type SplitFile } from './components/DownloadList';
import { useFFmpeg } from './hooks/useFFmpeg';
import { downloadFile, downloadAllAsZip } from './utils/download';
import { Scissors } from 'lucide-react';

function App() {
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [splitMode, setSplitMode] = useState<SplitMode>('size');
  const [maxSize, setMaxSize] = useState(190);
  const [splitCount, setSplitCount] = useState(2);
  const [isProcessing, setIsProcessing] = useState(false);
  const [splitFiles, setSplitFiles] = useState<SplitFile[]>([]);
  
  const { splitAudio, progress } = useFFmpeg();

  const handleFileSelect = useCallback((file: File) => {
    setSelectedFile(file);
    setSplitFiles([]);
  }, []);

  const handleSplit = useCallback(async () => {
    if (!selectedFile) return;

    setIsProcessing(true);
    setSplitFiles([]);

    try {
      const options = splitMode === 'size' 
        ? { maxSize } 
        : { count: splitCount };
      
      const blobs = await splitAudio(selectedFile, splitMode, options);
      
      const files: SplitFile[] = blobs.map((blob, index) => {
        const baseName = selectedFile.name.replace(/\.[^/.]+$/, '');
        const extension = selectedFile.name.split('.').pop();
        return {
          name: `${baseName}_part${index + 1}.${extension}`,
          size: blob.size,
          blob
        };
      });
      
      setSplitFiles(files);
    } catch (error) {
      console.error('Error splitting audio:', error);
      alert('音声ファイルの分割中にエラーが発生しました。');
    } finally {
      setIsProcessing(false);
    }
  }, [selectedFile, splitMode, maxSize, splitCount, splitAudio]);

  const handleDownload = useCallback((file: SplitFile) => {
    downloadFile(file);
  }, []);

  const handleDownloadAll = useCallback(() => {
    if (selectedFile && splitFiles.length > 0) {
      downloadAllAsZip(splitFiles, selectedFile.name);
    }
  }, [splitFiles, selectedFile]);

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="container mx-auto px-4 py-8 max-w-4xl">
        <div className="text-center mb-8">
          <div className="flex justify-center items-center space-x-2 mb-4">
            <Scissors className="w-8 h-8 text-blue-600" />
            <h1 className="text-3xl font-bold text-gray-900">
              AudioSplit for NotebookLM
            </h1>
          </div>
          <p className="text-gray-600">
            NotebookLMの200MB制限に対応した音声ファイル分割ツール
          </p>
        </div>

        <div className="bg-white rounded-lg shadow-md p-6 mb-6">
          <FileUpload 
            onFileSelect={handleFileSelect}
            disabled={isProcessing}
          />
          
          {selectedFile && (
            <div className="mt-4 p-4 bg-blue-50 rounded-lg">
              <p className="text-sm text-blue-900">
                選択されたファイル: <span className="font-semibold">{selectedFile.name}</span>
              </p>
              <p className="text-sm text-blue-700">
                サイズ: {(selectedFile.size / (1024 * 1024)).toFixed(2)} MB
              </p>
            </div>
          )}
        </div>

        {selectedFile && (
          <div className="bg-white rounded-lg shadow-md p-6 mb-6">
            <SplitOptions
              mode={splitMode}
              onModeChange={setSplitMode}
              maxSize={maxSize}
              onMaxSizeChange={setMaxSize}
              splitCount={splitCount}
              onSplitCountChange={setSplitCount}
              disabled={isProcessing}
            />
            
            <button
              onClick={handleSplit}
              disabled={isProcessing}
              className="mt-6 w-full py-3 px-4 bg-blue-600 text-white font-semibold rounded-lg hover:bg-blue-700 disabled:bg-gray-400 disabled:cursor-not-allowed transition-colors"
            >
              {isProcessing ? '処理中...' : '分割開始'}
            </button>
          </div>
        )}

        {isProcessing && (
          <div className="bg-white rounded-lg shadow-md p-6 mb-6">
            <ProgressBar 
              progress={progress}
              message="音声ファイルを分割しています..."
            />
          </div>
        )}

        {splitFiles.length > 0 && (
          <div className="bg-white rounded-lg shadow-md p-6">
            <DownloadList
              files={splitFiles}
              onDownload={handleDownload}
              onDownloadAll={handleDownloadAll}
            />
          </div>
        )}
      </div>
    </div>
  );
}

export default App;