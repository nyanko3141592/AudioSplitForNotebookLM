// Summary history management utility
import type { SummaryHistoryItem, SummaryHistoryState } from '../types/summaryHistory';

const STORAGE_KEY = 'summaryHistory';
const MAX_HISTORY_ITEMS = -1; // -1 means unlimited

/**
 * Load summary history from localStorage
 */
export const loadSummaryHistory = (): SummaryHistoryState => {
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored) {
      const history = JSON.parse(stored) as SummaryHistoryState;
      // Ensure max items is set
      if (!history.maxItems) {
        history.maxItems = MAX_HISTORY_ITEMS;
      }
      return history;
    }
  } catch (error) {
    console.error('Failed to load summary history:', error);
  }
  
  return {
    items: [],
    maxItems: MAX_HISTORY_ITEMS
  };
};

/**
 * Save summary history to localStorage
 */
export const saveSummaryHistory = (history: SummaryHistoryState): void => {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(history));
    // Notify listeners in this tab that history changed
    try { window.dispatchEvent(new CustomEvent('summaryHistoryUpdated')); } catch {}
    console.log(`📚 Summary history saved (${history.items.length} items)`);
  } catch (error) {
    console.error('Failed to save summary history:', error);
  }
};

// Internal helper: try to save, returning success/failure
const __trySaveSummaryHistory = (history: SummaryHistoryState): boolean => {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(history));
    try { window.dispatchEvent(new CustomEvent('summaryHistoryUpdated')); } catch {}
    return true;
  } catch {
    return false;
  }
};

/**
 * Add a new summary to history (maintains max items limit)
 */
export const addSummaryToHistory = (item: SummaryHistoryItem): void => {
  const history = loadSummaryHistory();
  
  // Add new item at the beginning
  history.items.unshift(item);
  
  // Keep only the most recent items if there's a limit (-1 means unlimited)
  if (history.maxItems > 0 && history.items.length > history.maxItems) {
    history.items = history.items.slice(0, history.maxItems);
    console.log(`🗑️ Trimmed history to ${history.maxItems} items`);
  }
  
  // First attempt
  if (__trySaveSummaryHistory(history)) return;

  // If quota exceeded, try progressively reducing size
  console.warn('Storage quota may be exceeded. Attempting to shrink history data and retry...');

  // 1) Remove images and visual summaries (they are largest)
  const hadVisuals = history.items.some(it => (it.visualCaptures && it.visualCaptures.length > 0) || it.visualSummary);
  if (hadVisuals) {
    history.items = history.items.map(it => ({
      ...it,
      visualCaptures: [],
      ...(it.visualSummary ? { visualSummary: undefined } as any : {})
    }));
    if (__trySaveSummaryHistory(history)) return;
  }

  // 2) Trim oldest items until it fits
  while (history.items.length > 0) {
    history.items.pop();
    if (__trySaveSummaryHistory(history)) return;
  }

  console.error('Failed to save summary history even after cleanup.');
};

/**
 * Delete a specific summary from history
 */
export const deleteSummaryFromHistory = (id: string): void => {
  const history = loadSummaryHistory();
  history.items = history.items.filter(item => item.id !== id);
  saveSummaryHistory(history);
  console.log(`🗑️ Deleted summary ${id} from history`);
};

/**
 * Clear all summary history
 */
export const clearSummaryHistory = (): void => {
  saveSummaryHistory({
    items: [],
    maxItems: MAX_HISTORY_ITEMS
  });
  console.log('🧹 Cleared all summary history');
};

/**
 * Get a specific summary by ID
 */
export const getSummaryById = (id: string): SummaryHistoryItem | null => {
  const history = loadSummaryHistory();
  return history.items.find(item => item.id === id) || null;
};

/**
 * Export summary history as JSON
 */
export const exportSummaryHistory = (): string => {
  const history = loadSummaryHistory();
  return JSON.stringify(history, null, 2);
};

/**
 * Import summary history from JSON
 */
export const importSummaryHistory = (jsonString: string): boolean => {
  try {
    const imported = JSON.parse(jsonString) as SummaryHistoryState;
    if (imported.items && Array.isArray(imported.items)) {
      saveSummaryHistory(imported);
      return true;
    }
  } catch (error) {
    console.error('Failed to import summary history:', error);
  }
  return false;
};

/**
 * Update the maximum number of items to keep in history
 */
