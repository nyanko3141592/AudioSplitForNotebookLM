import { useState } from 'react';
import { TranscribePage } from './pages/TranscribePage';
import { SplitPage } from './pages/SplitPage';
import { 
  FileAudio, 
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
  const [currentPage, setCurrentPage] = useState<'transcribe' | 'split'>('transcribe');

  return (
    <div className="min-h-screen bg-gradient-to-br from-violet-50 via-blue-50 to-cyan-50">
      {/* Hero Section */}
      <div className="relative overflow-hidden bg-gradient-to-r from-violet-600 via-blue-600 to-cyan-600 animate-gradient-slow">
        <div className="absolute inset-0 bg-black/20"></div>
        <div className="relative container mx-auto px-6 py-6">
          <div className="text-center text-white">
            <div className="inline-flex items-center justify-center gap-3 mb-3">
              <div className="flex items-center justify-center p-2 bg-white/20 backdrop-blur-sm rounded-lg border border-white/30">
                {currentPage === 'transcribe' ? (
                  <FileAudio className="w-6 h-6" />
                ) : (
                  <Scissors className="w-6 h-6" />
                )}
              </div>
              <div className="text-left">
                <h1 className="text-2xl md:text-3xl font-bold">
                  {currentPage === 'transcribe' ? 'Audio Transcriber' : 'Audio Splitter'}
                </h1>
                <p className="text-sm text-white/90">for NotebookLM</p>
              </div>
            </div>
            <p className="text-sm text-white/80 max-w-md mx-auto mb-4">
              {currentPage === 'transcribe' 
                ? '音声ファイルを自動で文字起こし・要約'
                : '音声ファイルをNotebookLMの200MB制限に最適化'}
            </p>
            
            {/* Feature badges */}
            <div className="flex flex-wrap justify-center gap-2">
              <div className="inline-flex items-center px-2 py-1 bg-white/20 backdrop-blur-sm rounded-full border border-white/30">
                <Shield className="w-3 h-3 mr-1" />
                <span className="text-xs font-medium">完全プライベート処理</span>
              </div>
              <div className="inline-flex items-center px-2 py-1 bg-white/20 backdrop-blur-sm rounded-full border border-white/30">
                <Zap className="w-3 h-3 mr-1" />
                <span className="text-xs font-medium">
                  {currentPage === 'transcribe' ? '自動分割対応' : '高速処理'}
                </span>
              </div>
              <div className="inline-flex items-center px-2 py-1 bg-white/20 backdrop-blur-sm rounded-full border border-white/30">
                <Globe className="w-3 h-3 mr-1" />
                <span className="text-xs font-medium">インストール不要</span>
              </div>
            </div>
            
            {/* Navigation Tabs */}
            <div className="mt-6 flex justify-center gap-2">
              <button
                onClick={() => setCurrentPage('transcribe')}
                className={`px-4 py-2 rounded-lg font-medium transition-all ${
                  currentPage === 'transcribe'
                    ? 'bg-white text-violet-600 shadow-lg'
                    : 'bg-white/20 text-white hover:bg-white/30'
                }`}
              >
                <div className="flex items-center gap-2">
                  <FileAudio className="w-4 h-4" />
                  <span>文字起こし</span>
                </div>
              </button>
              <button
                onClick={() => setCurrentPage('split')}
                className={`px-4 py-2 rounded-lg font-medium transition-all ${
                  currentPage === 'split'
                    ? 'bg-white text-violet-600 shadow-lg'
                    : 'bg-white/20 text-white hover:bg-white/30'
                }`}
              >
                <div className="flex items-center gap-2">
                  <Scissors className="w-4 h-4" />
                  <span>音声分割</span>
                </div>
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Main Content */}
      {currentPage === 'transcribe' ? <TranscribePage /> : <SplitPage />}

      {/* Security Features Section */}
      <div className="max-w-6xl mx-auto px-6 mt-16">
        <div className="text-center mb-12">
          <h2 className="text-4xl font-bold bg-gradient-to-r from-violet-600 to-blue-600 bg-clip-text text-transparent mb-4">
            なぜAudioSplitなのか？
          </h2>
          <p className="text-lg text-gray-600">
            セキュリティと利便性を両立した音声処理ツール
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
      <footer className="text-center py-12 px-6">
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
  );
}

export default App;