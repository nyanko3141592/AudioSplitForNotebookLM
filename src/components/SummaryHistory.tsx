import React, { useState, useEffect } from 'react';
import { Clock, FileText, Trash2, Eye, Download, X, Image } from 'lucide-react';
import type { SummaryHistoryItem } from '../types/summaryHistory';
import { loadSummaryHistory, deleteSummaryFromHistory, clearSummaryHistory, exportSummaryHistory } from '../utils/summaryHistory';

export const SummaryHistory: React.FC = () => {
  const [history, setHistory] = useState<SummaryHistoryItem[]>([]);
  const [selectedItem, setSelectedItem] = useState<SummaryHistoryItem | null>(null);
  const [showModal, setShowModal] = useState(false);

  // Load history on mount
  useEffect(() => {
    loadHistory();
  }, []);

  const loadHistory = () => {
    const historyData = loadSummaryHistory();
    setHistory(historyData.items);
  };

  const handleDelete = (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    if (window.confirm('この要約履歴を削除しますか？')) {
      deleteSummaryFromHistory(id);
      loadHistory();
      if (selectedItem?.id === id) {
        setSelectedItem(null);
      }
    }
  };

  const handleClearAll = () => {
    if (window.confirm('すべての要約履歴を削除しますか？この操作は取り消せません。')) {
      clearSummaryHistory();
      loadHistory();
      setSelectedItem(null);
    }
  };

  const handleExport = () => {
    const json = exportSummaryHistory();
    const blob = new Blob([json], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `summary-history-${new Date().toISOString().split('T')[0]}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleView = (item: SummaryHistoryItem) => {
    setSelectedItem(item);
    setShowModal(true);
  };

  const formatDate = (timestamp: string) => {
    return new Date(timestamp).toLocaleString('ja-JP', {
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  const formatDuration = (seconds?: number) => {
    if (!seconds) return '';
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}分${secs}秒`;
  };

  return (
    <>
      <div className="bg-white rounded-xl shadow-lg p-6">
        <div className="flex justify-between items-center mb-6">
          <h2 className="text-2xl font-bold text-gray-800 flex items-center gap-2">
            <Clock className="w-6 h-6" />
            要約履歴
          </h2>
          <div className="flex gap-2">
            {history.length > 0 && (
              <>
                <button
                  onClick={handleExport}
                  className="px-4 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600 transition-colors flex items-center gap-2"
                >
                  <Download className="w-4 h-4" />
                  エクスポート
                </button>
                <button
                  onClick={handleClearAll}
                  className="px-4 py-2 bg-red-500 text-white rounded-lg hover:bg-red-600 transition-colors flex items-center gap-2"
                >
                  <Trash2 className="w-4 h-4" />
                  すべて削除
                </button>
              </>
            )}
          </div>
        </div>

        {history.length === 0 ? (
          <div className="text-center py-12 text-gray-500">
            <Clock className="w-16 h-16 mx-auto mb-4 opacity-50" />
            <p>まだ要約履歴がありません</p>
            <p className="text-sm mt-2">要約を作成すると、ここに最新10件が表示されます</p>
          </div>
        ) : (
          <div className="space-y-4">
            {history.map((item) => (
              <div
                key={item.id}
                className="border rounded-lg p-4 hover:bg-gray-50 transition-colors cursor-pointer"
                onClick={() => handleView(item)}
              >
                <div className="flex justify-between items-start">
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-2">
                      <FileText className="w-5 h-5 text-blue-500" />
                      <h3 className="font-semibold text-gray-800">{item.fileName}</h3>
                      {item.visualCaptures && item.visualCaptures.length > 0 && (
                        <span className="flex items-center gap-1 text-sm text-green-600">
                          <Image className="w-4 h-4" />
                          {item.visualCaptures.length}枚
                        </span>
                      )}
                    </div>
                    <p className="text-sm text-gray-600 line-clamp-2 mb-2">{item.summary}</p>
                    <div className="flex items-center gap-4 text-xs text-gray-500">
                      <span>{formatDate(item.timestamp)}</span>
                      {item.metadata.totalDuration && (
                        <span>長さ: {formatDuration(item.metadata.totalDuration)}</span>
                      )}
                      {item.metadata.language && (
                        <span>言語: {item.metadata.language}</span>
                      )}
                    </div>
                  </div>
                  <div className="flex gap-2 ml-4">
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        handleView(item);
                      }}
                      className="p-2 text-blue-500 hover:bg-blue-50 rounded-lg transition-colors"
                      title="詳細を見る"
                    >
                      <Eye className="w-5 h-5" />
                    </button>
                    <button
                      onClick={(e) => handleDelete(item.id, e)}
                      className="p-2 text-red-500 hover:bg-red-50 rounded-lg transition-colors"
                      title="削除"
                    >
                      <Trash2 className="w-5 h-5" />
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Detail Modal */}
      {showModal && selectedItem && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl max-w-4xl w-full max-h-[90vh] overflow-hidden flex flex-col">
            <div className="p-6 border-b flex justify-between items-center">
              <h3 className="text-xl font-bold">{selectedItem.fileName}</h3>
              <button
                onClick={() => setShowModal(false)}
                className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            
            <div className="p-6 overflow-y-auto flex-1">
              {/* Metadata */}
              <div className="mb-6 p-4 bg-gray-50 rounded-lg">
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
                  <div>
                    <span className="text-gray-500">作成日時:</span>
                    <div className="font-medium">{formatDate(selectedItem.timestamp)}</div>
                  </div>
                  {selectedItem.metadata.totalDuration && (
                    <div>
                      <span className="text-gray-500">長さ:</span>
                      <div className="font-medium">{formatDuration(selectedItem.metadata.totalDuration)}</div>
                    </div>
                  )}
                  {selectedItem.metadata.language && (
                    <div>
                      <span className="text-gray-500">言語:</span>
                      <div className="font-medium">{selectedItem.metadata.language}</div>
                    </div>
                  )}
                  {selectedItem.metadata.model && (
                    <div>
                      <span className="text-gray-500">モデル:</span>
                      <div className="font-medium">{selectedItem.metadata.model}</div>
                    </div>
                  )}
                </div>
              </div>

              {/* Summary */}
              <div className="mb-6">
                <h4 className="font-semibold text-lg mb-2">要約</h4>
                <div className="p-4 bg-blue-50 rounded-lg whitespace-pre-wrap">{selectedItem.summary}</div>
              </div>

              {/* Visual Summary */}
              {selectedItem.visualSummary && (
                <div className="mb-6">
                  <h4 className="font-semibold text-lg mb-2">画面解析サマリー</h4>
                  <div className="p-4 bg-green-50 rounded-lg whitespace-pre-wrap">{selectedItem.visualSummary}</div>
                </div>
              )}

              {/* Visual Captures */}
              {selectedItem.visualCaptures && selectedItem.visualCaptures.length > 0 && (
                <div className="mb-6">
                  <h4 className="font-semibold text-lg mb-2">キャプチャ画像 ({selectedItem.visualCaptures.length}枚)</h4>
                  <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                    {selectedItem.visualCaptures.map((capture) => (
                      <div key={capture.id} className="border rounded-lg overflow-hidden">
                        <img 
                          src={capture.imageData} 
                          alt={`Capture at ${capture.recordingTime}s`}
                          className="w-full h-32 object-cover"
                        />
                        <div className="p-2 text-xs">
                          <div className="text-gray-500 mb-1">{capture.recordingTime}秒</div>
                          <div className="line-clamp-2">{capture.description}</div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Transcription Results */}
              {selectedItem.transcriptionResults && selectedItem.transcriptionResults.length > 0 && (
                <div>
                  <h4 className="font-semibold text-lg mb-2">文字起こし結果</h4>
                  <div className="space-y-4">
                    {selectedItem.transcriptionResults.map((result, index) => (
                      <div key={index} className="border rounded-lg p-4">
                        <h5 className="font-medium mb-2">{result.fileName}</h5>
                        <div className="text-sm text-gray-700 whitespace-pre-wrap max-h-40 overflow-y-auto">
                          {result.text}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </>
  );
};