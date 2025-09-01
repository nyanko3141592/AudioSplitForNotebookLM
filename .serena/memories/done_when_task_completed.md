# When A Task Is Completed

- Run checks:
  - `npm run lint` to ensure code quality.
  - `npm run build` to ensure the app type-checks and builds.
- Manual sanity:
  - `npm run dev` and verify core flows:
    - Split large audio (size/count) and download outputs.
    - Transcribe sample audio with Gemini (default endpoint) and with a custom endpoint if applicable.
    - Summarize generated transcriptions.
  - Confirm COOP/COEP headers present and FFmpeg.wasm/Web Audio flows work in dev.
- Update docs:
  - README snippets or usage notes if UX changed.
  - `DEVELOPER_GUIDE.md` sections if commands or architecture changed.
- Deployment considerations:
  - If changing app base path or hosting, update `vite.config.ts` `base`.
  - For GitHub Pages, confirm assets under `/AudioSplitForNotebookLM/` load.
- Housekeeping:
  - Revoke any created object URLs and ensure audio contexts/recorders are cleaned up in code paths you touched.
  - Ensure no API keys are hardcoded; use storage helpers.