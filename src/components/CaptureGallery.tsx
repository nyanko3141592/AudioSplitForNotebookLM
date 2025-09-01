import React, { useState, useMemo } from 'react';
import { Camera, AlertCircle, Loader2, ChevronLeft, ChevronRight, Grid, List } from 'lucide-react';
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
  const [currentPage, setCurrentPage] = useState(0);
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid');
  const [imagesPerPage, setImagesPerPage] = useState(24); // デフォルト24枚表示

  const formatTime = (seconds: number): string => {
    const minutes = Math.floor(seconds / 60);
    const remainingSeconds = seconds % 60;
    return `${minutes}:${remainingSeconds.toString().padStart(2, '0')}`;
  };

  const validCaptures = captures.filter(c => c.imageData && !c.error);
  const errorCaptures = captures.filter(c => c.error);

  // ページング計算
  const totalPages = Math.ceil(validCaptures.length / imagesPerPage);
  const startIndex = currentPage * imagesPerPage;
  const endIndex = Math.min(startIndex + imagesPerPage, validCaptures.length);
  const currentPageCaptures = validCaptures.slice(startIndex, endIndex);

  // ステータス統計
  const analysisStats = useMemo(() => {
    const analyzed = validCaptures.filter(c => c.description).length;
    const errors = errorCaptures.length;
    const pending = validCaptures.length - analyzed;
    return { analyzed, errors, pending, total: captures.length };
  }, [validCaptures, errorCaptures, captures.length]);

  if (captures.length === 0) {
    return null;
  }

  return (
    <div className={`bg-white rounded-xl shadow-md p-6 ${className}`}>
      {/* ヘッダー部分 */}
      <div className="flex flex-col gap-4 mb-6">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Camera className="w-5 h-5 text-blue-600" />
            <h3 className="text-lg font-semibold text-gray-900">
              キャプチャした画面
            </h3>
            <div className="flex items-center gap-2">
              <span className="px-2 py-1 bg-blue-100 text-blue-800 text-sm rounded-full font-medium">
                {analysisStats.total}枚
              </span>
              {analysisStats.analyzed > 0 && (
                <span className="px-2 py-1 bg-green-100 text-green-800 text-sm rounded-full font-medium">
                  ✓{analysisStats.analyzed}
                </span>
              )}
              {analysisStats.errors > 0 && (
                <span className="px-2 py-1 bg-red-100 text-red-800 text-sm rounded-full font-medium">
                  ✗{analysisStats.errors}
                </span>
              )}
            </div>
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

        {/* 表示設定とページング */}
        {validCaptures.length > 0 && (
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              {/* 表示モード切り替え */}
              <div className="flex items-center bg-gray-100 rounded-lg p-1">
                <button
                  onClick={() => setViewMode('grid')}
                  className={`px-3 py-1.5 rounded-md text-sm font-medium transition-colors ${
                    viewMode === 'grid'
                      ? 'bg-white text-gray-900 shadow-sm'
                      : 'text-gray-600 hover:text-gray-900'
                  }`}
                >
                  <Grid className="w-4 h-4" />
                </button>
                <button
                  onClick={() => setViewMode('list')}
                  className={`px-3 py-1.5 rounded-md text-sm font-medium transition-colors ${
                    viewMode === 'list'
                      ? 'bg-white text-gray-900 shadow-sm'
                      : 'text-gray-600 hover:text-gray-900'
                  }`}
                >
                  <List className="w-4 h-4" />
                </button>
              </div>

              {/* 表示件数設定 */}
              <select
                value={imagesPerPage}
                onChange={(e) => {
                  setImagesPerPage(parseInt(e.target.value));
                  setCurrentPage(0); // ページをリセット
                }}
                className="px-3 py-1.5 text-sm border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500"
              >
                <option value={12}>12枚表示</option>
                <option value={24}>24枚表示</option>
                <option value={48}>48枚表示</option>
                <option value={validCaptures.length}>全て表示</option>
              </select>
            </div>

            {/* ページング */}
            {totalPages > 1 && (
              <div className="flex items-center gap-2">
                <button
                  onClick={() => setCurrentPage(Math.max(0, currentPage - 1))}
                  disabled={currentPage === 0}
                  className="p-2 rounded-md border border-gray-300 hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  <ChevronLeft className="w-4 h-4" />
                </button>
                
                <span className="px-3 py-1 text-sm text-gray-700">
                  {currentPage + 1} / {totalPages}
                </span>
                
                <button
                  onClick={() => setCurrentPage(Math.min(totalPages - 1, currentPage + 1))}
                  disabled={currentPage === totalPages - 1}
                  className="p-2 rounded-md border border-gray-300 hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  <ChevronRight className="w-4 h-4" />
                </button>
              </div>
            )}
          </div>
        )}
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

      {/* キャプチャ画像表示 */}
      {currentPageCaptures.length > 0 && (
        <div className="mb-6">
          {viewMode === 'grid' ? (
            /* グリッド表示 */
            <div className="grid grid-cols-4 sm:grid-cols-6 md:grid-cols-8 lg:grid-cols-12 gap-3">
              {currentPageCaptures.map((capture, index) => {
                const globalIndex = startIndex + index;
                return (
                  <div key={capture.id} className="relative group">
                    <div className="aspect-video bg-gray-100 rounded-lg overflow-hidden border-2 border-gray-200 hover:border-blue-300 transition-colors">
                      <img
                        src={capture.imageData}
                        alt={`キャプチャ ${globalIndex + 1}`}
                        className="w-full h-full object-cover"
                        loading="lazy"
                      />
                      
                      {/* 分析状態のアイコン */}
                      <div className="absolute top-1 right-1">
                        {capture.description ? (
                          <div className="w-4 h-4 bg-green-500 rounded-full flex items-center justify-center shadow-md">
                            <span className="text-white text-xs leading-none">✓</span>
                          </div>
                        ) : capture.error ? (
                          <div className="w-4 h-4 bg-red-500 rounded-full flex items-center justify-center shadow-md">
                            <span className="text-white text-xs leading-none">✗</span>
                          </div>
                        ) : (
                          <div className="w-4 h-4 bg-gray-400 rounded-full flex items-center justify-center shadow-md">
                            <span className="text-white text-xs leading-none">…</span>
                          </div>
                        )}
                      </div>
                      
                      {/* 番号 */}
                      <div className="absolute top-1 left-1 bg-blue-600 text-white text-xs w-4 h-4 rounded-full flex items-center justify-center font-bold leading-none">
                        {globalIndex + 1}
                      </div>
                      
                      {/* ホバー時の詳細情報 */}
                      <div className="absolute inset-0 bg-black bg-opacity-75 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                        <div className="text-white text-center p-2">
                          <div className="text-xs font-medium mb-1">{formatTime(capture.recordingTime)}</div>
                          {capture.description && (
                            <div className="text-xs truncate max-w-24">{capture.description.slice(0, 20)}...</div>
                          )}
                        </div>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          ) : (
            /* リスト表示 */
            <div className="space-y-4">
              {currentPageCaptures.map((capture, index) => {
                const globalIndex = startIndex + index;
                return (
                  <div key={capture.id} className="flex items-center gap-4 p-4 border border-gray-200 rounded-lg">
                    <div className="flex-shrink-0">
                      <div className="w-24 h-16 bg-gray-100 rounded-lg overflow-hidden border border-gray-200">
                        <img
                          src={capture.imageData}
                          alt={`キャプチャ ${globalIndex + 1}`}
                          className="w-full h-full object-cover"
                          loading="lazy"
                        />
                      </div>
                    </div>
                    
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1">
                        <span className="font-medium text-gray-900">#{globalIndex + 1}</span>
                        <span className="text-sm text-gray-600">{formatTime(capture.recordingTime)}</span>
                        {capture.description ? (
                          <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-800">
                            <span className="mr-1">✓</span>分析済み
                          </span>
                        ) : capture.error ? (
                          <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-red-100 text-red-800">
                            <span className="mr-1">✗</span>エラー
                          </span>
                        ) : (
                          <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-gray-100 text-gray-600">
                            <span className="mr-1">…</span>未分析
                          </span>
                        )}
                      </div>
                      
                      {capture.description && (
                        <p className="text-sm text-gray-700 line-clamp-2">{capture.description}</p>
                      )}
                      
                      {capture.error && (
                        <p className="text-sm text-red-600">エラー: {capture.error}</p>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          {/* ページ情報表示 */}
          {totalPages > 1 && (
            <div className="mt-4 text-center">
              <span className="text-sm text-gray-600">
                {startIndex + 1}-{endIndex}件 / 全{validCaptures.length}件を表示
              </span>
            </div>
          )}
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