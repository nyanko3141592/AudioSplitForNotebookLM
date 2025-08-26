import { useState } from 'react';
import { TranscribePage } from './pages/TranscribePage';
import { SplitPage } from './pages/SplitPage';
import { HeroSection } from './components/HeroSection';
import { 
  Lock,
  CheckCircle,
  Heart,
  Shield,
  Zap,
  Globe
} from 'lucide-react';

function App() {
  const [currentPage, setCurrentPage] = useState<'transcribe' | 'split'>('transcribe');
  const [isRecordingActive, setIsRecordingActive] = useState(false);

  return (
    <div className="min-h-screen bg-gradient-to-br from-violet-50 via-blue-50 to-cyan-50">
      {/* Hero Section */}
      <HeroSection 
        currentPage={currentPage} 
        onPageChange={setCurrentPage}
        isRecordingActive={isRecordingActive}
      />

      {/* Main Content */}
      {currentPage === 'transcribe' ? (
        <TranscribePage onRecordingStateChange={setIsRecordingActive} />
      ) : (
        <SplitPage />
      )}

      {/* Features Section */}
      <div className="max-w-7xl mx-auto px-6 py-20">
        <div className="text-center mb-16">
          <h2 className="text-4xl md:text-5xl font-bold bg-gradient-to-r from-violet-600 via-purple-600 to-blue-600 bg-clip-text text-transparent mb-6">
            なぜ選ばれるのか？
          </h2>
          <p className="text-xl text-gray-600 max-w-2xl mx-auto">
            セキュリティと利便性を両立した次世代音声処理ツール
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-8 mb-16">
          <div className="group bg-white/70 backdrop-blur-sm rounded-3xl p-8 shadow-xl hover:shadow-2xl transition-all duration-500 hover:scale-105 border border-white/20">
            <div className="w-16 h-16 bg-gradient-to-br from-green-400 to-emerald-600 rounded-2xl flex items-center justify-center mb-6 group-hover:scale-110 transition-transform duration-300">
              <Lock className="w-8 h-8 text-white" />
            </div>
            <h3 className="text-xl font-bold text-gray-800 mb-3">完全ローカル処理</h3>
            <p className="text-gray-600 leading-relaxed">あなたのデバイス内で完結。外部サーバーは一切使用せず、プライバシーを完全保護。</p>
          </div>

          <div className="group bg-white/70 backdrop-blur-sm rounded-3xl p-8 shadow-xl hover:shadow-2xl transition-all duration-500 hover:scale-105 border border-white/20">
            <div className="w-16 h-16 bg-gradient-to-br from-blue-400 to-cyan-600 rounded-2xl flex items-center justify-center mb-6 group-hover:scale-110 transition-transform duration-300">
              <Zap className="w-8 h-8 text-white" />
            </div>
            <h3 className="text-xl font-bold text-gray-800 mb-3">爆速処理</h3>
            <p className="text-gray-600 leading-relaxed">WebAssembly技術により、大容量ファイルも瞬時に分割・処理が可能。</p>
          </div>

          <div className="group bg-white/70 backdrop-blur-sm rounded-3xl p-8 shadow-xl hover:shadow-2xl transition-all duration-500 hover:scale-105 border border-white/20">
            <div className="w-16 h-16 bg-gradient-to-br from-purple-400 to-violet-600 rounded-2xl flex items-center justify-center mb-6 group-hover:scale-110 transition-transform duration-300">
              <Globe className="w-8 h-8 text-white" />
            </div>
            <h3 className="text-xl font-bold text-gray-800 mb-3">ブラウザで完結</h3>
            <p className="text-gray-600 leading-relaxed">ソフトウェアのインストール不要。ブラウザを開くだけですぐに使用開始。</p>
          </div>

          <div className="group bg-white/70 backdrop-blur-sm rounded-3xl p-8 shadow-xl hover:shadow-2xl transition-all duration-500 hover:scale-105 border border-white/20">
            <div className="w-16 h-16 bg-gradient-to-br from-orange-400 to-red-600 rounded-2xl flex items-center justify-center mb-6 group-hover:scale-110 transition-transform duration-300">
              <CheckCircle className="w-8 h-8 text-white" />
            </div>
            <h3 className="text-xl font-bold text-gray-800 mb-3">オープンソース</h3>
            <p className="text-gray-600 leading-relaxed">GitHubでソースコードを公開。透明性と安全性を重視した開発。</p>
          </div>
        </div>
      </div>

      {/* Footer */}
      <footer className="bg-gradient-to-r from-gray-900 via-gray-800 to-gray-900 text-white py-16">
        <div className="max-w-4xl mx-auto text-center px-6">
          <div className="mb-8">
            <h3 className="text-2xl font-bold mb-4">始めてみませんか？</h3>
            <p className="text-gray-300 mb-6">
              音声ファイルから議事録まで、すべて自動で完了します
            </p>
            <a
              href="#record"
              className="inline-flex items-center px-8 py-4 bg-gradient-to-r from-violet-600 to-purple-600 hover:from-violet-700 hover:to-purple-700 text-white font-semibold rounded-full transition-all duration-300 transform hover:scale-105 shadow-lg hover:shadow-xl"
            >
              <span>今すぐ始める</span>
            </a>
          </div>
          
          <div className="border-t border-gray-700 pt-8">
            <div className="flex justify-center items-center space-x-6 mb-6">
              <a
                href="https://github.com/nyanko3141592/AudioSplitForNotebookLM"
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center px-6 py-3 bg-white/10 hover:bg-white/20 backdrop-blur-sm border border-white/20 rounded-full transition-all duration-300 hover:scale-105"
              >
                <svg className="w-5 h-5 mr-2" fill="currentColor" viewBox="0 0 24 24">
                  <path d="M12 0c-6.626 0-12 5.373-12 12 0 5.302 3.438 9.8 8.207 11.387.599.111.793-.261.793-.577v-2.234c-3.338.726-4.033-1.416-4.033-1.416-.546-1.387-1.333-1.756-1.333-1.756-1.089-.745.083-.729.083-.729 1.205.084 1.839 1.237 1.839 1.237 1.07 1.834 2.807 1.304 3.492.997.107-.775.418-1.305.762-1.604-2.665-.305-5.467-1.334-5.467-5.931 0-1.311.469-2.381 1.236-3.221-.124-.303-.535-1.524.117-3.176 0 0 1.008-.322 3.301 1.23.957-.266 1.983-.399 3.003-.404 1.02.005 2.047.138 3.006.404 2.291-1.552 3.297-1.23 3.297-1.23.653 1.653.242 2.874.118 3.176.77.84 1.235 1.911 1.235 3.221 0 4.609-2.807 5.624-5.479 5.921.43.372.823 1.102.823 2.222v3.293c0 .319.192.694.801.576 4.765-1.589 8.199-6.086 8.199-11.386 0-6.627-5.373-12-12-12z"/>
                </svg>
                <span className="font-medium">GitHub</span>
              </a>
            </div>
            <p className="text-gray-400">
              Made with <Heart className="w-5 h-5 inline text-red-500" /> for NotebookLM users
            </p>
          </div>
        </div>
      </footer>
    </div>
  );
}

export default App;