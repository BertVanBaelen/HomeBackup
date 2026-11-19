# Design

## Context

The repository is empty. The UI comes from the HomeBackup — UI design canvas (7 screens, each drawn at laptop, tablet and phone widths, in dark and light). The canvas also draws placeholder Home Assistant chrome: the HA sidebar and the narrow-width HA top bar. In the real add-on, Home Assistant provides that chrome around the Ingress iframe, so we do **not** build it. We build only what is inside the content area: the HomeBackup header with its section switcher, and the pages.

Constraints: the add-on runs only behind HA Ingress (no auth of its own), makes no outside requests, and later runs commands as argument lists from an allow-list (see `openspec/config.yaml`). See proposal.md for scope.

## Goals / Non-Goals

**Goals:**
- A repository layout and build that the engine change can extend without moving files.
- Pixel-faithful screens built from shadcn/ui and Kokonut UI parts, themed with the design's tokens.
- An API contract (OpenAPI) that the frontend's types are generated from, so the fixtures can be swapped for the engine without frontend changes.

**Non-Goals:**
- Running anything on the host: mount, rsync, blkid, Supervisor calls, the scheduler and hooks.
- Persisting config to `/addon_config/homebackup.yaml` (the fixtures stay in memory).
- Building the placeholder HA sidebar or top bar from the canvas.

## Decisions

### Repository layout
```
repository.yaml                 HA add-on repository manifest
homebackup/                     the add-on
  config.yaml                   slug homebackup, ingress: true, ingress_port 8099, panel_icon, arch amd64/aarch64
  build.yaml  Dockerfile        multi-stage: node builds frontend → HA base-python image runs backend
  icon.png  logo.png            rendered from the chosen mark (Logo board, option B)
  DOCS.md  CHANGELOG.md  translations/{en,nl}.yaml
  backend/                      Python package `homebackup` (pyproject, uv)
    homebackup/api/  models/  fixtures/  main.py
    tests/
  frontend/                     Vite + React + TS
    src/app/  pages/  components/{ui,kokonutui,hb}/  lib/  i18n/  api/
openspec/  .claude/  .agents/   tooling
```
Alternative considered: separate top-level `backend/` and `frontend/`. Rejected because HA builds each add-on from its own folder, so the Docker build context must contain both.

### Backend: FastAPI + Pydantic v2, fixtures behind a repository interface
Routers depend on a `Store` protocol. In this change, `FixtureStore` holds the design's sample data in memory. The engine change adds a `ConfigStore` that implements the same protocol. FastAPI generates OpenAPI from the Pydantic models, so the contract and the code cannot drift. The SSE stream for live progress uses a plain `StreamingResponse`, with a simulated ticker for the running fixture. Alternative considered: aiohttp, which HA itself uses. Rejected because it lacks built-in OpenAPI.

### Ingress paths: relative everything + HashRouter
Vite builds with `base: './'`, and the API client uses relative URLs (`api/v1/...`). The router is a `HashRouter`, so the Ingress token path never matters and a reload of the frame keeps the current page. Alternative considered: BrowserRouter with the `X-Ingress-Path` header injected into `index.html`. It needs server rewriting for every route, and the HA panel resets the iframe `src` on a full reload anyway.

### Theme and language from Home Assistant
The Ingress iframe is same-origin with the HA frontend. The app reads `parent.document.querySelector('home-assistant').hass` for `themes.darkMode` and `language`, and re-reads them on an interval and on `visibilitychange`. When that fails (opened directly or in dev), it falls back to `prefers-color-scheme` and `navigator.language`. The language from Settings overrides HA's. Alternative considered: `prefers-color-scheme` only. Rejected because the HA theme can be set independently of the OS.

### Styling: Tailwind + shadcn/ui CSS variables carrying the design tokens
The design's token set (`bg, rail, panel, panel2, line, line2, field, fieldLine, text, soft, muted, accent, accentBg, accentFg, ok/warn/fail/run (+Bg, +Ic), bar*`) becomes CSS variables in `:root` (light) and `.dark`, mapped onto shadcn's semantic variables (`background`, `card`, `border`, `primary` = #166534, …). Status colors become Tailwind utilities (`text-ok`, `bg-warn-bg`). Fonts are bundled with `@fontsource` (Inter, Space Grotesk, JetBrains Mono): no Google Fonts requests.

### Components
- shadcn/ui: Button, Card, Input, Label, Select, Switch, ToggleGroup (the segmented pills), Badge, Collapsible (steps), Table, Tooltip, Sonner (toasts).
- Kokonut UI via the `@kokonutui` registry in `components.json`: `hold-button` for every hold-to-confirm action (delete item, delete target, turning on mirror, Cancel run, Run now). It is wrapped once as `HoldConfirmButton` so the hold time and labels are translated in one place. `uptime-card` (or its closest registry equivalent) for the 14-run strip if its API takes per-bar states. Otherwise `RunStrip` is a small local component styled the same way.
- HomeBackup parts in `components/hb/`: `AppHeader` (mark + section switcher), `StatusPill`, `RunStrip`, `StepList`, `LogView`, `CheckList`, `FolderList`, `TargetCard`, `CronPreview`.

### Data layer
TanStack Query for fetching and cache invalidation after mutations. Types are generated from the backend's OpenAPI with `openapi-typescript` and committed. A test fails when they are stale. Forms use react-hook-form + zod. Server-side 422 errors are mapped back onto fields.

### i18n
i18next with `en.json` and `nl.json`. Dates, times and numbers use `Intl`, with the HA time zone from the API. Cron descriptions use `cronstrue` (supports nl).

### Tests
- Backend: pytest + httpx `AsyncClient`, one test module per router, plus a contract test that the OpenAPI snapshot is current.
- Frontend: Vitest + Testing Library per page (renders fixtures, filters, hold-to-confirm ignores a short click), and a Playwright smoke run that opens every page at 1280, 820 and 390 px in light and dark, saving screenshots for visual review against the canvas.

## Risks / Trade-offs

- [Reading `parent.hass` is an undocumented HA internal] → Fall back to `prefers-color-scheme`, and keep the code in one module so it is easy to replace.
- [Kokonut components pull in `motion` and are copied in, not versioned] → Pin the copied files in git, and touch them only through the wrappers.
- [The fixtures can hide engine realities, such as slow mounts and partial data] → Model every fixture field after the engine's real outputs (exit codes, step origin, durations), and add latency to the dev server.
- [The hold-to-confirm buttons slow down power users] → Keep the hold short (about 1 s), and use it only for the five actions agreed.

## Migration Plan

Greenfield. Version 0.1.0 of the add-on ships the UI on fixtures. The engine change replaces `FixtureStore` and the simulated SSE ticker, with no change to the API contract.

## Open Questions

- Exact Kokonut component for the 14-run strip (`uptime-card` API fit): decide while building the Dashboard. The spec behavior does not change.
- `panel_icon`: `mdi:backup-restore` unless a closer MDI icon to the mark is preferred.
