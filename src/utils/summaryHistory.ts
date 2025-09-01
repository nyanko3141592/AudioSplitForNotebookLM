// Summary history management utility
import type { SummaryHistoryItem, SummaryHistoryState } from '../types/summaryHistory';

const STORAGE_KEY = 'summaryHistory';
const MAX_HISTORY_ITEMS = 10;

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
    console.log(`📚 Summary history saved (${history.items.length} items)`);
  } catch (error) {
    console.error('Failed to save summary history:', error);
  }
};

/**
 * Add a new summary to history (maintains max items limit)
 */
export const addSummaryToHistory = (item: SummaryHistoryItem): void => {
  const history = loadSummaryHistory();
  
  // Add new item at the beginning
  history.items.unshift(item);
  
  // Keep only the most recent MAX_HISTORY_ITEMS
  if (history.items.length > history.maxItems) {
    history.items = history.items.slice(0, history.maxItems);
    console.log(`🗑️ Trimmed history to ${history.maxItems} items`);
  }
  
  saveSummaryHistory(history);
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