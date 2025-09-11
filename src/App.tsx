import { useState, useEffect, useCallback } from 'react';
import { TranscribePage } from './pages/TranscribePage';
import { SplitPage } from './pages/SplitPage';
import { SummaryPage } from './pages/SummaryPage';
import { HeroSection } from './components/HeroSection';
import { 
  Heart
} from 'lucide-react';

function App() {
  const [currentPage, setCurrentPage] = useState<'transcribe' | 'split' | 'summary'>('transcribe');
  const [isRecording, setIsRecording] = useState(false);
  const [hasUnsavedData, setHasUnsavedData] = useState(false);
  const [unsavedDetails, setUnsavedDetails] = useState<string[]>([]);

  const handleStepStateChange = useCallback((state: any) => {
    const details: string[] = [];
    if (state?.hasSplitFiles) details.push('音声ファイル');
    if (state?.hasTranscriptionResults) details.push('文字起こし結果');
    if (state?.hasBackgroundInfo) details.push('入力された背景情報');
    const has = details.length > 0;
    setHasUnsavedData(prev => (prev === has ? prev : has));
    setUnsavedDetails(prev => (
      prev.length === details.length && prev.every((v, i) => v === details[i]) ? prev : details
    ));
  }, []);

  // Listen for requests to open a specific summary item
  useEffect(() => {
    const handler = (e: Event) => {
      const ev = e as CustomEvent<{ id: string }>;
      try {
        if (ev.detail?.id) {
          window.localStorage.setItem('pendingOpenSummaryId', ev.detail.id);
        }
      } catch {}
      setCurrentPage('summary');
      window.scrollTo({ top: 0, behavior: 'smooth' });
    };
    window.addEventListener('openSummaryById', handler as EventListener);
    return () => window.removeEventListener('openSummaryById', handler as EventListener);
  }, []);

  const navigateWithConfirm = (next: 'transcribe' | 'split' | 'summary') => {
    if (currentPage === next) return;
    if (isRecording) {
      // Recording: keep strict (button is disabled in UI), but double-guard here
      alert('録音中はページ移動できません。録音を停止してください。');
      return;
    }
    if (hasUnsavedData) {
      const message = unsavedDetails.length > 0
        ? `${unsavedDetails.join('・')}が失われます。本当に移動しますか？`
        : '処理したデータが失われます。本当に移動しますか？';
      const ok = window.confirm(message);
      if (!ok) return;
    }
    setCurrentPage(next);
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-violet-50 via-blue-50 to-cyan-50">
      {/* Hero Section - Always visible */}
      <HeroSection 
        currentPage={currentPage} 
        onPageChange={navigateWithConfirm}
        isRecording={isRecording}
      />

      {/* Main Content */}
      {currentPage === 'transcribe' ? (
        <TranscribePage 
          onRecordingStateChange={setIsRecording}
          onStepStateChange={handleStepStateChange}
        />
      ) : currentPage === 'split' ? (
        <SplitPage />
      ) : (
        <SummaryPage />
      )}

      {/* Simple Footer */}
      {currentPage === 'transcribe' && (
        <footer className="bg-gray-900 py-8">
          <div className="max-w-4xl mx-auto text-center px-6">
            <a
              href="https://github.com/nyanko3141592/AudioSplitForNotebookLM"
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center text-gray-400 hover:text-white transition-colors"
            >
              <svg className="w-4 h-4 mr-2" fill="currentColor" viewBox="0 0 24 24">
                <path d="M12 0c-6.626 0-12 5.373-12 12 0 5.302 3.438 9.8 8.207 11.387.599.111.793-.261.793-.577v-2.234c-3.338.726-4.033-1.416-4.033-1.416-.546-1.387-1.333-1.756-1.333-1.756-1.089-.745.083-.729.083-.729 1.205.084 1.839 1.237 1.839 1.237 1.07 1.834 2.807 1.304 3.492.997.107-.775.418-1.305.762-1.604-2.665-.305-5.467-1.334-5.467-5.931 0-1.311.469-2.381 1.236-3.221-.124-.303-.535-1.524.117-3.176 0 0 1.008-.322 3.301 1.23.957-.266 1.983-.399 3.003-.404 1.02.005 2.047.138 3.006.404 2.291-1.552 3.297-1.30 3.297-1.30.653 1.653.242 2.874.118 3.176.77.84 1.235 1.911 1.235 3.221 0 4.609-2.807 5.624-5.479 5.921.43.372.823 1.102.823 2.222v3.293c0 .319.192.694.801.576 4.765-1.589 8.199-6.086 8.199-11.386 0-6.627-5.373-12-12-12z"/>
              </svg>
              <span>GitHub</span>
            </a>
            <p className="text-gray-500 mt-2 text-sm">
              Made with <Heart className="w-4 h-4 inline text-red-500" /> for NotebookLM users
            </p>
          </div>
        </footer>
      )}
    </div>
  );
}

export default App;