export const updateHistoryLimit = (maxItems: number | null): void => {
  const history = loadSummaryHistory();
  history.maxItems = maxItems || -1; // -1 means unlimited
  
  // If setting a limit and current items exceed it, trim the list
  if (maxItems && maxItems > 0 && history.items.length > maxItems) {
    history.items = history.items.slice(0, maxItems);
    console.log(`🗑️ Trimmed history to ${maxItems} items`);
  }
  
  saveSummaryHistory(history);
  console.log(`⚙️ Updated history limit to ${maxItems || 'unlimited'} items`);
};

/**
 * Get available history limit options
 */
export const getHistoryLimitOptions = () => [
  { value: 10, label: '10件' },
  { value: 50, label: '50件' },
  { value: 100, label: '100件' },
  { value: -1, label: 'すべて（制限なし）' }
];

/**
 * Update the title of a specific summary
 */
export const updateSummaryTitle = (id: string, title: string): boolean => {
  const history = loadSummaryHistory();
  const item = history.items.find(item => item.id === id);
  
  if (item) {
    item.title = title.trim() || undefined; // Empty title removes the custom title
    saveSummaryHistory(history);
    console.log(`📝 Updated title for summary ${id}`);
    return true;
  }
  
  return false;
};

/**
 * Calculate storage statistics for summary history
 */
export interface StorageStats {
  totalSize: number;
  totalSizeFormatted: string;
  itemCount: number;
  imageCount: number;
  totalImages: number;
  transcriptionCount: number;
  breakdown: {
    summaries: number;
    images: number;
    transcriptions: number;
    metadata: number;
  };
  byDate: {
    today: number;
    thisWeek: number;
    thisMonth: number;
    older: number;
  };
}

function formatBytes(bytes: number): string {
  if (bytes === 0) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return `${(bytes / Math.pow(k, i)).toFixed(1)} ${sizes[i]}`;
}

function getStringByteSize(str: string): number {
  // UTF-8 encoding size estimation
  return new Blob([str]).size;
}

export const getStorageStats = (): StorageStats => {
  const history = loadSummaryHistory();
  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const thisWeekStart = new Date(today);
  thisWeekStart.setDate(thisWeekStart.getDate() - today.getDay());
  const thisMonthStart = new Date(now.getFullYear(), now.getMonth(), 1);
  
  let totalSize = 0;
  let imageCount = 0;
  let totalImages = 0;
  let transcriptionCount = 0;
  let summariesSize = 0;
  let imagesSize = 0;
  let transcriptionsSize = 0;
  let metadataSize = 0;
  
  const byDate = {
    today: 0,
    thisWeek: 0,
    thisMonth: 0,
    older: 0
  };
  
  history.items.forEach(item => {
    const itemDate = new Date(item.timestamp);
    
    // Date categorization
    if (itemDate >= today) {
      byDate.today++;
    } else if (itemDate >= thisWeekStart) {
      byDate.thisWeek++;
    } else if (itemDate >= thisMonthStart) {
      byDate.thisMonth++;
    } else {
      byDate.older++;
    }
    
    // Summary size
    if (item.summary) {
      summariesSize += getStringByteSize(item.summary);
    }
    
    // Visual summary size
    if (item.visualSummary) {
      summariesSize += getStringByteSize(item.visualSummary);
    }
    
    // Images
    if (item.visualCaptures && item.visualCaptures.length > 0) {
      imageCount++;
      const uniqueCaptures = item.visualCaptures;
      totalImages += uniqueCaptures.length;
      
      uniqueCaptures.forEach(capture => {
        if (capture.imageData) {
          imagesSize += getStringByteSize(capture.imageData);
        }
        if (capture.description) {
          imagesSize += getStringByteSize(capture.description);
        }
      });
    }
    
    // Transcriptions
    if (item.transcriptionResults && item.transcriptionResults.length > 0) {
      transcriptionCount++;
      item.transcriptionResults.forEach(result => {
        if (result.text) {
          transcriptionsSize += getStringByteSize(result.text);
        }
      });
    }
    
    // Metadata
    metadataSize += getStringByteSize(JSON.stringify(item.metadata));
  });
  
  totalSize = summariesSize + imagesSize + transcriptionsSize + metadataSize;
  
  return {
    totalSize,
    totalSizeFormatted: formatBytes(totalSize),
    itemCount: history.items.length,
    imageCount,
    totalImages,
    transcriptionCount,
    breakdown: {
      summaries: summariesSize,
      images: imagesSize,
      transcriptions: transcriptionsSize,
      metadata: metadataSize
    },
    byDate
  };
};

/**
 * Delete items by type or date range
 */
