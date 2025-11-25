// Summary history types for local storage

export interface TranscriptionResult {
  fileName: string;
  text: string;
}

export interface VisualCapture {
  id: string;
  imageData: string;
  description: string;
  recordingTime: number;
}

export interface SummaryHistoryItem {
  id: string;
  timestamp: string;
  fileName: string;
  title?: string; // Custom title that overrides fileName for display
  summary: string;
  transcriptionResults: TranscriptionResult[];
  visualSummary?: string;
  visualCaptures?: VisualCapture[];
  metadata: {
    totalDuration?: number;
    language?: string;
    model?: string;
    createdAt: string;
    companyName?: string;
    meetingDate?: string;
  };
}

export interface SummaryHistoryState {
  items: SummaryHistoryItem[];
  maxItems: number;
}
