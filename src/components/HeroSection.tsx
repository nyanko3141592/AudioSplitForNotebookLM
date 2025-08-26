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
    <div className="relative overflow-hidden bg-gradient-to-r from-violet-600 via-blue-600 to-cyan-600">
      <div className="absolute inset-0 bg-black/20"></div>
      <div className="absolute inset-0 bg-gradient-to-b from-transparent to-black/10"></div>
      <div className="relative container mx-auto px-6 py-12 md:py-16">
        <div className="text-center text-white">
          {/* Main Title */}
          <div className="mb-10">
            <div className="inline-flex items-center justify-center p-3 bg-white/10 backdrop-blur-sm border border-white/20 rounded-2xl mb-6">
              <span className="text-3xl">🎤</span>
            </div>
            <h1 className="text-5xl md:text-6xl font-bold mb-4 leading-tight">
              爆速議事録
            </h1>
            <p className="text-xl md:text-2xl text-white/90 mb-8 max-w-3xl mx-auto leading-relaxed">
              録音・アップロードから文字起こし・要約まで<br className="hidden md:block" />
              <span className="bg-gradient-to-r from-yellow-200 to-orange-200 bg-clip-text text-transparent font-semibold">すべて全自動</span>
            </p>
          </div>

          {/* Main Action Choice - Only for transcribe page */}
          {currentPage === 'transcribe' && !isRecordingActive && (
            <div className="mb-10">
              <h2 className="text-2xl md:text-3xl font-bold text-white mb-8">どちらから始めますか？</h2>
              <div className="flex flex-col sm:flex-row gap-6 justify-center items-center max-w-4xl mx-auto">
                {/* Recording Option */}
                <a
                  href="#record"
                  className="group flex-1 w-full sm:w-auto bg-white/10 backdrop-blur-sm border border-white/20 rounded-3xl p-8 hover:bg-white/20 transition-all duration-500 hover:scale-105 shadow-2xl hover:shadow-3xl"
                >
                  <div className="flex flex-col items-center">
                    <div className="w-20 h-20 bg-gradient-to-br from-red-500 to-pink-600 backdrop-blur-sm rounded-2xl flex items-center justify-center mb-6 group-hover:scale-110 transition-transform duration-300 shadow-xl">
                      <Mic className="w-10 h-10 text-white" />
                    </div>
                    <h3 className="text-2xl font-bold mb-3">いま録音する</h3>
                    <p className="text-white/80 text-center leading-relaxed">
                      マイク + 会議タブの音声を<br />
                      <span className="text-yellow-200 font-semibold">リアルタイムで録音</span>
                    </p>
                  </div>
                </a>

                {/* Upload Option */}
                <a
                  href="#upload"  
                  className="group flex-1 w-full sm:w-auto bg-white/10 backdrop-blur-sm border border-white/20 rounded-3xl p-8 hover:bg-white/20 transition-all duration-500 hover:scale-105 shadow-2xl hover:shadow-3xl"
                >
                  <div className="flex flex-col items-center">
                    <div className="w-20 h-20 bg-gradient-to-br from-blue-500 to-cyan-600 backdrop-blur-sm rounded-2xl flex items-center justify-center mb-6 group-hover:scale-110 transition-transform duration-300 shadow-xl">
                      <Upload className="w-10 h-10 text-white" />
                    </div>
                    <h3 className="text-2xl font-bold mb-3">ファイルをアップロード</h3>
                    <p className="text-white/80 text-center leading-relaxed">
                      既存の音声ファイルから<br />
                      <span className="text-yellow-200 font-semibold">文字起こし・要約を作成</span>
                    </p>
                  </div>
                </a>
              </div>
            </div>
          )}

          {/* Recording Active State - Only for transcribe page */}
          {currentPage === 'transcribe' && isRecordingActive && (
            <div className="mb-10">
              <div className="max-w-2xl mx-auto bg-red-500/20 backdrop-blur-sm border border-red-400/30 rounded-3xl p-8 shadow-2xl">
                <div className="flex flex-col items-center text-center">
                  <div className="w-20 h-20 bg-red-500/30 backdrop-blur-sm rounded-2xl flex items-center justify-center mb-6 animate-pulse shadow-xl">
                    <Mic className="w-10 h-10 text-white" />
                  </div>
                  <h3 className="text-2xl font-bold mb-3 text-white">録音中...</h3>
                  <p className="text-red-100 leading-relaxed">
                    マイクとタブの音声を録音しています<br />
                    <span className="text-yellow-200 font-semibold">録音停止後にファイルが自動で設定されます</span>
                  </p>
                </div>
              </div>
            </div>
          )}

          {/* Mode Toggle - Only for split page */}
          {currentPage === 'split' && (
            <div className="mb-6 flex justify-center gap-2">
              <button
                onClick={() => onPageChange('transcribe')}
                className="px-6 py-3 rounded-xl font-medium transition-all bg-white/20 text-white hover:bg-white/30"
              >
                <div className="flex items-center gap-2">
                  <FileAudio className="w-4 h-4" />
                  <span>文字起こしに戻る</span>
                </div>
              </button>
            </div>
          )}
          
          {/* Feature badges - enhanced */}
          <div className="flex flex-wrap justify-center gap-4 max-w-2xl mx-auto">
            <div className="inline-flex items-center px-4 py-3 bg-white/15 backdrop-blur-md rounded-full border border-white/30 shadow-lg hover:bg-white/25 transition-all duration-300">
              <Shield className="w-5 h-5 mr-2 text-green-300" />
              <span className="font-medium">完全プライベート処理</span>
            </div>
            <div className="inline-flex items-center px-4 py-3 bg-white/15 backdrop-blur-md rounded-full border border-white/30 shadow-lg hover:bg-white/25 transition-all duration-300">
              <Zap className="w-5 h-5 mr-2 text-yellow-300" />
              <span className="font-medium">自動分割対応</span>
            </div>
            <div className="inline-flex items-center px-4 py-3 bg-white/15 backdrop-blur-md rounded-full border border-white/30 shadow-lg hover:bg-white/25 transition-all duration-300">
              <Globe className="w-5 h-5 mr-2 text-blue-300" />
              <span className="font-medium">インストール不要</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};