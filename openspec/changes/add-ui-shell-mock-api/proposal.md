# Proposal

## Why

HomeBackup has a finished UI design (HomeBackup — UI canvas: Dashboard, Item editor, Plan preview, Run details, History, Targets, Settings, Logo), but the repository is empty. We want the whole add-on UI running inside Home Assistant first, on a typed API that serves realistic fixture data. Then the screens, the flows and the API contract can be reviewed before the real backup engine (scheduler, mount, rsync, Immich preset, hooks) is built behind the same contract.

## What Changes

- Scaffold the repository as a Home Assistant add-on repository: `repository.yaml` plus a `homebackup/` add-on folder (config, Dockerfile, icon and logo from the chosen mark).
- Add a Python 3.12 backend (FastAPI) that serves the built frontend and a versioned JSON API (`/api/v1/...`) under the HA Ingress base path. The API reads in-memory fixtures that match the design's sample data.
- Add a React + TypeScript + Vite frontend using Tailwind, shadcn/ui and the Kokonut UI registry, with the design's tokens (green palette, Inter / Space Grotesk / JetBrains Mono, bundled locally).
- Implement all seven screens as designed, responsive at laptop, tablet and phone widths:
  - Dashboard: running-now card, needs-attention card, and the items table with the last 14 runs.
  - Item editor: Generic rsync and Immich preset types, schedule preview, hooks, pre-save checks.
  - Plan preview: the step list with commands, the rsync flag glossary and the result rules.
  - Run details: result tiles, steps with output, filterable log.
  - History: run list with item and result filters.
  - Targets: drive and network-share cards with an editor.
  - Settings: default hooks, retention, language, logging, config-file status.
- Theme follows Home Assistant light or dark mode. English and Dutch ship from day one.
- Hold-to-confirm (Kokonut `hold-button`) guards destructive or consequential actions: delete item, delete target, enabling mirror/delete mode, cancelling a running backup, and Run now.
- Mutating API calls (save, run, cancel, delete) are accepted and reflected in the in-memory fixtures for the session, but nothing is mounted or copied.

## Capabilities

### New Capabilities
- `addon-shell`: add-on packaging, Ingress hosting without own auth, section navigation, theme following HA, EN/NL language, responsive layout.
- `api-contract`: the versioned JSON API for items, targets, runs, plans and settings, and its fixture-backed behaviour in this phase.
- `backup-items`: viewing, creating, editing, deleting and previewing backup items (dashboard list, item editor, plan preview).
- `backup-runs`: live run status, run details with steps and log, run history, and starting or cancelling runs.
- `backup-targets`: listing, editing, testing and deleting drive and network-share targets.
- `addon-settings`: global defaults (hooks, overdue threshold, retention, language, log level) and config-file status.

### Modified Capabilities
- None (greenfield).

## Impact

- New code: `homebackup/` (add-on), `homebackup/backend/` (Python), `homebackup/frontend/` (React).
- New dependencies: FastAPI, Uvicorn, Pydantic; React, Vite, Tailwind, shadcn/ui, Kokonut UI components, lucide-react, motion, react-router, i18next.
- No real system access in this change. Mount, rsync and HA Supervisor calls arrive with the engine change that follows.
- Out of scope: the backup engine, the scheduler, real hook calls, real config-file persistence, and HA notifications.
