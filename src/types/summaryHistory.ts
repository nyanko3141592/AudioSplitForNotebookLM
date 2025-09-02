// Summary history types for local storage

export interface SummaryHistoryItem {
  id: string;
  timestamp: string;
  fileName: string;
  title?: string; // Custom title that overrides fileName for display
  summary: string;
  transcriptionResults: Array<{
    fileName: string;
    text: string;
  }>;
  visualSummary?: string;
  visualCaptures?: Array<{
    id: string;
    imageData: string;
    description: string;
    recordingTime: number;
  }>;
  metadata: {
    totalDuration?: number;
    language?: string;
    model?: string;
    createdAt: string;
  };
}

export interface SummaryHistoryState {
  items: SummaryHistoryItem[];
  maxItems: number;
}