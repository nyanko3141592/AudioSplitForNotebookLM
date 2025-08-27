import { useEffect, useState } from 'react';
import { Upload, Settings, FileAudio, Sparkles } from 'lucide-react';

interface StepNavigatorProps {
  hasFile: boolean;
  hasApiKey: boolean;
  hasSplitFiles: boolean;
  hasTranscriptionResults: boolean;
}

const steps = [
  {
    id: 'upload',
    label: 'ファイル選択',
    icon: Upload,
    description: '音声ファイルをアップロード',
  },
  {
    id: 'settings', 
    label: 'API設定',
    icon: Settings,
    description: 'Gemini APIキーを設定',
  },
  {
    id: 'transcription',
    label: '文字起こし', 
    icon: FileAudio,
    description: 'AI文字起こし実行',
  },
  {
    id: 'summary',
    label: '要約作成',
    icon: Sparkles, 
    description: 'AIによる自動要約',
  },
];

export function StepNavigator({ hasFile, hasApiKey, hasSplitFiles, hasTranscriptionResults }: StepNavigatorProps) {
  const [currentStep, setCurrentStep] = useState('upload');

  // スクロール位置に基づいて現在のステップを検出
  useEffect(() => {
    const handleScroll = () => {
      const sections = [
        { id: 'upload', element: document.getElementById('upload') },
        { id: 'settings', element: document.querySelector('[data-step="settings"]') },
        { id: 'transcription', element: document.querySelector('[data-step="transcription"]') },
        { id: 'summary', element: document.querySelector('[data-step="summary"]') },
      ];

      let current = 'upload';
      const scrollY = window.scrollY + 200; // オフセットを追加

      sections.forEach(section => {
        if (section.element) {
          const rect = section.element.getBoundingClientRect();
          const top = rect.top + window.scrollY;
          
          if (scrollY >= top) {
            current = section.id;
          }
        }
      });

      setCurrentStep(current);
    };

    window.addEventListener('scroll', handleScroll);
    handleScroll(); // 初回実行
    
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

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

  // 各ステップの利用可能状態を判定
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
    <div className="fixed right-6 top-1/2 transform -translate-y-1/2 z-50">
      <div className="bg-white/95 backdrop-blur-sm rounded-2xl shadow-lg border border-white/50 p-4">
        <div className="space-y-3">
          {steps.map((step) => {
            const Icon = step.icon;
            const status = getStepStatus(step.id);
            const isCurrent = currentStep === step.id;
            
            return (
              <div key={step.id} className="relative">
                <button
                  onClick={() => status === 'available' && scrollToSection(step.id)}
                  disabled={status === 'locked'}
                  className={`
                    group relative flex items-center justify-center w-12 h-12 rounded-xl transition-all duration-200
                    ${isCurrent 
                      ? 'bg-gradient-to-r from-violet-500 to-purple-500 text-white shadow-lg scale-110' 
                      : status === 'available'
                      ? 'bg-violet-100 text-violet-600 hover:bg-violet-200 hover:scale-105'
                      : 'bg-gray-100 text-gray-400 cursor-not-allowed'
                    }
                  `}
                  title={step.description}
                >
                  <Icon className={`w-5 h-5 ${isCurrent ? 'animate-pulse' : ''}`} />
                  
                  {/* ステップ番号 */}
                  <div className={`
                    absolute -top-1 -right-1 w-5 h-5 rounded-full text-xs font-bold flex items-center justify-center
                    ${isCurrent 
                      ? 'bg-white text-violet-600' 
                      : status === 'available'
                      ? 'bg-violet-600 text-white'
                      : 'bg-gray-400 text-white'
                    }
                  `}>
                    {steps.findIndex(s => s.id === step.id) + 1}
                  </div>

                  {/* ホバー時のラベル */}
                  <div className="absolute right-full mr-3 opacity-0 group-hover:opacity-100 transition-opacity duration-200 pointer-events-none">
                    <div className="bg-gray-900 text-white text-xs px-2 py-1 rounded-lg whitespace-nowrap">
                      {step.label}
                      <div className="absolute left-full top-1/2 transform -translate-y-1/2 border-4 border-transparent border-l-gray-900"></div>
                    </div>
                  </div>
                </button>

                {/* 接続線 */}
                {step.id !== 'summary' && (
                  <div className={`
                    absolute left-1/2 transform -translate-x-1/2 top-12 w-0.5 h-3
                    ${status === 'available' ? 'bg-violet-300' : 'bg-gray-300'}
                  `} />
                )}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}