import { FileUpload } from '../FileUpload';
import { StepContent } from '../StepContent';

interface FileSelectionStepProps {
  selectedFile: File | null;
  onFileSelect: (file: File) => void;
  onNext: () => void;
  isProcessing: boolean;
}

export function FileSelectionStep({ selectedFile, onFileSelect, onNext, isProcessing }: FileSelectionStepProps) {
  return (
    <StepContent
      title="📁 ファイル選択"
      description="分割したい音声ファイルをアップロードしてください"
      nextButtonText="分割設定へ"
      onNext={onNext}
      nextDisabled={!selectedFile}
      showNext={!!selectedFile}
      isLoading={isProcessing}
    >
      <FileUpload 
        onFileSelect={onFileSelect}
        disabled={isProcessing}
      />
      
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