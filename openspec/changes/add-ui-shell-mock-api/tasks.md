# Tasks

Milestone 1a (base version) covers groups 1–4 and 6.1. Milestone 1b (groups 5–7) is built on the real API in the add-real-backups change, so its fixture-only tasks here are superseded.


## 1. Repository and add-on scaffold

- [ ] 1.1 Add `repository.yaml`, root `README.md`, `.gitignore`, `.editorconfig`; verify the repo adds cleanly as a custom repository in HA (or `ha addons` lint passes)
- [ ] 1.2 Add `homebackup/config.yaml` (ingress, ingress_port 8099, panel_icon, arch amd64/aarch64), `build.yaml`, `DOCS.md`, `CHANGELOG.md`, `translations/{en,nl}.yaml`; verify with the HA add-on linter (`frenck/action-addon-linter` locally or in CI)
- [ ] 1.3 Render `icon.png` (128²) and `logo.png` (250×100); files done, store display not yet verified — and `logo.png` from the chosen mark; verify they show in the add-on store
- [ ] 1.4 Add multi-stage `Dockerfile` (node build → HA base-python); verify `docker build` succeeds and the container serves `/` on 8099
- [ ] 1.5 Add a GitHub Actions workflow that lints, tests and builds both parts; verify it passes on the branch

## 2. Backend skeleton and API contract

- [x] 2.1 Create the `homebackup` Python package (pyproject, uv, ruff, pytest); verify `pytest` runs green on an empty suite
- [ ] 2.2 Define Pydantic models for Item, Target, Run, Step, LogLine, Plan, Settings, Status; verify `api/v1/openapi.json` contains them
- [x] 2.3 Implement `Store` protocol and `FixtureStore` with the design's sample data; verify fixture tests assert 5 items, 3 targets and the History runs
- [ ] 2.4 Add routers for items, targets, runs, plans, settings, status with validation and in-memory mutations; verify per-router httpx tests, including a 422 for a bad cron
- [x] 2.5 Add the simulated SSE progress stream for the running fixture; verify a test reads at least two progress events
- [x] 2.6 Serve the built frontend with relative paths and SPA fallback; verify a test that `/` and assets load under an arbitrary prefix
- [ ] 2.7 Commit an OpenAPI snapshot with a test that fails when it is stale

- [x] 2.8 Run now with a one-at-a-time FIFO queue and Cancel (simulated progress); verify queue and cancel tests
- [x] 2.9 Ingress-only guard (403 for any client except 172.30.32.2 or localhost); verify test

## 3. Frontend foundation

- [x] 3.1 Scaffold Vite + React + TS, Tailwind, shadcn/ui (`components.json` with the `@kokonutui` registry), ESLint, Vitest; verify `npm run build` and `npm test` pass
- [ ] 3.2 Add design tokens as CSS variables for light and dark mapped to shadcn, plus bundled fonts; verify a token story/test renders both palettes with no outside requests
- [x] 3.3 Add HA bridge (theme + language from `parent.hass`, fallbacks) with tests for both paths
- [x] 3.4 Add i18next with `en`/`nl` catalogues and `Intl` helpers; verify a test switches language and the date formatting changes
- [ ] 3.5 Generate API types from the OpenAPI snapshot and add the TanStack Query client with relative URLs; verify a test against a mocked fetch
- [ ] 3.6 Build `AppHeader` with mark and section switcher, HashRouter routes for all pages, and responsive breakpoints; verify navigation tests and the phone layout hiding the wordmark
- [ ] 3.7 Add shared parts (`StatusPill`, `HoldConfirmButton` around Kokonut `hold-button`, `RunStrip`, `StepList`, `LogView`); verify unit tests, including that a short click on HoldConfirmButton does nothing

## 4. Dashboard

- [x] 4.1 Build the running-now card with live SSE progress and hold-to-cancel; verify the test sees progress update and cancel only after a hold
- [x] 4.2 Build the needs-attention card from the overdue threshold; verify the test with ha-backups at 16 days
- [x] 4.3 Build the items table (laptop) and stacked rows (tablet/phone) with run strips and accessible summaries; verify the tests at each width

## 5. Item editor and plan preview

- [ ] 5.1 Build the editor form (basics, type cards, source, target, Immich mode and window, thumbnails, cleanup with hold to enable, cron with preview of the next 5 runs, hooks); verify form tests, including the 422 error mapping
- [ ] 5.2 Build the side panel with checks, the conflict banner and the folder preview; verify the overlap warning test
- [ ] 5.3 Add create, save, delete (hold) and cancel flows; verify the dashboard reflects the saved changes
- [ ] 5.4 Build the plan preview (steps, origin badges, commands, allowed programs, flag glossary, result rules, Dry run, hold for Run now); verify the tests for the skipped step and phone collapse

## 6. Runs

- [x] 6.1 Build History with the item select, result filters with counts, rows at each width, and Load more; verify the filter tests
- [ ] 6.2 Build Run details with tiles, the explanation box, the steps with output (warning step open), and a log with filter and search; verify the search test

## 7. Targets and Settings

- [ ] 7.1 Build the target cards and the editor for drive or share, with presets, password handling, Test target, and delete that is held and blocked while in use; verify tests for the preset and in-use blocking
- [ ] 7.2 Build Settings (default hooks, overdue, retention, language, read-only time zone, log level, config status, save and cancel); verify the tests that the language switch applies and Cancel discards

## 8. Integration checks

- [ ] 8.1 Playwright smoke: open every page at 1280, 820 and 390 px in light and dark, and save screenshots; review them against the design canvas
- [ ] 8.2 Install the built add-on on a test HA instance, open it from the sidebar and the companion app, and confirm the theme and language follow HA with no outside requests in the network log

## Workflow follow-up

- Archive the change once 8.x is reviewed.
- Next change: `add-backup-engine` (ConfigStore, mount/rsync runner, Immich type, scheduler, hooks).
