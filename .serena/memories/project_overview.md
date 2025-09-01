# Project Overview

- Purpose: A browser-based app to record or upload meeting audio, auto-split large files to NotebookLM-friendly sizes, transcribe with Gemini, and generate summaries. Japanese-first UI; deployable to GitHub Pages.
- Tech Stack: TypeScript + React 19 + Vite 7; Tailwind CSS v4; FFmpeg.wasm (@ffmpeg/ffmpeg, @ffmpeg/util) with Web Audio API primary and FFmpeg fallback; Google Generative AI SDK (@google/generative-ai); Radix UI for primitives; lucide-react icons; JSZip + file-saver for downloads; ESLint + typescript-eslint.
- Entrypoints: `index.html` loads `src/main.tsx` which renders `src/App.tsx`. App toggles between `TranscribePage` (record/upload → split → transcribe → summarize) and `SplitPage` (split only). Vite base is `/AudioSplitForNotebookLM/` for GitHub Pages.
- Build/Serve: Vite dev server for local dev; TypeScript project refs (`tsconfig.app.json`, `tsconfig.node.json`). COOP/COEP headers enabled for FFmpeg/WebAudio; dev proxy for Cloudflare AI Gateway at `/api/cloudflare`.
- Notable Behavior: Auto-splitting kicks in over ~200MB (uses 190MB target). API key stored obfuscated in storage (session or persistent modes) and optional custom API endpoint (defaults to Google). Custom endpoint path is proxied in dev.
- Deployment: Static build suitable for GitHub Pages. Ensure `vite.config.ts` `base` path matches hosting.

## Code Structure (high-level)
- src/
  - components/: UI components and steps (upload, options, results, recording, hero, etc.)
  - pages/: `TranscribePage`, `SplitPage`
  - hooks/: `useFFmpeg` (loads FFmpeg.wasm; progress handling)
  - utils/: `audioSplitter` (Web Audio API split engine), `geminiTranscriber` (Gemini SDK + custom endpoint support), `download`, `storage`, `format`, `videoToAudio`, `recordingIndicator`
  - lib/: general helpers
  - assets/: static assets
- public/: PWA manifest and icons
- Config: `vite.config.ts`, `eslint.config.js`, `tsconfig*.json`, `postcss.config.js`