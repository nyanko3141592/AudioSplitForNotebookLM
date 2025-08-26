import React from 'react';
import { 
  FileAudio, 
  Mic,
  Upload,
  Shield, 
  Zap, 
  Globe 
} from 'lucide-react';

type Props = {
  currentPage: 'transcribe' | 'split';
  onPageChange: (page: 'transcribe' | 'split') => void;
  isRecordingActive?: boolean;
};

export const HeroSection: React.FC<Props> = ({ currentPage, onPageChange, isRecordingActive = false }) => {
  return (
    <div className="relative bg-gradient-to-br from-slate-900 via-purple-900 to-slate-900 min-h-screen flex items-center">
      <div className="absolute inset-0 bg-black/30"></div>
      <div className="relative w-full max-w-4xl mx-auto px-6 text-center">
        {/* Main Title */}
        <div className="mb-16">
          <h1 className="text-6xl md:text-7xl font-bold mb-6 text-white">
            爆速議事録
          </h1>
          <p className="text-xl md:text-2xl text-gray-300 mb-12">
            会議の録音から議事録まで、3分で完了
          </p>
        </div>

        {/* Action Buttons */}
        {currentPage === 'transcribe' && !isRecordingActive && (
          <div className="grid md:grid-cols-2 gap-8 max-w-2xl mx-auto">
            <a
              href="#record"
              className="group bg-white/10 backdrop-blur border border-white/20 rounded-2xl p-8 hover:bg-white/20 transition-all hover:scale-105"
            >
              <div className="text-center">
                <div className="w-16 h-16 bg-red-500 rounded-xl flex items-center justify-center mx-auto mb-4 group-hover:scale-110 transition-transform">
                  <Mic className="w-8 h-8 text-white" />
                </div>
                <h3 className="text-xl font-bold text-white mb-2">録音する</h3>
                <p className="text-gray-300 text-sm">リアルタイムで会議を録音</p>
              </div>
            </a>

            <a
              href="#upload"
              className="group bg-white/10 backdrop-blur border border-white/20 rounded-2xl p-8 hover:bg-white/20 transition-all hover:scale-105"
            >
              <div className="text-center">
                <div className="w-16 h-16 bg-blue-500 rounded-xl flex items-center justify-center mx-auto mb-4 group-hover:scale-110 transition-transform">
                  <Upload className="w-8 h-8 text-white" />
                </div>
                <h3 className="text-xl font-bold text-white mb-2">アップロード</h3>
                <p className="text-gray-300 text-sm">音声ファイルを選択</p>
              </div>
            </a>
          </div>
        )}

        {/* Recording State */}
        {currentPage === 'transcribe' && isRecordingActive && (
          <div className="max-w-lg mx-auto bg-red-900/30 border border-red-500/30 rounded-2xl p-8">
            <div className="text-center">
              <div className="w-16 h-16 bg-red-500 rounded-xl flex items-center justify-center mx-auto mb-4 animate-pulse">
                <Mic className="w-8 h-8 text-white" />
              </div>
              <h3 className="text-xl font-bold text-white mb-2">録音中...</h3>
              <p className="text-gray-300 text-sm">録音停止後に自動で処理開始</p>
            </div>
          </div>
        )}

        {/* Split Page Button */}
        {currentPage === 'split' && (
          <button
            onClick={() => onPageChange('transcribe')}
            className="bg-white/10 backdrop-blur border border-white/20 rounded-2xl px-6 py-3 text-white hover:bg-white/20 transition-all"
          >
            文字起こし
          </button>
        )}
      </div>
    </div>
  );
};