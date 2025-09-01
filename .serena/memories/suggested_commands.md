# Suggested Commands

## Setup
- `node -v` / `npm -v`: Verify Node 18+ and npm 9+.
- `npm ci` or `npm install`: Install dependencies.

## Development
- `npm run dev`: Start Vite dev server (default http://localhost:5173).
- `npm run lint`: Run ESLint (TypeScript + React rules).

## Build & Preview
- `npm run build`: Type-check (via tsc -b) and build production assets with Vite.
- `npm run preview`: Preview the built app locally.

## Linting/Formatting (Editors)
- Use ESLint integration; Prettier may be used via editor plugin (no repo script present).

## Useful macOS (Darwin) Utils
- `ls`, `rg <pattern>`, `sed -n '1,200p' <file>`: Explore files quickly.
- `open index.html`: Open a file with default app.
- `open http://localhost:5173`: Open dev server in browser.