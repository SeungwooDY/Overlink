# Overlink Monorepo

Phase 1 reorganizes Overlink into a workspace monorepo and introduces a Chrome extension MVP focused on Google Meet feasibility validation.

## Workspace Layout

```text
apps/
  web/        Next.js marketing/dashboard app
  extension/  Chrome extension (Vite + TypeScript, MV3)
packages/
  core/       Shared processing engine placeholder
```

## Commands

From the repo root:

- `npm run dev:web` – run the Next.js web app.
- `npm run build:web` – build the Next.js web app.
- `npm run build:extension` – build extension artifacts for Chrome.
- `npm run lint:web` – lint the web app.

## Extension Phase 1 Scope

The extension currently validates technical feasibility only:

1. Detect Google Meet screen-share `<video>` candidates.
2. Capture frames through a canvas and verify pixel access.
3. Downscale frames before OCR.
4. Run local OCR with `tesseract.js` in-worker.
5. Extract URL-like strings via regex.
6. Log OCR duration and memory observations.

No popup UI, storage, history, overlays, or backend integration are included in this phase.
