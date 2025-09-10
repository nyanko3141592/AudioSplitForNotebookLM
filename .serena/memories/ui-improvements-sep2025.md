# UI and Persistence Improvements (Sep 2025)

- Summary history save hardened against storage quota errors:
  - First try normal save; on failure remove images/visual summaries from all items; if still failing, trim oldest items until it saves.
  - Dispatches `summaryHistoryUpdated` CustomEvent on success for same-tab live refresh.
- Summary list auto-refreshes:
  - `SummaryHistory` listens to `summaryHistoryUpdated` and `storage` events to reload immediately.
- Navigation warnings:
  - App-level guard prompts on internal page changes (including header nav) when unsaved data exists (split files, transcription results, background info).
  - Hard block during recording; additional alert as safeguard.
- Auto-download on recording finish:
  - Screen recording (video) is auto-downloaded on stop.
  - Audio-only recording auto-downloads: single segment as file, multiple segments zipped via `downloadAllAsZip`.

## Files Touched
- `src/utils/summaryHistory.ts`: quota-safe saving, event dispatch helper
- `src/components/SummaryHistory.tsx`: event subscriptions to refresh
- `src/App.tsx`: guarded navigation with unsaved-data confirm
- `src/pages/TranscribePage.tsx`: step state includes `hasBackgroundInfo`
- `src/components/RecordingPanel.tsx`: auto-download for video/audio

## Testing Notes
- Create large summaries with images to simulate quota; verify graceful degradation still persists text and list updates live.
- While having transcription results/background info, click header nav; confirm dialog appears. While recording, nav is blocked.
- Stop screen recording; verify `webm` auto-download. Finish audio-only recording; verify single or zipped download.