export const deleteItemsByFilter = (filter: {
  type?: 'withImages' | 'withoutImages' | 'withTranscriptions';
  olderThan?: Date;
}): number => {
  const history = loadSummaryHistory();
  const originalCount = history.items.length;
  
  history.items = history.items.filter(item => {
    // Filter by type
    if (filter.type) {
      const hasImages = item.visualCaptures && item.visualCaptures.length > 0;
      const hasTranscriptions = item.transcriptionResults && item.transcriptionResults.length > 0;
      
      switch (filter.type) {
        case 'withImages':
          if (hasImages) return false;
          break;
        case 'withoutImages':
          if (!hasImages) return false;
          break;
        case 'withTranscriptions':
          if (hasTranscriptions) return false;
          break;
      }
    }
    
    // Filter by date
    if (filter.olderThan) {
      const itemDate = new Date(item.timestamp);
      if (itemDate < filter.olderThan) return false;
    }
    
    return true;
  });
  
  const deletedCount = originalCount - history.items.length;
  if (deletedCount > 0) {
    saveSummaryHistory(history);
    console.log(`🗑️ Deleted ${deletedCount} items by filter`);
  }
  
  return deletedCount;
};

/**
 * Remove all image data from summaries while keeping the summaries themselves
 */
export const removeAllImages = (): { removedImages: number; affectedItems: number } => {
  const history = loadSummaryHistory();
  let removedImages = 0;
  let affectedItems = 0;
  
  history.items.forEach(item => {
    if (item.visualCaptures && item.visualCaptures.length > 0) {
      const uniqueCaptures = item.visualCaptures;
      if (uniqueCaptures.length > 0) {
        removedImages += uniqueCaptures.length;
        affectedItems++;
        
        // Remove image data but keep metadata
        item.visualCaptures = [];
        // Also remove visual summary if it exists
        if (item.visualSummary) {
          delete item.visualSummary;
        }
      }
    }
  });
  
  if (affectedItems > 0) {
    saveSummaryHistory(history);
    console.log(`🗑️ Removed ${removedImages} images from ${affectedItems} summaries`);
  }
  
  return { removedImages, affectedItems };
};

/**
 * Get detailed statistics about summary history
 */
export interface DetailedStats {
  overview: {
    totalItems: number;
    totalSize: string;
    averageSize: string;
    totalDuration: string;
    averageDuration: string;
    oldestDate: string;
    newestDate: string;
  };
  mediaStats: {
    withImages: number;
    withoutImages: number;
    totalImages: number;
    averageImagesPerItem: number;
    withTranscriptions: number;
    totalTranscriptions: number;
  };
  timeDistribution: {
    hourly: { [key: number]: number };
    daily: { [key: string]: number };
    monthly: { [key: string]: number };
  };
  languageStats: { [key: string]: number };
  modelStats: { [key: string]: number };
  topKeywords: { word: string; count: number }[];
}

/**
 * Get calendar activity data for visualization
 */
export interface CalendarActivity {
  date: string; // YYYY-MM-DD format
  summaries: number;
  transcriptions: number;
  images: number;
  totalDuration: number;
}

