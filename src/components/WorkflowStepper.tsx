import { CheckCircle, Circle, ArrowRight } from 'lucide-react';

interface WorkflowStepperProps {
  currentStep: number;
  onStepClick?: (step: number) => void;
  completedSteps: Set<number>;
  availableSteps: Set<number>;
}

const steps = [
  { id: 1, title: 'ファイル選択', description: '音声ファイルをアップロード' },
  { id: 2, title: '分割設定', description: 'サイズや分割数を設定' },
  { id: 3, title: '分割実行', description: '音声ファイルを分割' },
  { id: 4, title: '文字起こし', description: 'Gemini APIで文字起こし' },
  { id: 5, title: 'まとめ', description: 'AI で内容をまとめる' }
];

export function WorkflowStepper({ currentStep, onStepClick, completedSteps, availableSteps }: WorkflowStepperProps) {
  return (
    <div className="bg-white/80 backdrop-blur-sm rounded-3xl shadow-xl p-6 mb-6 border border-white/50">
      <h2 className="text-lg font-bold text-gray-800 mb-4 text-center">処理の流れ</h2>
      <div className="flex items-center justify-between max-w-4xl mx-auto">
        {steps.map((step, index) => (
          <div key={step.id} className="flex items-center">
            {/* Step Circle */}
            <div 
              className={`flex flex-col items-center ${
                availableSteps.has(step.id) ? 'cursor-pointer hover:scale-105 transition-transform' : 'cursor-not-allowed opacity-50'
              }`}
              onClick={() => availableSteps.has(step.id) && onStepClick?.(step.id)}
            >
              <div className={`
                flex items-center justify-center w-12 h-12 rounded-full border-2 mb-2 transition-all
                ${currentStep === step.id
                  ? 'bg-gradient-to-r from-violet-600 to-blue-600 border-violet-600 text-white scale-110 shadow-lg' 
                  : completedSteps.has(step.id)
                  ? 'bg-green-500 border-green-600 text-white'
                  : availableSteps.has(step.id)
                  ? 'bg-violet-100 border-violet-400 text-violet-600 hover:bg-violet-200'
                  : 'bg-gray-100 border-gray-300 text-gray-400'
                }
              `}>
                {completedSteps.has(step.id) ? (
                  <CheckCircle className="w-6 h-6" />
                ) : (
                  <Circle className="w-6 h-6" />
                )}
              </div>
              <div className="text-center min-w-[80px]">
                <p className={`text-xs font-medium ${
                  currentStep === step.id ? 'text-violet-700 font-bold' :
                  completedSteps.has(step.id) ? 'text-green-600' :
                  availableSteps.has(step.id) ? 'text-violet-600' : 
                  'text-gray-400'
                }`}>
                  {step.title}
                </p>
                <p className={`text-xs ${
                  currentStep === step.id ? 'text-gray-700' :
                  completedSteps.has(step.id) ? 'text-gray-600' :
                  availableSteps.has(step.id) ? 'text-gray-600' : 
                  'text-gray-400'
                }`}>
                  {step.description}
                </p>
                {currentStep === step.id && (
                  <p className="text-xs text-violet-600 font-medium mt-1">現在のステップ</p>
                )}
              </div>
            </div>
            
            {/* Arrow */}
            {index < steps.length - 1 && (
              <ArrowRight className={`w-4 h-4 mx-4 ${
                completedSteps.has(step.id) ? 'text-green-500' : 'text-gray-300'
              }`} />
            )}
          </div>
        ))}
      </div>
      
      {/* Skip Options */}
      <div className="mt-4 text-center">
        <p className="text-xs text-gray-500 mb-2">
          どのステップでも停止できます（例：分割のみ使用）
        </p>
        <div className="flex gap-2 justify-center">
          <button 
            onClick={() => onStepClick?.(3)}
            className="px-3 py-1 text-xs bg-gray-100 hover:bg-gray-200 rounded-full text-gray-600"
          >
            分割のみ
          </button>
          <button 
            onClick={() => onStepClick?.(4)}
            className="px-3 py-1 text-xs bg-gray-100 hover:bg-gray-200 rounded-full text-gray-600"
          >
            分割＋文字起こし
          </button>
          <button 
            onClick={() => onStepClick?.(5)}
            className="px-3 py-1 text-xs bg-gray-100 hover:bg-gray-200 rounded-full text-gray-600"
          >
            フル機能
          </button>
        </div>
      </div>
    </div>
  );
}