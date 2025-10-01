# Repository Guidelines

## Project Structure & Module Organization
Primary UI code sits in `src/`: Alpine components (`components/`), form descriptors (`forms/`), styles (`css/`), and browser utilities (`js/`). Electron process logic and Drive adapters live in `electron/`. Vite drops its compiled bundle into `build/`, while electron-builder writes installers to `dist/`. Documentation and release notes reside in `docs/`; automation helpers live in `scripts/`. Keep transient artifacts and secrets out of git.

## Build, Test, and Development Commands
Install dependencies with `npm install`. Use `npm run dev` for the Vite server and `npm run electron` (or `npm run electron:dev` when you need `NODE_ENV=development`) to attach the desktop shell. `npm run build` compiles the SPA; `npm run build:win` produces a Windows installer and `npm run dist` targets every configured platform. `npm run release:public` and `npm run release:internal` hydrate configs through `scripts/prepare-release.js` before building. `npm run preview` serves the built bundle for smoke checks.

## Coding Style & Naming Conventions
Use 4-space indentation, single quotes, and trailing semicolons in JavaScript. Export classes in PascalCase (e.g., `PrintStampManager`) and utility functions in camelCase (e.g., `generateDocNumber`). Define Alpine component ids and HTML data attributes in kebab-case, and mirror filenames to the component or service they hold. Scope CSS selectors to component containers. Run `npm run build` before pushing; there is no automated formatter, so ensure spacing is consistent.

## Testing Guidelines
No automated suite exists yet, so rely on scenario-driven manual checks. After `npm run dev` + `npm run electron`, verify Drive authentication, form persistence via `FormStorageService`, print preview stamps, and attachment uploads. For installers, execute the artifact in `dist/` on a clean Windows environment to confirm auto-update, secure config decryption, and offline launch behaviour.

## Commit & Pull Request Guidelines
Follow the Conventional Commit pattern in the log (`feat:`, `refactor:`, `docs:`) with concise present-tense summaries. Split unrelated work into separate commits. PRs should include a problem statement, summary of changes, manual test notes, UI screenshots where relevant, and linked tracking issues. Request review from maintainers who own the touched modules and wait for at least one approval before merge.

## Security & Configuration Tips
Do not commit `.env` values; lean on `.env.example` for shape. Use helpers in `electron/secure-config.js` when rotating Drive credentials or encryption keys, and document any required manual steps in `docs/`. Remove sensitive logs before packaging a release.
## Communication Guidelines
Respond in Korean whenever contributors submit questions or issues in Korean to keep the experience consistent for native speakers.


