import React from 'react';
import { Sparkles } from 'lucide-react';

type Props = {
  currentPage: 'transcribe' | 'split' | 'summary';
  onPageChange: (page: 'transcribe' | 'split' | 'summary') => void;
};


export const HeroSection: React.FC<Props> = ({ 
  currentPage: _currentPage, 
  onPageChange: _onPageChange
}) => {

  return (
    <>
      {/* Compact Header - always visible */}
      <div className="fixed top-0 left-0 right-0 z-50 bg-white/95 backdrop-blur-sm border-b border-gray-200">
        <div className="max-w-6xl mx-auto px-6 py-3">
          <div className="flex items-center justify-between">
            {/* Logo */}
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

            {/* Summary Page Link - Always visible */}
            <button
              onClick={() => _onPageChange('summary')}
              className="flex items-center gap-2 px-4 py-2 rounded-lg bg-purple-600 text-white hover:bg-purple-700 transition-colors text-sm font-medium shadow-sm"
            >
              <Sparkles className="w-4 h-4" />
              <span className="hidden sm:inline">要約一覧</span>
              <span className="sm:hidden">要約</span>
            </button>
          </div>
        </div>
      </div>

      {/* Main Hero Section */}
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
    </>
  );
};
