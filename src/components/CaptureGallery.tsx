import React from 'react';
import { Camera, Clock, AlertCircle, Loader2 } from 'lucide-react';
import type { CaptureAnalysis } from '../types/visualCapture';

interface CaptureGalleryProps {
  captures: CaptureAnalysis[];
  isAnalyzing?: boolean;
  analysisProgress?: { current: number; total: number };
  onAnalyzeCaptures?: () => void;
  visualSummary?: string;
  className?: string;
}

export const CaptureGallery: React.FC<CaptureGalleryProps> = ({
  captures,
  isAnalyzing = false,
  analysisProgress,
  onAnalyzeCaptures,
  visualSummary,
  className = ''
}) => {

  const formatTime = (seconds: number): string => {
    const minutes = Math.floor(seconds / 60);
    const remainingSeconds = seconds % 60;
    return `${minutes}:${remainingSeconds.toString().padStart(2, '0')}`;
  };

  const validCaptures = captures.filter(c => c.imageData && !c.error);
  const errorCaptures = captures.filter(c => c.error);

  if (captures.length === 0) {
    return null;
  }

  return (
    <div className={`bg-white rounded-xl shadow-md p-6 ${className}`}>
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-3">
          <Camera className="w-5 h-5 text-blue-600" />
          <h3 className="text-lg font-semibold text-gray-900">
            キャプチャした画面
          </h3>
          <span className="text-sm text-gray-500">
            ({validCaptures.length}枚)
          </span>
        </div>
        
        <div className="flex items-center gap-2">
          {validCaptures.some(c => !c.description) && onAnalyzeCaptures && (
            <button
              onClick={onAnalyzeCaptures}
              disabled={isAnalyzing}
              className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors text-sm"
            >
              {isAnalyzing ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  分析中...
                </>
              ) : (
                <>
                  <Camera className="w-4 h-4" />
                  画面分析
                </>
              )}
            </button>
          )}
        </div>
      </div>

      {/* 分析進行状況 */}
      {isAnalyzing && analysisProgress && (
        <div className="mb-4 p-3 bg-blue-50 border border-blue-200 rounded-lg">
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm text-blue-800">
              Gemini Vision APIで画面分析中...
            </span>
            <span className="text-sm text-blue-600">
              {analysisProgress.current}/{analysisProgress.total}
            </span>
          </div>
          <div className="w-full bg-blue-200 rounded-full h-2">
            <div
              className="bg-blue-600 h-2 rounded-full transition-all duration-300"
              style={{ 
                width: `${(analysisProgress.current / analysisProgress.total) * 100}%` 
              }}
            />
          </div>
        </div>
      )}

      {/* エラー表示 */}
      {errorCaptures.length > 0 && (
        <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg">
          <div className="flex items-center gap-2 mb-2">
            <AlertCircle className="w-4 h-4 text-red-600" />
            <span className="text-sm text-red-800">
              {errorCaptures.length}枚のキャプチャでエラーが発生
            </span>
          </div>
          <ul className="text-xs text-red-600 space-y-1">
            {errorCaptures.map(capture => (
              <li key={capture.id}>
                {formatTime(capture.recordingTime)}: {capture.error}
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* キャプチャ画像一覧 - タイル表示 */}
      {validCaptures.length > 0 && (
        <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-6 gap-4 mb-6">
          {validCaptures.map((capture, index) => (
            <div key={capture.id} className="relative">
              <div className="aspect-video bg-gray-100 rounded-lg overflow-hidden border-2 border-gray-200">
                <img
                  src={capture.imageData}
                  alt={`キャプチャ ${index + 1}`}
                  className="w-full h-full object-cover"
                />
                
                {/* 分析状態のアイコン（右上） */}
                <div className="absolute top-2 right-2">
                  {capture.description ? (
                    <div className="w-6 h-6 bg-green-500 rounded-full flex items-center justify-center shadow-lg">
                      <span className="text-white text-xs">✓</span>
                    </div>
                  ) : capture.error ? (
                    <div className="w-6 h-6 bg-red-500 rounded-full flex items-center justify-center shadow-lg">
                      <span className="text-white text-xs">✗</span>
                    </div>
                  ) : (
                    <div className="w-6 h-6 bg-gray-400 rounded-full flex items-center justify-center shadow-lg">
                      <span className="text-white text-xs">…</span>
                    </div>
                  )}
                </div>
                
                {/* タイムスタンプ */}
                <div className="absolute bottom-1 left-1 bg-black bg-opacity-70 text-white text-xs px-2 py-1 rounded">
                  {formatTime(capture.recordingTime)}
                </div>
                
                {/* 番号 */}
                <div className="absolute top-1 left-1 bg-blue-600 text-white text-xs w-5 h-5 rounded-full flex items-center justify-center font-bold">
                  {index + 1}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}


      {/* 📝 画面分析サマリー */}
      {visualSummary && (
        <div className="bg-green-50 border border-green-200 rounded-lg p-4">
          <div className="flex items-start gap-3">
            <div className="flex items-center justify-center w-8 h-8 bg-green-600 text-white rounded-full font-bold flex-shrink-0 mt-1">
              📝
            </div>
            <div className="flex-1">
              <h4 className="font-semibold text-green-900 mb-2">画面分析サマリー</h4>
              <p className="text-green-800 text-sm leading-relaxed">{visualSummary}</p>
            </div>
          </div>
        </div>
      )}

      {validCaptures.length === 0 && errorCaptures.length === 0 && (
        <div className="text-center py-8 text-gray-500">
          <Camera className="w-12 h-12 mx-auto mb-3 text-gray-400" />
          <p>まだキャプチャがありません</p>
        </div>
      )}
    </div>
  );
};