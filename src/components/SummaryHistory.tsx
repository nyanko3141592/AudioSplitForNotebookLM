import React, { useState, useEffect } from 'react';
import { Clock, FileText, Trash2, Eye, Download, X, Image, Settings, Edit2, Check, X as Cancel, List, Grid, Type, Copy, FileDown } from 'lucide-react';
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
  const [fontSize, setFontSize] = useState<'small' | 'medium' | 'large'>(() => {
    const saved = localStorage.getItem('summaryHistory.fontSize');
    return (saved as 'small' | 'medium' | 'large') || 'medium';
  });

  // Load history on mount
  useEffect(() => {
    loadHistory();
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

  // Copy functionality
  const handleCopyText = async (text: string, type: string) => {
    try {
      await navigator.clipboard.writeText(text);
      // Show temporary success notification
      const notification = document.createElement('div');
      notification.className = 'fixed bottom-4 right-4 bg-green-500 text-white px-4 py-2 rounded-lg shadow-lg z-[9999]';
      notification.textContent = `${type}をコピーしました`;
      document.body.appendChild(notification);
      setTimeout(() => {
        notification.remove();
      }, 2000);
    } catch (err) {
      console.error('Failed to copy text:', err);
      // Fallback to older method
      const textArea = document.createElement('textarea');
      textArea.value = text;
      document.body.appendChild(textArea);
      textArea.select();
      document.execCommand('copy');
      document.body.removeChild(textArea);
    }
  };

  // Download functionality
  const handleDownloadText = (text: string, filename: string) => {
    const blob = new Blob([text], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleDownloadImage = async (imageData: string, filename: string) => {
    try {
      // Convert base64 to blob
      const response = await fetch(imageData);
      const blob = await response.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = filename;
      a.click();
      URL.revokeObjectURL(url);
    } catch (err) {
      console.error('Failed to download image:', err);
    }
  };

  const handleDownloadAll = (item: SummaryHistoryItem) => {
    const timestamp = new Date(item.timestamp).toISOString().replace(/[:.]/g, '-');
    const baseFilename = `${getDisplayTitle(item)}_${timestamp}`;
    
    // Download summary
    handleDownloadText(item.summary, `${baseFilename}_要約.txt`);
    
    // Download visual summary if exists
    if (item.visualSummary) {
      handleDownloadText(item.visualSummary, `${baseFilename}_画面解析.txt`);
    }
    
    // Download transcription results if exists
    if (item.transcriptionResults && item.transcriptionResults.length > 0) {
      item.transcriptionResults.forEach((result, index) => {
        handleDownloadText(result.text, `${baseFilename}_文字起こし_${index + 1}.txt`);
      });
    }
    
    // Download images
    const uniqueCaptures = getUniqueCaptures(item.visualCaptures);
    uniqueCaptures.forEach((capture, index) => {
      const imageFilename = `${baseFilename}_キャプチャ_${index + 1}.png`;
      handleDownloadImage(capture.imageData, imageFilename);
    });
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
      return saved ? JSON.parse(saved) : { viewMode: 'sidebar' };
    } catch {
      return { viewMode: 'sidebar' };
    }
  };

  const saveViewSettings = (settings: { viewMode: 'sidebar' | 'tile' }) => {
    try {
      localStorage.setItem('summaryHistory.viewSettings', JSON.stringify(settings));
    } catch (error) {
      console.warn('Failed to save view settings:', error);
    }
  };

  // View mode state
  const [viewMode, setViewMode] = useState<'sidebar' | 'tile'>(() => {
    const settings = getViewSettings();
    // Migrate old 'list' mode to 'sidebar'
    return settings.viewMode === 'list' ? 'sidebar' : settings.viewMode || 'sidebar';
  });

  const handleViewModeChange = (newMode: 'sidebar' | 'tile') => {
    setViewMode(newMode);
    saveViewSettings({ viewMode: newMode });
  };

  const handleFontSizeChange = (size: 'small' | 'medium' | 'large') => {
    setFontSize(size);
    localStorage.setItem('summaryHistory.fontSize', size);
  };

  const getFontSizeClasses = () => {
    switch (fontSize) {
      case 'small':
        return 'text-sm lg:text-base';
      case 'large':
        return 'text-lg lg:text-xl';
      default:
        return 'text-base lg:text-lg';
    }
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
      <div className="bg-white rounded-xl shadow-lg p-4 lg:p-6 w-full max-w-none">
        <div className="flex flex-col lg:flex-row lg:justify-between lg:items-center gap-4 mb-6">
          {/* Title Section */}
          <div className="flex items-center">
            <h2 className="text-xl lg:text-2xl font-bold text-gray-800 flex items-center gap-3">
              <Clock className="w-6 h-6 text-purple-600" />
              要約履歴
            </h2>
          </div>
          
          {/* Action Section */}
          <div className="flex flex-col sm:flex-row gap-3">
            {/* View Mode Toggle */}
            {history.length > 0 && (
              <div className="flex items-center bg-gray-100 rounded-lg p-1">
                <button
                  onClick={() => handleViewModeChange('sidebar')}
                  className={`px-4 py-2 rounded-md transition-all text-sm font-medium flex items-center gap-2 ${
                    viewMode === 'sidebar'
                      ? 'bg-white text-purple-700 shadow-sm'
                      : 'text-gray-600 hover:text-gray-800'
                  }`}
                  title="サイドバー表示"
                >
                  <List className="w-4 h-4" />
                  <span>サイドバー</span>
                </button>
                <button
                  onClick={() => handleViewModeChange('tile')}
                  className={`px-4 py-2 rounded-md transition-all text-sm font-medium flex items-center gap-2 ${
                    viewMode === 'tile'
                      ? 'bg-white text-purple-700 shadow-sm'
                      : 'text-gray-600 hover:text-gray-800'
                  }`}
                  title="タイル表示"
                >
                  <Grid className="w-4 h-4" />
                  <span>タイル</span>
                </button>
              </div>
            )}
            
            {/* Action Buttons */}
            <div className="flex items-center gap-2">
              <button
                onClick={() => setShowSettings(true)}
                className="px-4 py-2 bg-white border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 hover:border-gray-400 transition-all flex items-center gap-2 text-sm font-medium shadow-sm"
              >
                <Settings className="w-4 h-4" />
                <span>設定</span>
              </button>
              
              {history.length > 0 && (
                <>
                  <button
                    onClick={handleExport}
                    className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-all flex items-center gap-2 text-sm font-medium shadow-sm"
                  >
                    <Download className="w-4 h-4" />
                    <span>エクスポート</span>
                  </button>
                  <button
                    onClick={handleClearAll}
                    className="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-all flex items-center gap-2 text-sm font-medium shadow-sm"
                  >
                    <Trash2 className="w-4 h-4" />
                    <span className="hidden sm:inline">すべて削除</span>
                    <span className="sm:hidden">削除</span>
                  </button>
                </>
              )}
            </div>
          </div>
        </div>

        {history.length === 0 ? (
          <div className="text-center py-12 text-gray-500">
            <Clock className="w-16 h-16 mx-auto mb-4 opacity-50" />
            <p>まだ要約履歴がありません</p>
            <p className="text-sm mt-2">要約を作成すると、ここに履歴が表示されます</p>
          </div>
        ) : viewMode === 'tile' ? (
          /* Full-width Tile View */
          <div className="h-[calc(100vh-180px)]">
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 2xl:grid-cols-5 gap-4">
              {history.map((item) => {
                const uniqueCaptures = getUniqueCaptures(item.visualCaptures);
                return (
                  <div
                    key={item.id}
                    className="group p-4 bg-white border border-gray-200 rounded-lg cursor-pointer hover:shadow-lg transition-all duration-200 hover:border-blue-300"
                    onClick={() => handleView(item)}
                  >
                    <div className="flex flex-col h-full">
                      {/* Header */}
                      <div className="flex items-start justify-between mb-3">
                        <div className="flex items-center gap-2 min-w-0 flex-1">
                          <FileText className="w-4 h-4 text-blue-500 flex-shrink-0" />
                          {editingId === item.id ? (
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
                          ) : (
                            <h3 className="text-sm font-semibold text-gray-800 line-clamp-2 leading-tight">
                              {getDisplayTitle(item)}
                            </h3>
                          )}
                        </div>
                        <div className="flex items-center gap-1 ml-2 flex-shrink-0">
                          {editingId === item.id ? (
                            <>
                              <button
                                onClick={(e) => handleSaveTitle(item.id, e)}
                                className="p-1 text-green-600 hover:bg-green-50 rounded transition-colors"
                                title="確定"
                              >
                                <Check className="w-3 h-3" />
                              </button>
                              <button
                                onClick={handleCancelEdit}
                                className="p-1 text-gray-600 hover:bg-gray-50 rounded transition-colors"
                                title="キャンセル"
                              >
                                <Cancel className="w-3 h-3" />
                              </button>
                            </>
                          ) : (
                            <>
                              <button
                                onClick={(e) => handleStartEditing(item, e)}
                                className="opacity-0 group-hover:opacity-100 p-1 text-gray-400 hover:text-gray-600 hover:bg-gray-200 rounded transition-all"
                                title="編集"
                              >
                                <Edit2 className="w-3 h-3" />
                              </button>
                              <button
                                onClick={(e) => handleDelete(item.id, e)}
                                className="opacity-0 group-hover:opacity-100 p-1 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded transition-all"
                                title="削除"
                              >
                                <Trash2 className="w-3 h-3" />
                              </button>
                            </>
                          )}
                        </div>
                      </div>
                      
                      {/* Summary preview */}
                      <p className="text-xs text-gray-600 line-clamp-4 leading-relaxed mb-3 flex-1">
                        {item.summary}
                      </p>
                      
                      {/* Footer with metadata */}
                      <div className="flex items-center justify-between pt-3 border-t border-gray-100 mt-auto">
                        <span className="text-xs text-gray-500">{formatDateShort(item.timestamp)}</span>
                        <div className="flex items-center gap-2 text-xs text-gray-500">
                          {uniqueCaptures.length > 0 && (
                            <span className="flex items-center gap-1 bg-blue-100 text-blue-700 px-2 py-1 rounded-full">
                              <Image className="w-3 h-3" />
                              {uniqueCaptures.length}
                            </span>
                          )}
                          {item.metadata.totalDuration && (
                            <span className="bg-gray-100 px-2 py-1 rounded-full">
                              {formatDuration(item.metadata.totalDuration)}
                            </span>
                          )}
                        </div>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        ) : (
          /* Sidebar View */
          <div className="flex gap-4 lg:gap-6 h-[calc(100vh-180px)]">
            {/* Left Sidebar - History List */}
            <div className="w-full lg:w-80 xl:w-96 flex flex-col min-w-0">
              <div className="flex-1 overflow-y-auto space-y-4">
                {Object.entries(historyGroups).map(([groupKey, items]) => (
                  <div key={groupKey} className="space-y-3">
                    <h3 className="text-sm font-semibold text-gray-700 sticky top-0 bg-white py-1 border-b border-gray-200">
                      {groupKey}
                    </h3>
                    <div className="space-y-1">
                      {items.map((item) => {
                        const isSelected = selectedItem?.id === item.id;
                        return (
                          <div
                            key={item.id}
                            className={`group p-3 rounded-lg cursor-pointer transition-colors ${
                              isSelected 
                                ? 'bg-blue-100 border border-blue-300' 
                                : 'bg-white hover:bg-gray-100 border border-gray-200'
                            }`}
                            onClick={() => setSelectedItem(item)}
                          >
                            <div className="flex justify-between items-start">
                              <div className="flex-1 min-w-0">
                                <div className="flex items-center gap-1 mb-1">
                                  <FileText className="w-3 h-3 text-blue-500 flex-shrink-0" />
                                  {editingId === item.id ? (
                                    <input
                                      type="text"
                                      value={editingTitle}
                                      onChange={(e) => setEditingTitle(e.target.value)}
                                      className="flex-1 px-1 py-0.5 text-sm border border-gray-300 rounded focus:ring-1 focus:ring-blue-500 focus:border-transparent"
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
                                  ) : (
                                    <>
                                      <h3 className="text-sm font-medium text-gray-800 truncate">
                                        {getDisplayTitle(item)}
                                      </h3>
                                      <button
                                        onClick={(e) => handleStartEditing(item, e)}
                                        className="opacity-0 group-hover:opacity-100 p-0.5 text-gray-400 hover:text-gray-600 hover:bg-gray-200 rounded transition-all ml-1"
                                        title="タイトルを編集"
                                      >
                                        <Edit2 className="w-3 h-3" />
                                      </button>
                                    </>
                                  )}
                                </div>
                                <p className="text-xs text-gray-600 line-clamp-2 mb-1">{item.summary}</p>
                                <div className="flex items-center gap-2 text-[10px] text-gray-500">
                                  <span>{formatDateShort(item.timestamp)}</span>
                                  {(() => {
                                    const uniqueCaptures = getUniqueCaptures(item.visualCaptures);
                                    return uniqueCaptures.length > 0 && (
                                      <span className="flex items-center gap-0.5">
                                        <Image className="w-3 h-3" />
                                        {uniqueCaptures.length}
                                      </span>
                                    );
                                  })()}
                                  {item.metadata.totalDuration && (
                                    <span>{formatDuration(item.metadata.totalDuration)}</span>
                                  )}
                                </div>
                              </div>
                              <div className="flex items-center gap-1">
                                {editingId === item.id ? (
                                  <>
                                    <button
                                      onClick={(e) => handleSaveTitle(item.id, e)}
                                      className="p-0.5 text-green-600 hover:bg-green-50 rounded transition-colors"
                                      title="確定 (Ctrl+Enter)"
                                    >
                                      <Check className="w-3 h-3" />
                                    </button>
                                    <button
                                      onClick={handleCancelEdit}
                                      className="p-0.5 text-gray-600 hover:bg-gray-50 rounded transition-colors"
                                      title="キャンセル"
                                    >
                                      <Cancel className="w-3 h-3" />
                                    </button>
                                  </>
                                ) : (
                                  <button
                                    onClick={(e) => handleDelete(item.id, e)}
                                    className="p-1 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded opacity-0 group-hover:opacity-100 transition-all"
                                    title="削除"
                                  >
                                    <Trash2 className="w-3 h-3" />
                                  </button>
                                )}
                              </div>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Right Panel - Detail View */}
            <div className="flex-1 bg-white rounded-lg border border-gray-200 flex flex-col min-w-0">
              {selectedItem ? (
                <>
                  {/* Header - Fixed */}
                  <div className="p-4 lg:p-6 border-b bg-gray-50 flex-shrink-0">
                    <div className="flex justify-between items-start">
                      <div className="flex-1 min-w-0">
                        {editingId === selectedItem.id ? (
                          <div className="mb-3">
                            <input
                              type="text"
                              value={editingTitle}
                              onChange={(e) => setEditingTitle(e.target.value)}
                              className="w-full px-3 py-2 text-xl lg:text-2xl font-bold border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent bg-white"
                              onKeyDown={(e) => {
                                if (e.key === 'Enter' && e.ctrlKey) {
                                  handleSaveTitle(selectedItem.id, e as any);
                                } else if (e.key === 'Escape') {
                                  handleCancelEdit(e as any);
                                }
                              }}
                              autoFocus
                              placeholder="Ctrl+Enterで確定、Escapeでキャンセル"
                            />
                            <div className="flex gap-2 mt-2">
                              <button
                                onClick={(e) => handleSaveTitle(selectedItem.id, e)}
                                className="px-3 py-1 bg-green-600 text-white text-sm rounded-md hover:bg-green-700 transition-colors flex items-center gap-2"
                              >
                                <Check className="w-4 h-4" />
                                保存
                              </button>
                              <button
                                onClick={handleCancelEdit}
                                className="px-3 py-1 bg-gray-500 text-white text-sm rounded-md hover:bg-gray-600 transition-colors flex items-center gap-2"
                              >
                                <Cancel className="w-4 h-4" />
                                キャンセル
                              </button>
                            </div>
                          </div>
                        ) : (
                          <div className="group flex items-start gap-2 mb-2">
                            <h3 className="text-xl lg:text-2xl font-bold text-gray-800 break-words flex-1 cursor-pointer hover:text-purple-700 transition-colors"
                                onClick={() => handleStartEditing(selectedItem, {} as React.MouseEvent)}>
                              {getDisplayTitle(selectedItem)}
                            </h3>
                            <button
                              onClick={(e) => handleStartEditing(selectedItem, e)}
                              className="opacity-0 group-hover:opacity-100 p-1 text-gray-400 hover:text-purple-600 hover:bg-purple-50 rounded transition-all mt-1"
                              title="タイトルを編集"
                            >
                              <Edit2 className="w-4 h-4" />
                            </button>
                          </div>
                        )}
                        <div className="flex flex-wrap items-center gap-4 text-sm text-gray-600">
                          <span>{formatDate(selectedItem.timestamp)}</span>
                          {selectedItem.metadata.totalDuration && (
                            <span>長さ: {formatDuration(selectedItem.metadata.totalDuration)}</span>
                          )}
                          {selectedItem.metadata.language && (
                            <span>言語: {selectedItem.metadata.language}</span>
                          )}
                        </div>
                      </div>
                      
                      {/* Download All and Font Size Controls */}
                      <div className="flex items-center gap-2">
                        <button
                          onClick={() => handleDownloadAll(selectedItem)}
                          className="px-3 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors flex items-center gap-2 text-sm font-medium"
                          title="すべてのファイルをダウンロード"
                        >
                          <Download className="w-4 h-4" />
                          <span className="hidden sm:inline">すべてDL</span>
                        </button>
                        <div className="flex items-center gap-1">
                          <button
                            onClick={() => handleFontSizeChange('small')}
                            className={`p-2 rounded transition-colors ${
                              fontSize === 'small'
                                ? 'bg-purple-100 text-purple-700'
                                : 'text-gray-400 hover:text-gray-600 hover:bg-gray-100'
                            }`}
                            title="小さいフォント"
                          >
                            <Type className="w-3 h-3" />
                          </button>
                          <button
                            onClick={() => handleFontSizeChange('medium')}
                            className={`p-2 rounded transition-colors ${
                              fontSize === 'medium'
                                ? 'bg-purple-100 text-purple-700'
                                : 'text-gray-400 hover:text-gray-600 hover:bg-gray-100'
                            }`}
                            title="標準フォント"
                          >
                            <Type className="w-4 h-4" />
                          </button>
                          <button
                            onClick={() => handleFontSizeChange('large')}
                            className={`p-2 rounded transition-colors ${
                              fontSize === 'large'
                                ? 'bg-purple-100 text-purple-700'
                                : 'text-gray-400 hover:text-gray-600 hover:bg-gray-100'
                            }`}
                            title="大きいフォント"
                          >
                            <Type className="w-5 h-5" />
                          </button>
                        </div>
                      </div>
                    </div>
                  </div>
                  
                  {/* Content - Scrollable */}
                  <div className="flex-1 overflow-y-auto">
                    <div className="p-4 lg:p-6 lg:p-8 space-y-6 lg:space-y-8">
                      {/* Summary */}
                      <div>
                        <div className="flex justify-between items-center mb-4">
                          <h4 className="font-semibold text-lg lg:text-xl text-gray-700">要約</h4>
                          <div className="flex gap-2">
                            <button
                              onClick={() => handleCopyText(selectedItem.summary, '要約')}
                              className="p-2 text-gray-600 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
                              title="要約をコピー"
                            >
                              <Copy className="w-4 h-4" />
                            </button>
                            <button
                              onClick={() => {
                                const timestamp = new Date(selectedItem.timestamp).toISOString().replace(/[:.]/g, '-');
                                handleDownloadText(selectedItem.summary, `${getDisplayTitle(selectedItem)}_${timestamp}_要約.txt`);
                              }}
                              className="p-2 text-gray-600 hover:text-green-600 hover:bg-green-50 rounded-lg transition-colors"
                              title="要約をダウンロード"
                            >
                              <FileDown className="w-4 h-4" />
                            </button>
                          </div>
                        </div>
                        <div className={`p-6 lg:p-8 bg-blue-50 rounded-lg text-gray-800 whitespace-pre-wrap leading-relaxed ${getFontSizeClasses()}`}>
                          {selectedItem.summary}
                        </div>
                      </div>

                      {/* Visual Summary */}
                      {selectedItem.visualSummary && (
                        <div>
                          <div className="flex justify-between items-center mb-4">
                            <h4 className="font-semibold text-lg lg:text-xl text-gray-700">画面解析サマリー</h4>
                            <div className="flex gap-2">
                              <button
                                onClick={() => handleCopyText(selectedItem.visualSummary!, '画面解析サマリー')}
                                className="p-2 text-gray-600 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
                                title="画面解析サマリーをコピー"
                              >
                                <Copy className="w-4 h-4" />
                              </button>
                              <button
                                onClick={() => {
                                  const timestamp = new Date(selectedItem.timestamp).toISOString().replace(/[:.]/g, '-');
                                  handleDownloadText(selectedItem.visualSummary!, `${getDisplayTitle(selectedItem)}_${timestamp}_画面解析.txt`);
                                }}
                                className="p-2 text-gray-600 hover:text-green-600 hover:bg-green-50 rounded-lg transition-colors"
                                title="画面解析サマリーをダウンロード"
                              >
                                <FileDown className="w-4 h-4" />
                              </button>
                            </div>
                          </div>
                          <div className={`p-6 lg:p-8 bg-green-50 rounded-lg text-gray-800 whitespace-pre-wrap leading-relaxed ${getFontSizeClasses()}`}>
                            {selectedItem.visualSummary}
                          </div>
                        </div>
                      )}

                      {/* Visual Captures */}
                      {(() => {
                        const uniqueCaptures = getUniqueCaptures(selectedItem.visualCaptures);
                        return uniqueCaptures.length > 0 && (
                          <div>
                            <div className="flex justify-between items-center mb-4">
                              <h4 className="font-semibold text-lg lg:text-xl text-gray-700">
                                キャプチャ画像 ({uniqueCaptures.length}枚)
                              </h4>
                              <button
                                onClick={() => {
                                  const timestamp = new Date(selectedItem.timestamp).toISOString().replace(/[:.]/g, '-');
                                  const baseFilename = `${getDisplayTitle(selectedItem)}_${timestamp}`;
                                  uniqueCaptures.forEach((capture, index) => {
                                    const imageFilename = `${baseFilename}_キャプチャ_${index + 1}.png`;
                                    handleDownloadImage(capture.imageData, imageFilename);
                                  });
                                }}
                                className="p-2 text-gray-600 hover:text-green-600 hover:bg-green-50 rounded-lg transition-colors"
                                title="すべての画像をダウンロード"
                              >
                                <Download className="w-4 h-4" />
                              </button>
                            </div>
                            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 2xl:grid-cols-5 gap-4 lg:gap-6">
                              {uniqueCaptures.map((capture, index) => (
                                <div key={capture.id} className="group border rounded-lg overflow-hidden hover:shadow-lg transition-shadow">
                                  <div className="relative">
                                    <img 
                                      src={capture.imageData} 
                                      alt={`Capture at ${capture.recordingTime}s`}
                                      className="w-full h-40 lg:h-48 object-cover cursor-pointer"
                                      onClick={() => {
                                        // Optional: Add image modal functionality
                                      }}
                                    />
                                    <button
                                      onClick={(e) => {
                                        e.stopPropagation();
                                        const timestamp = new Date(selectedItem.timestamp).toISOString().replace(/[:.]/g, '-');
                                        const imageFilename = `${getDisplayTitle(selectedItem)}_${timestamp}_キャプチャ_${index + 1}.png`;
                                        handleDownloadImage(capture.imageData, imageFilename);
                                      }}
                                      className="absolute top-2 right-2 p-2 bg-black bg-opacity-50 text-white rounded-lg opacity-0 group-hover:opacity-100 transition-all hover:bg-opacity-70"
                                      title="画像をダウンロード"
                                    >
                                      <FileDown className="w-3 h-3" />
                                    </button>
                                  </div>
                                  <div className="p-3">
                                    <div className="text-gray-500 text-xs mb-1">{capture.recordingTime}秒</div>
                                    <div className="text-xs text-gray-700 line-clamp-2">{capture.description}</div>
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
                          <div className="flex justify-between items-center mb-4">
                            <h4 className="font-semibold text-lg lg:text-xl text-gray-700">文字起こし結果</h4>
                            <button
                              onClick={() => {
                                const timestamp = new Date(selectedItem.timestamp).toISOString().replace(/[:.]/g, '-');
                                const baseFilename = `${getDisplayTitle(selectedItem)}_${timestamp}`;
                                selectedItem.transcriptionResults!.forEach((result, index) => {
                                  handleDownloadText(result.text, `${baseFilename}_文字起こし_${index + 1}.txt`);
                                });
                              }}
                              className="p-2 text-gray-600 hover:text-green-600 hover:bg-green-50 rounded-lg transition-colors"
                              title="すべての文字起こしをダウンロード"
                            >
                              <Download className="w-4 h-4" />
                            </button>
                          </div>
                          <div className="space-y-4">
                            {selectedItem.transcriptionResults.map((result, index) => (
                              <div key={index} className="border rounded-lg">
                                <div className="p-4 bg-gray-50 border-b">
                                  <div className="flex justify-between items-center">
                                    <h5 className="font-medium text-gray-800">{result.fileName}</h5>
                                    <div className="flex gap-1">
                                      <button
                                        onClick={() => handleCopyText(result.text, `文字起こし (${result.fileName})`)}
                                        className="p-1.5 text-gray-600 hover:text-blue-600 hover:bg-blue-50 rounded transition-colors"
                                        title="この文字起こしをコピー"
                                      >
                                        <Copy className="w-3 h-3" />
                                      </button>
                                      <button
                                        onClick={() => {
                                          const timestamp = new Date(selectedItem.timestamp).toISOString().replace(/[:.]/g, '-');
                                          handleDownloadText(result.text, `${getDisplayTitle(selectedItem)}_${timestamp}_文字起こし_${index + 1}.txt`);
                                        }}
                                        className="p-1.5 text-gray-600 hover:text-green-600 hover:bg-green-50 rounded transition-colors"
                                        title="この文字起こしをダウンロード"
                                      >
                                        <FileDown className="w-3 h-3" />
                                      </button>
                                    </div>
                                  </div>
                                </div>
                                <div className={`p-6 text-gray-700 whitespace-pre-wrap leading-relaxed ${getFontSizeClasses()}`}>
                                  {result.text}
                                </div>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}
                    </div>
                  </div>
                </>
              ) : (
                <div className="flex-1 flex items-center justify-center text-gray-400">
                  <div className="text-center p-8">
                    <Eye className="w-20 h-20 mx-auto mb-6 opacity-50" />
                    <p className="text-xl lg:text-2xl mb-2">要約を選択して詳細を表示</p>
                    <p className="text-sm lg:text-base">左側のリストから確認したい要約をクリックしてください</p>
                  </div>
                </div>
              )}
            </div>
          </div>
        )}
      </div>

      {/* Detail Modal */}
      {showModal && selectedItem && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl max-w-4xl w-full max-h-[90vh] overflow-hidden flex flex-col">
            <div className="p-6 border-b">
              <div className="flex justify-between items-start">
                <h3 className="text-xl font-bold flex-1">{getDisplayTitle(selectedItem)}</h3>
                <div className="flex items-center gap-2">
                  {/* Font Size Controls */}
                  <div className="flex items-center gap-1 mr-2">
                    <button
                      onClick={() => handleFontSizeChange('small')}
                      className={`p-1 rounded transition-colors ${
                        fontSize === 'small'
                          ? 'bg-purple-100 text-purple-700'
                          : 'text-gray-400 hover:text-gray-600 hover:bg-gray-100'
                      }`}
                      title="小さいフォント"
                    >
                      <Type className="w-3 h-3" />
                    </button>
                    <button
                      onClick={() => handleFontSizeChange('medium')}
                      className={`p-1 rounded transition-colors ${
                        fontSize === 'medium'
                          ? 'bg-purple-100 text-purple-700'
                          : 'text-gray-400 hover:text-gray-600 hover:bg-gray-100'
                      }`}
                      title="標準フォント"
                    >
                      <Type className="w-4 h-4" />
                    </button>
                    <button
                      onClick={() => handleFontSizeChange('large')}
                      className={`p-1 rounded transition-colors ${
                        fontSize === 'large'
                          ? 'bg-purple-100 text-purple-700'
                          : 'text-gray-400 hover:text-gray-600 hover:bg-gray-100'
                      }`}
                      title="大きいフォント"
                    >
                      <Type className="w-5 h-5" />
                    </button>
                  </div>
                  <button
                    onClick={() => setShowModal(false)}
                    className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
                  >
                    <X className="w-5 h-5" />
                  </button>
                </div>
              </div>
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
                <div className={`p-4 bg-blue-50 rounded-lg whitespace-pre-wrap ${getFontSizeClasses()}`}>{selectedItem.summary}</div>
              </div>

              {/* Visual Summary */}
              {selectedItem.visualSummary && (
                <div className="mb-6">
                  <h4 className="font-semibold text-lg mb-2">画面解析サマリー</h4>
                  <div className={`p-4 bg-green-50 rounded-lg whitespace-pre-wrap ${getFontSizeClasses()}`}>{selectedItem.visualSummary}</div>
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
                        <div className={`text-sm text-gray-700 whitespace-pre-wrap max-h-40 overflow-y-auto ${getFontSizeClasses()}`}>
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