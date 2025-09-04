import React from 'react';
import { Sparkles, Home } from 'lucide-react';

type Props = {
  currentPage: 'transcribe' | 'split' | 'summary';
  onPageChange: (page: 'transcribe' | 'split' | 'summary') => void;
  isRecording?: boolean;
};


export const HeroSection: React.FC<Props> = ({ 
  currentPage: _currentPage, 
  onPageChange: _onPageChange,
  isRecording = false
}) => {

  return (
    <>
      {/* Compact Header - always visible */}
      <div className="fixed top-0 left-0 right-0 z-50 bg-white/95 backdrop-blur-sm border-b border-gray-200">
        <div className="w-full px-4 sm:px-6 py-3">
          <div className="flex items-center justify-between">
            {/* Logo - Left Edge */}
            <div className="flex items-center">
              <img
                src={import.meta.env.BASE_URL + 'icon.png'}
                alt="爆速議事録 アイコン"
                className="w-8 h-8 drop-shadow-sm mr-3"
                loading="eager"
                decoding="async"
              />
              <span className="text-lg font-bold text-gray-900">爆速議事録</span>
            </div>

            {/* Navigation Buttons - Right Edge */}
            <div className="flex items-center gap-2">
              {isRecording && (
                <div className="flex items-center gap-2 px-3 py-2 bg-red-100 text-red-700 rounded-lg text-sm font-medium">
                  <div className="w-2 h-2 bg-red-500 rounded-full animate-pulse"></div>
                  <span className="hidden sm:inline">録画中</span>
                </div>
              )}
              <button
                onClick={() => !isRecording && _onPageChange('transcribe')}
                disabled={isRecording}
                className={`flex items-center gap-2 px-3 sm:px-4 py-2 rounded-lg transition-colors text-sm font-medium shadow-sm ${
                  isRecording 
                    ? 'bg-gray-100 text-gray-400 cursor-not-allowed'
                    : _currentPage === 'transcribe' || _currentPage === 'split'
                    ? 'bg-blue-600 text-white hover:bg-blue-700'
                    : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
                }`}
                title={isRecording ? '録画中はページ移動できません' : ''}
              >
                <Home className="w-4 h-4" />
                <span className="hidden sm:inline">ホーム</span>
              </button>
              <button
                onClick={() => !isRecording && _onPageChange('summary')}
                disabled={isRecording}
                className={`flex items-center gap-2 px-3 sm:px-4 py-2 rounded-lg transition-colors text-sm font-medium shadow-sm ${
                  isRecording
                    ? 'bg-gray-100 text-gray-400 cursor-not-allowed'
                    : _currentPage === 'summary'
                    ? 'bg-purple-600 text-white hover:bg-purple-700'
                    : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
                }`}
                title={isRecording ? '録画中はページ移動できません' : ''}
              >
                <Sparkles className="w-4 h-4" />
                <span className="hidden sm:inline">要約一覧</span>
                <span className="sm:hidden">要約</span>
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Main Hero Section - Only show on transcribe and split pages */}
      {(_currentPage === 'transcribe' || _currentPage === 'split') && (
        <div className="bg-gradient-to-r from-violet-600 to-purple-600 py-8 pt-20">
          <div className="max-w-6xl mx-auto px-6">
            <div className="text-center text-white">
              <div className="flex items-center justify-center mb-4">
                <img
                  src={import.meta.env.BASE_URL + 'icon.png'}
                  alt="爆速議事録 アイコン"
                  className="w-12 h-12 md:w-14 md:h-14 drop-shadow-lg"
                  loading="eager"
                  decoding="async"
                />
              </div>
              <h1 className="text-3xl md:text-4xl font-bold mb-6">
                爆速議事録
              </h1>
              <p className="text-xl text-white/90 mb-8 max-w-3xl mx-auto">
                オンラインミーティングから議事録まで3ステップで完了
              </p>
              
              <div className="grid md:grid-cols-3 gap-6 max-w-4xl mx-auto">
                <div className="bg-white/10 backdrop-blur-sm rounded-2xl p-6 border border-white/20">
                  <div className="text-3xl mb-3">🎙️</div>
                  <h3 className="text-lg font-semibold mb-2">オンラインミーティングを簡単録音</h3>
                  <p className="text-sm text-white/80">マイク＋タブ音声を同時録音。Google Meet / Teams / Zoom(ブラウザ)対応</p>
                </div>
                
                <div className="bg-white/10 backdrop-blur-sm rounded-2xl p-6 border border-white/20">
                  <div className="text-3xl mb-3">📝</div>
                  <h3 className="text-lg font-semibold mb-2">音声から簡単文字起こし＆議事録</h3>
                  <p className="text-sm text-white/80">AI（Gemini）で高精度な文字起こしと要約を自動生成</p>
                </div>
                
                <div className="bg-white/10 backdrop-blur-sm rounded-2xl p-6 border border-white/20">
                  <div className="text-3xl mb-3">🔒</div>
                  <h3 className="text-lg font-semibold mb-2">自分で入れたAPIのみで安心データ管理</h3>
                  <p className="text-sm text-white/80">音声データは外部送信せず、あなたのGemini APIキーのみで処理</p>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  );
};
