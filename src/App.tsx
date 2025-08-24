import { useState, useCallback, useEffect } from 'react';
import { FileUpload } from './components/FileUpload';
import { SplitOptions, type SplitMode } from './components/SplitOptions';
import { ProgressBar } from './components/ProgressBar';
import { DownloadList, type SplitFile } from './components/DownloadList';
import { TranscriptionPanel } from './components/TranscriptionPanel';
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
    <div className="min-h-screen bg-gradient-to-br from-violet-50 via-blue-50 to-cyan-50">
      {/* Hero Section */}
      <div className="relative overflow-hidden bg-gradient-to-r from-violet-600 via-blue-600 to-cyan-600 animate-gradient-slow">
        <div className="absolute inset-0 bg-black/20"></div>
        <div className="relative container mx-auto px-6 py-20">
          <div className="text-center text-white">
            <div className="inline-flex items-center justify-center p-4 mb-6 bg-white/20 backdrop-blur-sm rounded-2xl border border-white/30">
              <Scissors className="w-12 h-12" />
            </div>
            <h1 className="text-6xl md:text-7xl font-bold mb-4 animate-float">
              AudioSplit
            </h1>
            <p className="text-xl md:text-2xl mb-2 text-white/90">for NotebookLM</p>
            <p className="text-lg text-white/80 max-w-2xl mx-auto mb-8">
              大容量音声ファイルを安全・簡単にNotebookLMの200MB制限に最適化
            </p>
            
            {/* Feature badges */}
            <div className="flex flex-wrap justify-center gap-4 mb-8">
              <div className="inline-flex items-center px-4 py-2 bg-white/20 backdrop-blur-sm rounded-full border border-white/30">
                <Shield className="w-4 h-4 mr-2" />
                <span className="text-sm font-medium">完全プライベート処理</span>
              </div>
              <div className="inline-flex items-center px-4 py-2 bg-white/20 backdrop-blur-sm rounded-full border border-white/30">
                <Zap className="w-4 h-4 mr-2" />
                <span className="text-sm font-medium">高速処理</span>
              </div>
              <div className="inline-flex items-center px-4 py-2 bg-white/20 backdrop-blur-sm rounded-full border border-white/30">
                <Globe className="w-4 h-4 mr-2" />
                <span className="text-sm font-medium">インストール不要</span>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div className="container mx-auto px-6 py-12">
        <div className="max-w-4xl mx-auto">
          
          {/* File Upload Section */}
          <div className="bg-white/80 backdrop-blur-sm rounded-3xl shadow-xl p-8 mb-8 border border-white/50">
            <FileUpload 
              onFileSelect={handleFileSelect}
              disabled={isProcessing}
            />
            
            {selectedFile && (
              <div className="mt-6 p-6 bg-gradient-to-r from-blue-100 to-violet-100 rounded-2xl border border-blue-200">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm text-gray-600 mb-1">選択されたファイル</p>
                    <p className="font-bold text-gray-900">{selectedFile.name}</p>
                  </div>
                  <div className="text-right">
                    <p className="text-sm text-gray-600 mb-1">ファイルサイズ</p>
                    <p className="font-bold text-2xl bg-gradient-to-r from-blue-600 to-violet-600 bg-clip-text text-transparent">
                      {(selectedFile.size / (1024 * 1024)).toFixed(2)} MB
                    </p>
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* Split Options Section */}
          {selectedFile && (
            <div className="bg-white/80 backdrop-blur-sm rounded-3xl shadow-xl p-8 mb-8 border border-white/50">
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
                className="mt-8 w-full py-4 px-8 bg-gradient-to-r from-violet-600 to-blue-600 hover:from-violet-700 hover:to-blue-700 text-white font-bold rounded-2xl shadow-lg hover:shadow-xl transform hover:scale-[1.02] transition-all duration-200 disabled:from-gray-400 disabled:to-gray-500 disabled:cursor-not-allowed disabled:transform-none"
              >
                {isProcessing ? (
                  <span className="flex items-center justify-center">
                    <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-white mr-3"></div>
                    処理中...
                  </span>
                ) : (
                  <span className="flex items-center justify-center text-lg">
                    <Scissors className="w-6 h-6 mr-3" />
                    分割開始
                  </span>
                )}
              </button>
            </div>
          )}

          {/* Progress Section */}
          {isProcessing && (
            <div className="bg-white/80 backdrop-blur-sm rounded-3xl shadow-xl p-8 mb-8 border border-white/50">
              <ProgressBar 
                progress={progress}
                message="音声ファイルを分割しています..."
              />
            </div>
          )}

          {/* Results Section */}
          {splitFiles.length > 0 && (
            <>
              <div className="bg-white/80 backdrop-blur-sm rounded-3xl shadow-xl p-8 mb-8 border border-white/50">
                <DownloadList
                  files={splitFiles}
                  onDownload={handleDownload}
                  onDownloadAll={handleDownloadAll}
                />
              </div>
              
              {/* Transcription Section */}
              <div className="bg-white/80 backdrop-blur-sm rounded-3xl shadow-xl p-8 border border-white/50">
                <TranscriptionPanel
                  splitFiles={splitFiles}
                  isProcessing={isProcessing}
                />
              </div>
            </>
          )}
        </div>

        {/* Security Features Section */}
        <div className="max-w-6xl mx-auto mt-16">
          <div className="text-center mb-12">
            <h2 className="text-4xl font-bold bg-gradient-to-r from-violet-600 to-blue-600 bg-clip-text text-transparent mb-4">
              なぜAudioSplitなのか？
            </h2>
            <p className="text-lg text-gray-600">
              セキュリティと利便性を両立した音声分割ツール
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-12">
            <div className="bg-white/60 backdrop-blur-sm rounded-2xl p-6 shadow-lg hover:shadow-xl transition-all duration-300 hover:scale-105">
              <div className="w-12 h-12 bg-gradient-to-br from-green-400 to-emerald-600 rounded-xl flex items-center justify-center mb-4">
                <Lock className="w-6 h-6 text-white" />
              </div>
              <h3 className="font-bold text-gray-800 mb-2">完全ローカル処理</h3>
              <p className="text-sm text-gray-600">あなたのデバイス内で完結。外部サーバーは一切使用しません。</p>
            </div>

            <div className="bg-white/60 backdrop-blur-sm rounded-2xl p-6 shadow-lg hover:shadow-xl transition-all duration-300 hover:scale-105">
              <div className="w-12 h-12 bg-gradient-to-br from-blue-400 to-cyan-600 rounded-xl flex items-center justify-center mb-4">
                <Zap className="w-6 h-6 text-white" />
              </div>
              <h3 className="font-bold text-gray-800 mb-2">高速処理</h3>
              <p className="text-sm text-gray-600">WebAssembly技術で大容量ファイルも瞬時に分割。</p>
            </div>

            <div className="bg-white/60 backdrop-blur-sm rounded-2xl p-6 shadow-lg hover:shadow-xl transition-all duration-300 hover:scale-105">
              <div className="w-12 h-12 bg-gradient-to-br from-purple-400 to-violet-600 rounded-xl flex items-center justify-center mb-4">
                <Globe className="w-6 h-6 text-white" />
              </div>
              <h3 className="font-bold text-gray-800 mb-2">ブラウザで完結</h3>
              <p className="text-sm text-gray-600">ソフトウェアのインストール不要。今すぐ使えます。</p>
            </div>

            <div className="bg-white/60 backdrop-blur-sm rounded-2xl p-6 shadow-lg hover:shadow-xl transition-all duration-300 hover:scale-105">
              <div className="w-12 h-12 bg-gradient-to-br from-orange-400 to-red-600 rounded-xl flex items-center justify-center mb-4">
                <CheckCircle className="w-6 h-6 text-white" />
              </div>
              <h3 className="font-bold text-gray-800 mb-2">オープンソース</h3>
              <p className="text-sm text-gray-600">GitHubでコードを公開。安全性を確認できます。</p>
            </div>
          </div>
        </div>

        {/* Footer */}
        <footer className="text-center py-12">
          <div className="flex justify-center items-center space-x-6 mb-6">
            <a
              href="https://github.com/nyanko3141592/AudioSplitForNotebookLM"
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center px-6 py-3 bg-gray-900 hover:bg-gray-800 text-white rounded-full transition-colors duration-200 shadow-lg hover:shadow-xl"
            >
              <Github className="w-5 h-5 mr-2" />
              <span className="font-medium">GitHub</span>
            </a>
          </div>
          <p className="text-gray-600">
            Made with <Heart className="w-5 h-5 inline text-red-500" /> for NotebookLM users
          </p>
        </footer>
      </div>
    </div>
  );
}

export default App;