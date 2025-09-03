# Recovery Functionality Implementation

## Overview
Added comprehensive recovery functionality to handle interrupted processing and allow users to resume from where they left off.

## Key Components

### 1. RecoveryManager (`src/utils/recoveryManager.ts`)
- Singleton class that manages recovery state persistence
- Saves state to localStorage with automatic expiry (24 hours)
- Supports auto-save functionality with configurable intervals
- Tracks state for different steps: split, transcription, summary, visual

### 2. useRecovery Hook (`src/hooks/useRecovery.ts`)
- React hook that provides recovery functionality to components
- Detects recoverable state on mount
- Handles browser unload warnings for unsaved data
- Provides methods: recoverState, clearRecovery, saveProgress, startAutoSave, stopAutoSave

### 3. RecoveryDialog Component (`src/components/RecoveryDialog.tsx`)
- Modal dialog shown when recovery state is detected
- Shows last saved time, current step, and progress
- Allows users to either recover or start fresh

### 4. Integration Points

#### TranscribePage
- Shows recovery dialog on page load if recoverable state exists
- Saves file selection, visual captures, and processing progress
- Restores state when user chooses to recover

#### TranscriptionStep
- Tracks transcription progress for each file
- Saves completed transcriptions incrementally
- Allows resuming from last completed file

#### SummaryStep
- Saves summary generation state
- Preserves generated summaries and background info

## Recovery State Structure
```typescript
interface RecoveryState {
  timestamp: number;
  currentStep: string;
  version: string;
  
  selectedFile?: { name, size, type, lastModified };
  
  splitState?: {
    isProcessing: boolean;
    progress: number;
    completedFiles: Array<{ name, size, duration }>;
  };
  
  transcriptionState?: {
    isProcessing: boolean;
    currentFileIndex: number;
    totalFiles: number;
    completedTranscriptions: Array<{ fileName, text, timestamp }>;
    settings: { model, language, backgroundInfo, customPrompt };
  };
  
  summaryState?: {
    isProcessing: boolean;
    transcriptionResults?: any[];
    backgroundInfo?: string;
    generatedSummary?: string;
  };
  
  visualCaptureState?: {
    captures: Array<{ timestamp, imageUrl, tabInfo }>;
    analysisProgress?: number;
    analyzedCaptures?: any[];
    visualSummary?: string;
  };
}
```

## Usage
1. Recovery state is automatically saved during processing
2. On page reload, if recoverable state exists, dialog is shown
3. User can choose to continue from where they left off
4. State is cleared after successful completion or after 24 hours

## Benefits
- Prevents data loss from browser crashes or accidental page refreshes
- Allows users to pause and resume long-running operations
- Maintains progress for batch transcriptions
- Preserves expensive API processing results