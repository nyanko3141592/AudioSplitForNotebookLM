# Style and Conventions

- Language: TypeScript with strict settings (`strict`, `noUnusedLocals`, `noUnusedParameters`, etc.).
- Modules/JSX: ESNext modules, React 19 automatic JSX runtime (`react-jsx`).
- Linting: ESLint with `@eslint/js`, `typescript-eslint`, `eslint-plugin-react-hooks`, `eslint-plugin-react-refresh`. Keep code free of unused vars/params; prefer hooks rules.
- Components: Functional React components with typed props; lift state up; pass callbacks for child→parent communication. Keep components focused (SoC) as outlined in `DEVELOPER_GUIDE.md`.
- Naming: camelCase for variables/functions, PascalCase for components/types, kebab-case for files when conventional; current repo uses PascalCase for component files (e.g., `TranscribePage.tsx`).
- Styling: Tailwind CSS utility classes; prefer semantic, composable class usage and `tailwind-merge` when combining.
- Audio Processing: Prefer Web Audio API engine (`utils/audioSplitter.ts`) and fall back to FFmpeg.wasm via `hooks/useFFmpeg.ts` when needed. Avoid returning original file on failure; propagate errors cleanly.
- API Integration: Use `GeminiTranscriber` to interact with Gemini. Support default Google endpoint and custom endpoints (e.g., Cloudflare AI Gateway). Keep API key handling via `utils/storage.ts` (obfuscated, session/persistent modes).
- State/Storage: Use `localStorage` helpers in `utils/storage.ts` for prompts, background info, settings; clean up temporary URLs and audio contexts to prevent leaks.
- Docs: Keep README and `DEVELOPER_GUIDE.md` in sync when behavior or commands change (e.g., if adding format/type-check scripts).