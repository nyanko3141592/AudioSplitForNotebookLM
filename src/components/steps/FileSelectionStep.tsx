import { FileUpload } from '../FileUpload';
import { StepContent } from '../StepContent';
import { extractAudioFromVideo } from '../../utils/videoToAudio';
import { useState } from 'react';

interface FileSelectionStepProps {
  selectedFile: File | null;
  onFileSelect: (file: File) => void;
  onNext: () => void;
  isProcessing: boolean;
}

export function FileSelectionStep({ selectedFile, onFileSelect, onNext, isProcessing }: FileSelectionStepProps) {
  const [isExtracting, setIsExtracting] = useState(false);
  const [extractionProgress, setExtractionProgress] = useState(0);

  const isVideoFile = (file: File): boolean => {
    const videoMimeTypes = ['video/mp4', 'video/quicktime', 'video/x-msvideo', 'video/x-matroska', 'video/webm'];
    const videoExtensions = ['.mp4', '.mov', '.avi', '.mkv', '.webm', '.m4v', '.3gp', '.flv', '.wmv'];
    
    return videoMimeTypes.includes(file.type.toLowerCase()) ||
           videoExtensions.some(ext => file.name.toLowerCase().endsWith(ext));
  };

  const handleFileSelect = async (file: File) => {
    if (isVideoFile(file)) {
      setIsExtracting(true);
      setExtractionProgress(0);
      
      try {
        const audioFile = await extractAudioFromVideo(file, (progress) => {
          setExtractionProgress(progress);
        });
        onFileSelect(audioFile);
      } catch (error) {
        console.error('Audio extraction failed:', error);
        alert(`動画からの音声抽出に失敗しました: ${error instanceof Error ? error.message : '不明なエラー'}`);
      } finally {
        setIsExtracting(false);
        setExtractionProgress(0);
      }
    } else {
      onFileSelect(file);
    }
  };

  return (
    <StepContent
      title="📁 ファイル選択"
      description="分割したい音声・動画ファイルをアップロードしてください"
      nextButtonText="分割設定へ"
      onNext={onNext}
      nextDisabled={!selectedFile || isExtracting}
      showNext={!!selectedFile && !isExtracting}
      isLoading={isProcessing || isExtracting}
    >
      <FileUpload 
        onFileSelect={handleFileSelect}
        disabled={isProcessing || isExtracting}
      />
      
      {isExtracting && (
        <div className="mt-6 p-6 bg-gradient-to-r from-yellow-100 to-orange-100 rounded-2xl border border-yellow-200">
          <div className="text-center">
            <p className="text-sm text-gray-600 mb-2">動画から音声を抽出しています...</p>
            <div className="w-full bg-gray-200 rounded-full h-2 mb-2">
              <div 
                className="bg-gradient-to-r from-yellow-500 to-orange-500 h-2 rounded-full transition-all duration-300"
                style={{ width: `${extractionProgress}%` }}
              ></div>
            </div>
            <p className="text-sm font-medium text-gray-700">{extractionProgress}%</p>
          </div>
        </div>
      )}
      
      {selectedFile && (
        <div className="p-6 bg-gradient-to-r from-blue-100 to-violet-100 rounded-2xl border border-blue-200">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-600 mb-1">選択されたファイル</p>
              <p className="font-bold text-gray-900">{selectedFile.name}</p>
            </div>
            <div className="text-right">
              <p className="text-sm text-gray-600 mb-1">ファイルサイズ</p>
              <p className="font-bold text-2xl bg-gradient-to-r from-blue-600 to-violet-600 bg-clip-text text-transparent">
                {(selectedFile.size / (1024 * 1024)).toFixed(2)} MB
              </p>
            </div>
          </div>
        </div>
      )}
    </StepContent>
  );
}