import { useState, useCallback, useEffect } from 'react';
import { WorkflowStepper } from './components/WorkflowStepper';
import { FileSelectionStep } from './components/steps/FileSelectionStep';
import { SplitConfigStep } from './components/steps/SplitConfigStep';
import { SplitResultsStep } from './components/steps/SplitResultsStep';
import { TranscriptionStep } from './components/steps/TranscriptionStep';
import { SummaryStep } from './components/steps/SummaryStep';
import { type SplitMode } from './components/SplitOptions';
import { type SplitFile } from './components/DownloadList';
import { useFFmpeg } from './hooks/useFFmpeg';
import { downloadFile, downloadAllAsZip } from './utils/download';
import { 
  Scissors, 
  Shield, 
  Zap, 
  Globe, 
  Lock,
  CheckCircle,
  Github,
  Heart
} from 'lucide-react';
import type { TranscriptionResult } from './utils/geminiTranscriber';
import { GeminiTranscriber, downloadTranscription } from './utils/geminiTranscriber';

function App() {
  const [currentStep, setCurrentStep] = useState(1);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [splitMode, setSplitMode] = useState<SplitMode>('size');
  const [maxSize, setMaxSize] = useState(190);
  const [splitCount, setSplitCount] = useState(2);
  const [isProcessing, setIsProcessing] = useState(false);
  const [splitFiles, setSplitFiles] = useState<SplitFile[]>([]);
  const [transcriptionResults, setTranscriptionResults] = useState<TranscriptionResult[]>([]);
  // const [summaryResult, setSummaryResult] = useState<string>(''); // TODO: Implement summary result handling
  const [completedSteps, setCompletedSteps] = useState<Set<number>>(new Set());
  const [availableSteps, setAvailableSteps] = useState<Set<number>>(new Set([1]));
  
  const { splitAudio, progress } = useFFmpeg();

  // Clean up function to release memory
  const cleanupSplitFiles = useCallback(() => {
    splitFiles.forEach(file => {
      // If any blob URLs were created, revoke them
      if (file.blob && (file as any).url) {
        URL.revokeObjectURL((file as any).url);
      }
    });
    console.log('Cleaned up previous split files');
  }, [splitFiles]);

  const handleFileSelect = useCallback((file: File) => {
    // Clean up previous split files
    cleanupSplitFiles();
    setSelectedFile(file);
    setSplitFiles([]);
    setTranscriptionResults([]);
    // Mark step 1 as completed and make step 2 available
    setCompletedSteps(new Set([1]));
    setAvailableSteps(new Set([1, 2]));
  }, [cleanupSplitFiles]);

  const handleSplit = useCallback(async () => {
    if (!selectedFile) return;

    // Clean up any previous split files
    cleanupSplitFiles();
    
    setIsProcessing(true);
    setSplitFiles([]);

    try {
      const options = splitMode === 'size' 
        ? { maxSize } 
        : { count: splitCount };
      
      const blobs = await splitAudio(selectedFile, splitMode, options);
      
      const files: SplitFile[] = blobs.map((blob, index) => {
        const baseName = selectedFile.name.replace(/\.[^/.]+$/, '');
        const extension = selectedFile.name.split('.').pop();
        return {
          name: `${baseName}_part${index + 1}.${extension}`,
          size: blob.size,
          blob
        };
      });
      
      setSplitFiles(files);
      // Mark step 2 as completed and make steps 3 and 4 available
      setCompletedSteps(prev => new Set([...prev, 2]));
      setAvailableSteps(new Set([1, 2, 3, 4]));
      setCurrentStep(3); // Move to results step
    } catch (error) {
      console.error('Error splitting audio:', error);
      alert('音声ファイルの分割中にエラーが発生しました。');
    } finally {
      setIsProcessing(false);
    }
  }, [selectedFile, splitMode, maxSize, splitCount, splitAudio, cleanupSplitFiles]);

  const handleDownload = useCallback((file: SplitFile) => {
    downloadFile(file);
  }, []);

  const handleDownloadAll = useCallback(() => {
    if (selectedFile && splitFiles.length > 0) {
      downloadAllAsZip(splitFiles, selectedFile.name);
    }
  }, [splitFiles, selectedFile]);

  // Clean up on component unmount
  useEffect(() => {
    return () => {
      cleanupSplitFiles();
    };
  }, [cleanupSplitFiles]);

  const handleStepNavigation = (step: number) => {
    // Allow navigation to any available step
    if (availableSteps.has(step)) {
      setCurrentStep(step);
    }
  };

  const handleTranscriptionComplete = (results: TranscriptionResult[]) => {
    setTranscriptionResults(results);
    // Mark step 4 as completed and make step 5 available
    if (results.length > 0 && results.some(r => !r.error)) {
      setCompletedSteps(prev => new Set([...prev, 4]));
      setAvailableSteps(new Set([1, 2, 3, 4, 5]));
    }
  };

  const renderCurrentStep = () => {
    switch (currentStep) {
      case 1:
        return (
          <FileSelectionStep
            selectedFile={selectedFile}
            onFileSelect={handleFileSelect}
            onNext={() => setCurrentStep(2)}
            isProcessing={isProcessing}
          />
        );
      case 2:
        return (
          <SplitConfigStep
            splitMode={splitMode}
            onModeChange={setSplitMode}
            maxSize={maxSize}
            onMaxSizeChange={setMaxSize}
            splitCount={splitCount}
            onSplitCountChange={setSplitCount}
            onNext={handleSplit}
            isProcessing={isProcessing}
          />
        );
      case 3:
        return (
          <SplitResultsStep
            splitFiles={splitFiles}
            onDownload={handleDownload}
            onDownloadAll={handleDownloadAll}
            onNext={() => setCurrentStep(4)}
            isProcessing={isProcessing}
            progress={progress}
          />
        );
      case 4:
        return (
          <TranscriptionStep
            splitFiles={splitFiles}
            transcriptionResults={transcriptionResults}
            onNext={() => setCurrentStep(5)}
            onDownloadSplit={handleDownload}
            onDownloadAllSplits={handleDownloadAll}
            onTranscriptionComplete={handleTranscriptionComplete}
          />
        );
      case 5:
        return (
          <SummaryStep
            transcriptionResults={transcriptionResults}
            splitFiles={splitFiles}
            onDownloadSplit={handleDownload}
            onDownloadAllSplits={handleDownloadAll}
            onDownloadTranscription={() => {
              // Implement transcription download
              const transcriber = new GeminiTranscriber();
              const formatted = transcriber.formatTranscriptions(transcriptionResults);
              downloadTranscription(formatted);
            }}
          />
        );
      default:
        return null;
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-violet-50 via-blue-50 to-cyan-50">
      {/* Hero Section */}
      <div className="relative overflow-hidden bg-gradient-to-r from-violet-600 via-blue-600 to-cyan-600 animate-gradient-slow">
        <div className="absolute inset-0 bg-black/20"></div>
        <div className="relative container mx-auto px-6 py-6">
          <div className="text-center text-white">
            <div className="inline-flex items-center justify-center gap-3 mb-3">
              <div className="flex items-center justify-center p-2 bg-white/20 backdrop-blur-sm rounded-lg border border-white/30">
                <Scissors className="w-6 h-6" />
              </div>
              <div className="text-left">
                <h1 className="text-2xl md:text-3xl font-bold">AudioSplit</h1>
                <p className="text-sm text-white/90">for NotebookLM</p>
              </div>
            </div>
            <p className="text-sm text-white/80 max-w-md mx-auto mb-4">
              音声ファイルをNotebookLMの200MB制限に最適化
            </p>
            
            {/* Feature badges */}
            <div className="flex flex-wrap justify-center gap-2">
              <div className="inline-flex items-center px-2 py-1 bg-white/20 backdrop-blur-sm rounded-full border border-white/30">
                <Shield className="w-3 h-3 mr-1" />
                <span className="text-xs font-medium">完全プライベート処理</span>
              </div>
              <div className="inline-flex items-center px-2 py-1 bg-white/20 backdrop-blur-sm rounded-full border border-white/30">
                <Zap className="w-3 h-3 mr-1" />
                <span className="text-xs font-medium">高速処理</span>
              </div>
              <div className="inline-flex items-center px-2 py-1 bg-white/20 backdrop-blur-sm rounded-full border border-white/30">
                <Globe className="w-3 h-3 mr-1" />
                <span className="text-xs font-medium">インストール不要</span>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div className="container mx-auto px-6 py-8">
        <div className="max-w-4xl mx-auto">
          
          {/* Workflow Stepper */}
          <WorkflowStepper 
            currentStep={currentStep} 
            onStepClick={handleStepNavigation}
            completedSteps={completedSteps}
            availableSteps={availableSteps}
          />

          {/* Current Step Content */}
          {renderCurrentStep()}
        </div>

        {/* Security Features Section */}
        <div className="max-w-6xl mx-auto mt-16">
          <div className="text-center mb-12">
            <h2 className="text-4xl font-bold bg-gradient-to-r from-violet-600 to-blue-600 bg-clip-text text-transparent mb-4">
              なぜAudioSplitなのか？
            </h2>
            <p className="text-lg text-gray-600">
              セキュリティと利便性を両立した音声分割ツール
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
        <footer className="text-center py-12">
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
    </div>
  );
}

export default App;