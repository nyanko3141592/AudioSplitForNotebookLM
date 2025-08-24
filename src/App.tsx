import { useState, useCallback, useEffect } from 'react';
import { FileUpload } from './components/FileUpload';
import { SplitOptions, type SplitMode } from './components/SplitOptions';
import { ProgressBar } from './components/ProgressBar';
import { DownloadList, type SplitFile } from './components/DownloadList';
import { useFFmpeg } from './hooks/useFFmpeg';
import { downloadFile, downloadAllAsZip } from './utils/download';
import { 
  Scissors, 
  Shield, 
  Zap, 
  Globe, 
  Lock,
  CheckCircle,
  Github,
  Heart
} from 'lucide-react';

function App() {
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [splitMode, setSplitMode] = useState<SplitMode>('size');
  const [maxSize, setMaxSize] = useState(190);
  const [splitCount, setSplitCount] = useState(2);
  const [isProcessing, setIsProcessing] = useState(false);
  const [splitFiles, setSplitFiles] = useState<SplitFile[]>([]);
  
  const { splitAudio, progress } = useFFmpeg();

  // Clean up function to release memory
  const cleanupSplitFiles = useCallback(() => {
    splitFiles.forEach(file => {
      // If any blob URLs were created, revoke them
      if (file.blob && (file as any).url) {
        URL.revokeObjectURL((file as any).url);
      }
    });
    console.log('Cleaned up previous split files');
  }, [splitFiles]);

  const handleFileSelect = useCallback((file: File) => {
    // Clean up previous split files
    cleanupSplitFiles();
    setSelectedFile(file);
    setSplitFiles([]);
  }, [cleanupSplitFiles]);

  const handleSplit = useCallback(async () => {
    if (!selectedFile) return;

    // Clean up any previous split files
    cleanupSplitFiles();
    
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
  }, [selectedFile, splitMode, maxSize, splitCount, splitAudio, cleanupSplitFiles]);

  const handleDownload = useCallback((file: SplitFile) => {
    downloadFile(file);
  }, []);

  const handleDownloadAll = useCallback(() => {
    if (selectedFile && splitFiles.length > 0) {
      downloadAllAsZip(splitFiles, selectedFile.name);
    }
  }, [splitFiles, selectedFile]);

  // Clean up on component unmount
  useEffect(() => {
    return () => {
      cleanupSplitFiles();
    };
  }, [cleanupSplitFiles]);

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-purple-50">
      {/* Hero Section */}
      <div className="relative overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-br from-blue-400/10 to-purple-400/10"></div>
        <div className="absolute -top-40 -right-40 w-80 h-80 bg-purple-300 rounded-full mix-blend-multiply filter blur-xl opacity-20 animate-blob"></div>
        <div className="absolute -bottom-40 -left-40 w-80 h-80 bg-blue-300 rounded-full mix-blend-multiply filter blur-xl opacity-20 animate-blob animation-delay-2000"></div>
        
        <div className="relative container mx-auto px-4 py-12">
          <div className="text-center">
            <div className="flex justify-center items-center space-x-3 mb-4">
              <div className="p-3 bg-gradient-to-br from-blue-500 to-purple-600 rounded-2xl shadow-lg">
                <Scissors className="w-10 h-10 text-white" />
              </div>
              <h1 className="text-5xl font-bold bg-gradient-to-r from-blue-600 to-purple-600 bg-clip-text text-transparent">
                AudioSplit
              </h1>
            </div>
            <p className="text-xl text-gray-600 mb-2">for NotebookLM</p>
            <p className="text-gray-500 max-w-2xl mx-auto">
              大容量の音声ファイルを簡単・安全にNotebookLMの200MB制限に最適化
            </p>
          </div>
        </div>
      </div>

      {/* Features Section */}
      <div className="container mx-auto px-4 py-8">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-8">
          <div className="bg-white rounded-xl p-6 shadow-lg hover:shadow-xl transition-shadow">
            <div className="flex items-center space-x-3 mb-3">
              <div className="p-2 bg-green-100 rounded-lg">
                <Shield className="w-6 h-6 text-green-600" />
              </div>
              <h3 className="font-semibold text-gray-800">完全プライベート処理</h3>
            </div>
            <p className="text-sm text-gray-600">
              音声ファイルはブラウザ内でのみ処理。
              サーバーへのアップロード一切なし。
            </p>
          </div>

          <div className="bg-white rounded-xl p-6 shadow-lg hover:shadow-xl transition-shadow">
            <div className="flex items-center space-x-3 mb-3">
              <div className="p-2 bg-blue-100 rounded-lg">
                <Zap className="w-6 h-6 text-blue-600" />
              </div>
              <h3 className="font-semibold text-gray-800">高速処理</h3>
            </div>
            <p className="text-sm text-gray-600">
              WebAssembly技術により、
              大容量ファイルも高速に分割。
            </p>
          </div>

          <div className="bg-white rounded-xl p-6 shadow-lg hover:shadow-xl transition-shadow">
            <div className="flex items-center space-x-3 mb-3">
              <div className="p-2 bg-purple-100 rounded-lg">
                <Globe className="w-6 h-6 text-purple-600" />
              </div>
              <h3 className="font-semibold text-gray-800">インストール不要</h3>
            </div>
            <p className="text-sm text-gray-600">
              ブラウザだけで動作。
              ソフトのインストール不要で今すぐ使える。
            </p>
          </div>
        </div>

        {/* Main Content */}
        <div className="max-w-4xl mx-auto">
          {/* File Upload Section */}
          <div className="bg-white rounded-2xl shadow-xl p-8 mb-6 border border-gray-100">
            <FileUpload 
              onFileSelect={handleFileSelect}
              disabled={isProcessing}
            />
            
            {selectedFile && (
              <div className="mt-6 p-4 bg-gradient-to-r from-blue-50 to-purple-50 rounded-xl border border-blue-200">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm text-gray-600">選択されたファイル</p>
                    <p className="font-semibold text-gray-900">{selectedFile.name}</p>
                  </div>
                  <div className="text-right">
                    <p className="text-sm text-gray-600">ファイルサイズ</p>
                    <p className="font-semibold text-gray-900">
                      {(selectedFile.size / (1024 * 1024)).toFixed(2)} MB
                    </p>
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* Split Options Section */}
          {selectedFile && (
            <div className="bg-white rounded-2xl shadow-xl p-8 mb-6 border border-gray-100">
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
                className="mt-6 w-full py-4 px-6 bg-gradient-to-r from-blue-600 to-purple-600 text-white font-semibold rounded-xl hover:from-blue-700 hover:to-purple-700 disabled:from-gray-400 disabled:to-gray-500 disabled:cursor-not-allowed transition-all duration-200 shadow-lg hover:shadow-xl transform hover:-translate-y-0.5"
              >
                {isProcessing ? (
                  <span className="flex items-center justify-center">
                    <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-white mr-3"></div>
                    処理中...
                  </span>
                ) : (
                  <span className="flex items-center justify-center">
                    <Scissors className="w-5 h-5 mr-2" />
                    分割開始
                  </span>
                )}
              </button>
            </div>
          )}

          {/* Progress Section */}
          {isProcessing && (
            <div className="bg-white rounded-2xl shadow-xl p-8 mb-6 border border-gray-100">
              <ProgressBar 
                progress={progress}
                message="音声ファイルを分割しています..."
              />
            </div>
          )}

          {/* Results Section */}
          {splitFiles.length > 0 && (
            <div className="bg-white rounded-2xl shadow-xl p-8 border border-gray-100">
              <DownloadList
                files={splitFiles}
                onDownload={handleDownload}
                onDownloadAll={handleDownloadAll}
              />
            </div>
          )}
        </div>

        {/* Security Features */}
        <div className="max-w-4xl mx-auto mt-12">
          <div className="bg-gradient-to-r from-green-50 to-blue-50 rounded-2xl p-8 border border-green-200">
            <h3 className="text-xl font-bold text-gray-800 mb-6 flex items-center">
              <Lock className="w-6 h-6 mr-2 text-green-600" />
              セキュリティ & プライバシー
            </h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="flex items-start space-x-3">
                <CheckCircle className="w-5 h-5 text-green-600 mt-0.5 flex-shrink-0" />
                <div>
                  <p className="font-semibold text-gray-800">ローカル処理</p>
                  <p className="text-sm text-gray-600">すべての処理はあなたのデバイス内で完結</p>
                </div>
              </div>
              <div className="flex items-start space-x-3">
                <CheckCircle className="w-5 h-5 text-green-600 mt-0.5 flex-shrink-0" />
                <div>
                  <p className="font-semibold text-gray-800">データ送信なし</p>
                  <p className="text-sm text-gray-600">外部サーバーへの通信は一切発生しません</p>
                </div>
              </div>
              <div className="flex items-start space-x-3">
                <CheckCircle className="w-5 h-5 text-green-600 mt-0.5 flex-shrink-0" />
                <div>
                  <p className="font-semibold text-gray-800">自動メモリ管理</p>
                  <p className="text-sm text-gray-600">処理後は自動的にメモリを解放</p>
                </div>
              </div>
              <div className="flex items-start space-x-3">
                <CheckCircle className="w-5 h-5 text-green-600 mt-0.5 flex-shrink-0" />
                <div>
                  <p className="font-semibold text-gray-800">オープンソース</p>
                  <p className="text-sm text-gray-600">GitHubでコードを公開・検証可能</p>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Footer */}
        <footer className="mt-16 pb-8 text-center">
          <div className="flex justify-center items-center space-x-6 mb-4">
            <a
              href="https://github.com/nyanko3141592/AudioSplitForNotebookLM"
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center space-x-2 text-gray-600 hover:text-gray-800 transition-colors"
            >
              <Github className="w-5 h-5" />
              <span>GitHub</span>
            </a>
          </div>
          <p className="text-sm text-gray-500">
            Made with <Heart className="w-4 h-4 inline text-red-500" /> for NotebookLM users
          </p>
        </footer>
      </div>
    </div>
  );
}

export default App;