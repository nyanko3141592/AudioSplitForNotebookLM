import { Download, FileAudio, FileText, CheckCircle } from 'lucide-react';
import type { SplitFile } from './DownloadList';
import type { TranscriptionResult } from '../utils/geminiTranscriber';

interface ResultsSummaryProps {
  splitFiles?: SplitFile[];
  transcriptionResults?: TranscriptionResult[];
  summaryResult?: string;
  onDownloadSplit?: (file: SplitFile) => void;
  onDownloadAllSplits?: () => void;
  onDownloadTranscription?: () => void;
  onDownloadSummary?: () => void;
  compact?: boolean;
}

export function ResultsSummary({ 
  splitFiles = [],
  transcriptionResults = [],
  summaryResult,
  onDownloadSplit,
  onDownloadAllSplits,
  onDownloadTranscription,
  onDownloadSummary,
  compact = false
}: ResultsSummaryProps) {
  const hasSplits = splitFiles.length > 0;
  const hasTranscriptions = transcriptionResults.length > 0;
  const hasSummary = !!summaryResult;

  if (!hasSplits && !hasTranscriptions && !hasSummary) {
    return null;
  }

  return (
    <div className={`${compact ? 'space-y-3' : 'space-y-4'}`}>
      {/* 分割ファイル */}
      {hasSplits && (
        <div className={`${compact ? 'p-3' : 'p-4'} bg-blue-50 border border-blue-200 rounded-lg`}>
          <div className="flex items-center justify-between mb-2">
            <div className="flex items-center gap-2">
              <FileAudio className="w-4 h-4 text-blue-600" />
              <span className={`${compact ? 'text-sm' : 'text-base'} font-medium text-blue-900`}>
                分割済みファイル ({splitFiles.length}個)
              </span>
            </div>
            {onDownloadAllSplits && (
              <button
                onClick={onDownloadAllSplits}
                className="px-3 py-1 bg-blue-600 text-white text-xs font-medium rounded hover:bg-blue-700 transition-colors flex items-center gap-1"
              >
                <Download className="w-3 h-3" />
                一括DL
              </button>
            )}
          </div>
          
          {!compact && onDownloadSplit && (
            <div className="grid grid-cols-2 md:grid-cols-3 gap-2 mt-2">
              {splitFiles.map((file, index) => (
                <button
                  key={index}
                  onClick={() => onDownloadSplit(file)}
                  className="px-2 py-1 bg-white border border-blue-300 rounded text-xs text-blue-700 hover:bg-blue-100 transition-colors truncate"
                  title={file.name}
                >
                  {file.name}
                </button>
              ))}
            </div>
          )}
        </div>
      )}

      {/* 文字起こし結果 */}
      {hasTranscriptions && (
        <div className={`${compact ? 'p-3' : 'p-4'} bg-green-50 border border-green-200 rounded-lg`}>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <FileText className="w-4 h-4 text-green-600" />
              <span className={`${compact ? 'text-sm' : 'text-base'} font-medium text-green-900`}>
                文字起こし完了 ({transcriptionResults.filter(r => !r.error).length}/{transcriptionResults.length})
              </span>
            </div>
            {onDownloadTranscription && (
              <button
                onClick={onDownloadTranscription}
                className="px-3 py-1 bg-green-600 text-white text-xs font-medium rounded hover:bg-green-700 transition-colors flex items-center gap-1"
              >
                <Download className="w-3 h-3" />
                DL
              </button>
            )}
          </div>
        </div>
      )}

      {/* まとめ結果 */}
      {hasSummary && (
        <div className={`${compact ? 'p-3' : 'p-4'} bg-purple-50 border border-purple-200 rounded-lg`}>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <CheckCircle className="w-4 h-4 text-purple-600" />
              <span className={`${compact ? 'text-sm' : 'text-base'} font-medium text-purple-900`}>
                まとめ作成済み
              </span>
            </div>
            {onDownloadSummary && (
              <button
                onClick={onDownloadSummary}
                className="px-3 py-1 bg-purple-600 text-white text-xs font-medium rounded hover:bg-purple-700 transition-colors flex items-center gap-1"
              >
                <Download className="w-3 h-3" />
                DL
              </button>
            )}
          </div>
        </div>
      )}
    </div>
  );
}