export const getCalendarActivity = (year: number, month: number): CalendarActivity[] => {
  const history = loadSummaryHistory();
  const activities: { [key: string]: CalendarActivity } = {};
  
  // Initialize all days in the month
  const daysInMonth = new Date(year, month, 0).getDate();
  for (let day = 1; day <= daysInMonth; day++) {
    const dateStr = `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
    activities[dateStr] = {
      date: dateStr,
      summaries: 0,
      transcriptions: 0,
      images: 0,
      totalDuration: 0
    };
  }
  
  // Process items
  history.items.forEach(item => {
    const itemDate = new Date(item.timestamp);
    if (itemDate.getFullYear() === year && itemDate.getMonth() + 1 === month) {
      const dateStr = `${year}-${String(month).padStart(2, '0')}-${String(itemDate.getDate()).padStart(2, '0')}`;
      
      if (activities[dateStr]) {
        activities[dateStr].summaries++;
        
        if (item.transcriptionResults && item.transcriptionResults.length > 0) {
          activities[dateStr].transcriptions += item.transcriptionResults.length;
        }
        
        if (item.visualCaptures && item.visualCaptures.length > 0) {
          const uniqueCaptures = item.visualCaptures;
          activities[dateStr].images += uniqueCaptures.length;
        }
        
        if (item.metadata.totalDuration) {
          activities[dateStr].totalDuration += item.metadata.totalDuration;
        }
      }
    }
  });
  
  return Object.values(activities).sort((a, b) => a.date.localeCompare(b.date));
};

export const getDetailedStats = (): DetailedStats => {
  const history = loadSummaryHistory();
  const stats = getStorageStats();
  
  // Calculate total duration
  let totalDurationSeconds = 0;
  let itemsWithDuration = 0;
  
  // Time distribution
  const hourly: { [key: number]: number } = {};
  const daily: { [key: string]: number } = {};
  const monthly: { [key: string]: number } = {};
  
  // Language and model stats
  const languageStats: { [key: string]: number } = {};
  const modelStats: { [key: string]: number } = {};
  
  // Keywords extraction
  const wordFrequency: { [key: string]: number } = {};
  const stopWords = new Set(['の', 'に', 'は', 'を', 'が', 'と', 'で', 'て', 'た', 'し', 'も', 'な', 'い', 'か', 'る', 'れ', 'さ', 'ある', 'する', 'です', 'ます']);
  
  let oldestDate: Date | null = null;
  let newestDate: Date | null = null;
  
  history.items.forEach(item => {
    const itemDate = new Date(item.timestamp);
    
    // Track oldest and newest
    if (!oldestDate || itemDate < oldestDate) oldestDate = itemDate;
    if (!newestDate || itemDate > newestDate) newestDate = itemDate;
    
    // Time distribution
    const hour = itemDate.getHours();
    hourly[hour] = (hourly[hour] || 0) + 1;
    
    const dayKey = itemDate.toLocaleDateString('ja-JP');
    daily[dayKey] = (daily[dayKey] || 0) + 1;
    
    const monthKey = `${itemDate.getFullYear()}-${String(itemDate.getMonth() + 1).padStart(2, '0')}`;
    monthly[monthKey] = (monthly[monthKey] || 0) + 1;
    
    // Duration
    if (item.metadata.totalDuration) {
      totalDurationSeconds += item.metadata.totalDuration;
      itemsWithDuration++;
    }
    
    // Language stats
    if (item.metadata.language) {
      languageStats[item.metadata.language] = (languageStats[item.metadata.language] || 0) + 1;
    }
    
    // Model stats
    if (item.metadata.model) {
      modelStats[item.metadata.model] = (modelStats[item.metadata.model] || 0) + 1;
    }
    
    // Extract keywords from summary
    if (item.summary) {
      const words = item.summary
        .replace(/[。、！？「」『』（）\[\]\s]+/g, ' ')
        .split(' ')
        .filter(word => word.length > 1 && !stopWords.has(word));
      
      words.forEach(word => {
        wordFrequency[word] = (wordFrequency[word] || 0) + 1;
      });
    }
  });
  
  // Get top keywords
  const topKeywords = Object.entries(wordFrequency)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 10)
    .map(([word, count]) => ({ word, count }));
  
  // Format durations
  const formatDurationLong = (seconds: number): string => {
    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    const secs = seconds % 60;
    
    if (hours > 0) {
      return `${hours}時間${minutes}分${secs}秒`;
    }
    return `${minutes}分${secs}秒`;
  };
  
  const averageDuration = itemsWithDuration > 0 
    ? Math.round(totalDurationSeconds / itemsWithDuration) 
    : 0;
  
  // Count media stats
  let withImages = 0;
  let totalTranscriptions = 0;
  let withTranscriptions = 0;
  
  history.items.forEach(item => {
    if (item.visualCaptures && item.visualCaptures.length > 0) {
      withImages++;
    }
    if (item.transcriptionResults && item.transcriptionResults.length > 0) {
      withTranscriptions++;
      totalTranscriptions += item.transcriptionResults.length;
    }
  });
  
  return {
    overview: {
      totalItems: history.items.length,
      totalSize: stats.totalSizeFormatted,
      averageSize: history.items.length > 0 
        ? formatBytes(Math.round(stats.totalSize / history.items.length))
        : '0 B',
      totalDuration: formatDurationLong(totalDurationSeconds),
      averageDuration: formatDurationLong(averageDuration),
      oldestDate: oldestDate ? (oldestDate as Date).toLocaleDateString('ja-JP') : '-',
      newestDate: newestDate ? (newestDate as Date).toLocaleDateString('ja-JP') : '-'
    },
    mediaStats: {
      withImages,
      withoutImages: history.items.length - withImages,
      totalImages: stats.totalImages,
      averageImagesPerItem: withImages > 0 ? Math.round(stats.totalImages / withImages * 10) / 10 : 0,
      withTranscriptions,
      totalTranscriptions
    },
    timeDistribution: {
      hourly,
      daily,
      monthly
    },
    languageStats,
    modelStats,
    topKeywords
  };
};
