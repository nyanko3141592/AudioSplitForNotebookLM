import React, { useState, useEffect } from 'react';
import { Upload, Settings, FileAudio, Sparkles } from 'lucide-react';

type Props = {
  currentPage: 'transcribe' | 'split';
  onPageChange: (page: 'transcribe' | 'split') => void;
  // Step navigation props (optional for split page)
  hasFile?: boolean;
  hasApiKey?: boolean;
  hasSplitFiles?: boolean;
  hasTranscriptionResults?: boolean;
};

const steps = [
  {
    id: 'upload',
    label: 'ファイル選択',
    icon: Upload,
    shortLabel: 'アップロード',
  },
  {
    id: 'settings', 
    label: 'API設定',
    icon: Settings,
    shortLabel: 'API',
  },
  {
    id: 'transcription',
    label: '文字起こし', 
    icon: FileAudio,
    shortLabel: '文字起こし',
  },
  {
    id: 'summary',
    label: '要約作成',
    icon: Sparkles, 
    shortLabel: '要約',
  },
];

export const HeroSection: React.FC<Props> = ({ 
  currentPage: _currentPage, 
  onPageChange: _onPageChange, // eslint-disable-line @typescript-eslint/no-unused-vars
  hasFile = false,
  hasApiKey = false,
  hasSplitFiles = false,
  hasTranscriptionResults = false
}) => {
  const [isScrolled, setIsScrolled] = useState(false);
  const [currentStep, setCurrentStep] = useState('upload');

  useEffect(() => {
    const handleScroll = () => {
      const scrollTop = window.scrollY;
      setIsScrolled(scrollTop > 100);

      // Detect current step only on transcribe page and when scrolled
      if (_currentPage === 'transcribe' && scrollTop > 100) {
        const sections = [
          { id: 'upload', element: document.getElementById('upload') },
          { id: 'settings', element: document.querySelector('[data-step="settings"]') },
          { id: 'transcription', element: document.querySelector('[data-step="transcription"]') },
          { id: 'summary', element: document.querySelector('[data-step="summary"]') },
        ];

        let current = 'upload';
        const scrollOffset = scrollTop + 200;

        sections.forEach(section => {
          if (section.element) {
            const rect = section.element.getBoundingClientRect();
            const top = rect.top + window.scrollY;
            
            if (scrollOffset >= top) {
              current = section.id;
            }
          }
        });

        setCurrentStep(current);
      }
    };

    window.addEventListener('scroll', handleScroll);
    handleScroll();
    return () => window.removeEventListener('scroll', handleScroll);
  }, [_currentPage]);

  const scrollToSection = (stepId: string) => {
    let element: HTMLElement | null = null;
    
    if (stepId === 'upload') {
      element = document.getElementById('upload');
    } else {
      element = document.querySelector(`[data-step="${stepId}"]`);
    }

    if (element) {
      const headerOffset = 100;
      const elementPosition = element.getBoundingClientRect().top;
      const offsetPosition = elementPosition + window.pageYOffset - headerOffset;

      window.scrollTo({
        top: offsetPosition,
        behavior: 'smooth'
      });
    }
  };

  const getStepStatus = (stepId: string) => {
    switch (stepId) {
      case 'upload':
        return 'available';
      case 'settings':
        return hasFile ? 'available' : 'locked';
      case 'transcription': 
        return hasApiKey && hasSplitFiles ? 'available' : 'locked';
      case 'summary':
        return hasTranscriptionResults ? 'available' : 'locked';
      default:
        return 'locked';
    }
  };

  return (
    <>
      {/* Compact Header - appears when scrolled */}
      <div className={`fixed top-0 left-0 right-0 z-50 bg-white/95 backdrop-blur-sm border-b border-gray-200 transition-transform duration-300 ${
        isScrolled ? 'transform translate-y-0' : 'transform -translate-y-full'
      }`}>
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

            {/* Step Navigation - Only show on transcribe page */}
            {_currentPage === 'transcribe' && (
              <div className="flex items-center space-x-1">
                {steps.map((step, index) => {
                  const Icon = step.icon;
                  const status = getStepStatus(step.id);
                  const isCurrent = currentStep === step.id;
                  
                  return (
                    <div key={step.id} className="flex items-center">
                      <button
                        onClick={() => status === 'available' && scrollToSection(step.id)}
                        disabled={status === 'locked'}
                        className={`
                          group relative flex items-center gap-2 px-3 py-2 rounded-lg transition-all duration-200 text-sm font-medium
                          ${isCurrent 
                            ? 'bg-gradient-to-r from-violet-500 to-purple-500 text-white shadow-md' 
                            : status === 'available'
                            ? 'text-violet-600 hover:bg-violet-50'
                            : 'text-gray-400 cursor-not-allowed'
                          }
                        `}
                        title={step.label}
                      >
                        <Icon className={`w-4 h-4 ${isCurrent ? 'animate-pulse' : ''}`} />
                        <span className="hidden sm:inline">{step.shortLabel}</span>
                        
                        {/* Step number badge */}
                        <div className={`
                          w-5 h-5 rounded-full text-xs font-bold flex items-center justify-center
                          ${isCurrent 
                            ? 'bg-white text-violet-600' 
                            : status === 'available'
                            ? 'bg-violet-100 text-violet-600'
                            : 'bg-gray-200 text-gray-500'
                          }
                        `}>
                          {index + 1}
                        </div>
                      </button>
                      
                      {/* Arrow connector */}
                      {index < steps.length - 1 && (
                        <div className={`w-2 h-0.5 mx-1 ${
                          status === 'available' ? 'bg-violet-300' : 'bg-gray-300'
                        }`} />
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Main Hero Section */}
      <div className="bg-gradient-to-r from-violet-600 to-purple-600 py-8">
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
