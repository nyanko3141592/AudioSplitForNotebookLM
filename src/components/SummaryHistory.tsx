import React, { useState, useEffect } from 'react';
import { Clock, FileText, Trash2, Eye, Download, X, Image, Settings, Edit2, Check, X as Cancel, List, Grid, MoreVertical } from 'lucide-react';
import type { SummaryHistoryItem } from '../types/summaryHistory';
import { loadSummaryHistory, deleteSummaryFromHistory, clearSummaryHistory, exportSummaryHistory, updateHistoryLimit, getHistoryLimitOptions, updateSummaryTitle } from '../utils/summaryHistory';

export const SummaryHistory: React.FC = () => {
  const [history, setHistory] = useState<SummaryHistoryItem[]>([]);
  const [selectedItem, setSelectedItem] = useState<SummaryHistoryItem | null>(null);
  const [showModal, setShowModal] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const [currentLimit, setCurrentLimit] = useState<number>(-1);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editingTitle, setEditingTitle] = useState<string>('');
  const [openMenuId, setOpenMenuId] = useState<string | null>(null);

  // Load history on mount
  useEffect(() => {
    loadHistory();
  }, []);

  // Close menu when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      const target = event.target as HTMLElement;
      if (!target.closest('.menu-container')) {
        setOpenMenuId(null);
      }
    };

    document.addEventListener('click', handleClickOutside);
    return () => document.removeEventListener('click', handleClickOutside);
  }, []);

  const loadHistory = () => {
    const historyData = loadSummaryHistory();
    setHistory(historyData.items);
    setCurrentLimit(historyData.maxItems);
  };

  const handleLimitChange = (newLimit: number) => {
    updateHistoryLimit(newLimit === -1 ? null : newLimit);
    setCurrentLimit(newLimit);
    loadHistory(); // Reload to reflect any trimming
    setShowSettings(false);
  };

  const handleStartEditing = (item: SummaryHistoryItem, e: React.MouseEvent) => {
    e.stopPropagation();
    setEditingId(item.id);
    setEditingTitle(item.title || item.fileName);
  };

  const handleSaveTitle = (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    if (updateSummaryTitle(id, editingTitle)) {
      loadHistory();
    }
    setEditingId(null);
    setEditingTitle('');
  };

  const handleCancelEdit = (e: React.MouseEvent) => {
    e.stopPropagation();
    setEditingId(null);
    setEditingTitle('');
  };

  const getDisplayTitle = (item: SummaryHistoryItem) => {
    return item.title || item.fileName;
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
  
  const formatDateShort = (timestamp: string) => {
    return new Date(timestamp).toLocaleString('ja-JP', {
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit'
    });
  };
  
  const getUniqueCaptures = (captures?: any[]) => {
    if (!captures || captures.length === 0) return [];
    // Filter out duplicate images (those without uploaded flag or with uploaded=false)
    return captures.filter(capture => !capture.uploaded);
  };

  const formatDuration = (seconds?: number) => {
    if (!seconds) return '';
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}分${secs}秒`;
  };
  // View settings persistence
  const getViewSettings = () => {
    try {
      const saved = localStorage.getItem('summaryHistory.viewSettings');
      return saved ? JSON.parse(saved) : { viewMode: 'list' };
    } catch {
      return { viewMode: 'list' };
    }
  };

  const saveViewSettings = (settings: { viewMode: 'list' | 'tile' }) => {
    try {
      localStorage.setItem('summaryHistory.viewSettings', JSON.stringify(settings));
    } catch (error) {
      console.warn('Failed to save view settings:', error);
    }
  };

  // View mode state
  const [viewMode, setViewMode] = useState<'list' | 'tile'>(() => getViewSettings().viewMode);

  const handleViewModeChange = (newMode: 'list' | 'tile') => {
    setViewMode(newMode);
    saveViewSettings({ viewMode: newMode });
  };

  // Group history by date
  const groupHistoryByDate = (items: SummaryHistoryItem[]) => {
    const groups: { [key: string]: SummaryHistoryItem[] } = {};
    const today = new Date();
    const yesterday = new Date(today);
    yesterday.setDate(yesterday.getDate() - 1);
    
    items.forEach(item => {
      const itemDate = new Date(item.timestamp);
      const dateKey = itemDate.toDateString();
      
      let groupKey: string;
      if (dateKey === today.toDateString()) {
        groupKey = '今日';
      } else if (dateKey === yesterday.toDateString()) {
        groupKey = '昨日';
      } else {
        groupKey = itemDate.toLocaleDateString('ja-JP', {
          year: 'numeric',
          month: 'long',
          day: 'numeric'
        });
      }
      
      if (!groups[groupKey]) {
        groups[groupKey] = [];
      }
      groups[groupKey].push(item);
    });
    
    return groups;
  };

  const historyGroups = groupHistoryByDate(history);

  return (
    <>
      <div className="bg-white rounded-xl shadow-lg p-6">
        <div className="flex justify-between items-center mb-6">
          <h2 className="text-2xl font-bold text-gray-800 flex items-center gap-2">
            <Clock className="w-6 h-6" />
            要約履歴
          </h2>
          <div className="flex gap-2">
            {/* View mode toggle */}
            <div className="flex border rounded-lg overflow-hidden">
              <button
                onClick={() => handleViewModeChange('list')}
                className={`px-3 py-2 flex items-center gap-2 transition-colors ${
                  viewMode === 'list'
                    ? 'bg-blue-500 text-white'
                    : 'bg-white text-gray-600 hover:bg-gray-50'
                }`}
                title="リスト表示"
              >
                <List className="w-4 h-4" />
              </button>
              <button
                onClick={() => handleViewModeChange('tile')}
                className={`px-3 py-2 flex items-center gap-2 transition-colors ${
                  viewMode === 'tile'
                    ? 'bg-blue-500 text-white'
                    : 'bg-white text-gray-600 hover:bg-gray-50'
                }`}
                title="タイル表示"
              >
                <Grid className="w-4 h-4" />
              </button>
            </div>
            <button
              onClick={() => setShowSettings(true)}
              className="px-4 py-2 bg-gray-500 text-white rounded-lg hover:bg-gray-600 transition-colors flex items-center gap-2"
            >
              <Settings className="w-4 h-4" />
              設定
            </button>
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
            <p className="text-sm mt-2">要約を作成すると、ここに履歴が表示されます</p>
          </div>
        ) : (
          <div className="space-y-6">
            {Object.entries(historyGroups).map(([dateGroup, items]) => (
              <div key={dateGroup}>
                {/* Date Section Header */}
                <h3 className="text-lg font-semibold text-gray-700 mb-3 border-b border-gray-200 pb-2">
                  {dateGroup}
                </h3>
                
                {/* Items Display */}
                {viewMode === 'list' ? (
                  <div className="space-y-4">
                    {items.map((item) => (
                      <div
                        key={item.id}
                        className="border rounded-lg p-4 hover:bg-gray-50 transition-colors cursor-pointer"
                        onClick={() => handleView(item)}
                      >
                <div className="flex justify-between items-start">
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-2">
                      <FileText className="w-5 h-5 text-blue-500" />
                      {editingId === item.id ? (
                        <div className="flex items-center gap-2 flex-1">
                          <span className="text-gray-500 font-medium">[{formatDateShort(item.timestamp)}]</span>
                          <input
                            type="text"
                            value={editingTitle}
                            onChange={(e) => setEditingTitle(e.target.value)}
                            className="flex-1 px-2 py-1 text-sm border border-gray-300 rounded focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                            onKeyDown={(e) => {
                              if (e.key === 'Enter' && e.ctrlKey) {
                                handleSaveTitle(item.id, e as any);
                              } else if (e.key === 'Escape') {
                                handleCancelEdit(e as any);
                              }
                            }}
                            onClick={(e) => e.stopPropagation()}
                            autoFocus
                            placeholder="Ctrl+Enterで確定"
                          />
                          <button
                            onClick={(e) => handleSaveTitle(item.id, e)}
                            className="p-1 text-green-600 hover:bg-green-50 rounded transition-colors"
                            title="確定 (Ctrl+Enter)"
                          >
                            <Check className="w-4 h-4" />
                          </button>
                          <button
                            onClick={handleCancelEdit}
                            className="p-1 text-gray-600 hover:bg-gray-50 rounded transition-colors"
                            title="キャンセル"
                          >
                            <Cancel className="w-4 h-4" />
                          </button>
                        </div>
                      ) : (
                        <>
                          <h3 className="font-semibold text-gray-800 flex-1">
                            <span className="text-gray-500 font-medium">[{formatDateShort(item.timestamp)}]</span>
                            <span className="ml-2">{getDisplayTitle(item)}</span>
                          </h3>
                          <button
                            onClick={(e) => handleStartEditing(item, e)}
                            className="p-1 text-gray-400 hover:text-gray-600 hover:bg-gray-50 rounded transition-colors"
                            title="タイトルを編雈"
                          >
                            <Edit2 className="w-4 h-4" />
                          </button>
                        </>
                      )}
                      {(() => {
                        const uniqueCaptures = getUniqueCaptures(item.visualCaptures);
                        return uniqueCaptures.length > 0 && (
                          <span className="flex items-center gap-1 text-sm text-green-600">
                            <Image className="w-4 h-4" />
                            {uniqueCaptures.length}枚
                          </span>
                        );
                      })()}
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
                  <div className="flex gap-2 ml-4 relative menu-container">
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
                      onClick={(e) => {
                        e.stopPropagation();
                        setOpenMenuId(openMenuId === item.id ? null : item.id);
                      }}
                      className="p-2 text-gray-400 hover:bg-gray-50 rounded-lg transition-colors"
                      title="その他のオプション"
                    >
                      <MoreVertical className="w-5 h-5" />
                    </button>
                    {openMenuId === item.id && (
                      <div className="absolute right-0 top-10 bg-white border border-gray-200 rounded-lg shadow-lg py-1 z-10">
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            handleDelete(item.id, e);
                            setOpenMenuId(null);
                          }}
                          className="w-full px-4 py-2 text-left text-sm text-red-600 hover:bg-red-50 flex items-center gap-2"
                        >
                          <Trash2 className="w-4 h-4" />
                          削除
                        </button>
                      </div>
                    )}
                  </div>
                </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  /* Tile View */
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                    {items.map((item) => (
                      <div
                        key={item.id}
                        className="border rounded-lg p-4 hover:bg-gray-50 transition-colors cursor-pointer"
                        onClick={() => handleView(item)}
                      >
                        <div className="flex justify-between items-start mb-3">
                          <div className="flex items-center gap-2">
                            <FileText className="w-4 h-4 text-blue-500" />
                            {(() => {
                              const uniqueCaptures = getUniqueCaptures(item.visualCaptures);
                              return uniqueCaptures.length > 0 && (
                                <span className="flex items-center gap-1 text-xs text-green-600">
                                  <Image className="w-3 h-3" />
                                  {uniqueCaptures.length}
                                </span>
                              );
                            })()}
                          </div>
                          <div className="flex gap-1 relative menu-container">
                            <button
                              onClick={(e) => handleStartEditing(item, e)}
                              className="p-1 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded transition-colors"
                              title="タイトルを編集"
                            >
                              <Edit2 className="w-3 h-3" />
                            </button>
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                setOpenMenuId(openMenuId === item.id ? null : item.id);
                              }}
                              className="p-1 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded transition-colors"
                              title="その他のオプション"
                            >
                              <MoreVertical className="w-3 h-3" />
                            </button>
                            {openMenuId === item.id && (
                              <div className="absolute right-0 top-6 bg-white border border-gray-200 rounded-lg shadow-lg py-1 z-10">
                                <button
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    handleDelete(item.id, e);
                                    setOpenMenuId(null);
                                  }}
                                  className="w-full px-3 py-1.5 text-left text-xs text-red-600 hover:bg-red-50 flex items-center gap-2"
                                >
                                  <Trash2 className="w-3 h-3" />
                                  削除
                                </button>
                              </div>
                            )}
                          </div>
                        </div>
                        
                        {editingId === item.id ? (
                          <div className="mb-3">
                            <input
                              type="text"
                              value={editingTitle}
                              onChange={(e) => setEditingTitle(e.target.value)}
                              className="w-full px-2 py-1 text-sm border border-gray-300 rounded focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                              onKeyDown={(e) => {
                                if (e.key === 'Enter' && e.ctrlKey) {
                                  handleSaveTitle(item.id, e as any);
                                } else if (e.key === 'Escape') {
                                  handleCancelEdit(e as any);
                                }
                              }}
                              onClick={(e) => e.stopPropagation()}
                              autoFocus
                              placeholder="Ctrl+Enterで確定"
                            />
                            <div className="flex gap-1 mt-1">
                              <button
                                onClick={(e) => handleSaveTitle(item.id, e)}
                                className="px-2 py-1 text-xs text-green-600 hover:bg-green-50 rounded transition-colors"
                                title="確定 (Ctrl+Enter)"
                              >
                                <Check className="w-3 h-3" />
                              </button>
                              <button
                                onClick={handleCancelEdit}
                                className="px-2 py-1 text-xs text-gray-600 hover:bg-gray-50 rounded transition-colors"
                                title="キャンセル"
                              >
                                <Cancel className="w-3 h-3" />
                              </button>
                            </div>
                          </div>
                        ) : (
                          <h4 className="font-medium text-gray-800 mb-2 line-clamp-2">
                            {getDisplayTitle(item)}
                          </h4>
                        )}
                        
                        <p className="text-sm text-gray-600 line-clamp-3 mb-3">{item.summary}</p>
                        
                        <div className="flex items-center justify-between text-xs text-gray-500">
                          <span>{formatDateShort(item.timestamp)}</span>
                          {item.metadata.totalDuration && (
                            <span>{formatDuration(item.metadata.totalDuration)}</span>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
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
              <h3 className="text-xl font-bold">{getDisplayTitle(selectedItem)}</h3>
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
              {(() => {
                const uniqueCaptures = getUniqueCaptures(selectedItem.visualCaptures);
                return uniqueCaptures.length > 0 && (
                  <div className="mb-6">
                    <h4 className="font-semibold text-lg mb-2">キャプチャ画像 ({uniqueCaptures.length}枚)</h4>
                    <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                      {uniqueCaptures.map((capture) => (
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
                );
              })()}

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

      {/* Settings Modal */}
      {showSettings && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl max-w-md w-full p-6">
            <div className="flex justify-between items-center mb-6">
              <h3 className="text-xl font-bold">履歴設定</h3>
              <button
                onClick={() => setShowSettings(false)}
                className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  保存する要約の件数
                </label>
                <div className="space-y-2">
                  {getHistoryLimitOptions().map((option) => (
                    <button
                      key={option.value}
                      onClick={() => handleLimitChange(option.value)}
                      className={`w-full text-left px-4 py-3 rounded-lg border transition-colors ${
                        currentLimit === option.value
                          ? 'bg-purple-50 border-purple-500 text-purple-700'
                          : 'bg-white border-gray-300 hover:bg-gray-50'
                      }`}
                    >
                      <div className="font-medium">{option.label}</div>
                      {option.value === -1 && (
                        <div className="text-sm text-gray-500 mt-1">
                          要約は自動削除されません
                        </div>
                      )}
                      {option.value > 0 && (
                        <div className="text-sm text-gray-500 mt-1">
                          {option.value}件を超えると古いものから削除
                        </div>
                      )}
                    </button>
                  ))}
                </div>
              </div>
              
              <div className="pt-4 border-t">
                <div className="text-sm text-gray-600">
                  <strong>現在の設定:</strong> {
                    currentLimit === -1 
                      ? 'すべて（制限なし）' 
                      : `${currentLimit}件`
                  }
                </div>
                {history.length > 0 && (
                  <div className="text-sm text-gray-500 mt-1">
                    現在保存されている要約: {history.length}件
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  );
};