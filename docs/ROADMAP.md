# HomeBackup roadmap

HomeBackup is a Home Assistant add-on that copies HA data, Immich and media to USB drives and network shares with rsync. It is opened from the HA sidebar via Ingress. Each phase ends in an installable add-on version and is planned as one or more OpenSpec changes (`openspec/changes/`).

| Phase | Version | Theme | OpenSpec change(s) |
|------:|---------|-------|--------------------|
| 0 | — | Project setup and tooling | (no change: repo setup) |
| 1 | 0.1.0 | UI on a fixture API ✅ | `add-ui-shell-mock-api` |
| 2 | 0.2.0 | Real config and targets ✅ | `add-real-backups` |
| 3 | 0.3.0 | Backup engine: plan and run ✅ | `add-real-backups` |
| 4 | 0.4.0 | Schedules, conflicts, hooks | `add-scheduler`, `add-hooks` |
| 5 | 0.5.0 | Immich preset | `add-immich-type` |
| 6 | 0.6.0 | HA integration and polish | `add-ha-entities`, `add-retention` |
| 7 | 1.0.0 | Release | `release-1-0` |

## Phase 0: Project setup ✅
- Empty GitHub repo cloned, OpenSpec initialised, graphify, superpowers and ponytail installed.
- UI design canvas reviewed. The first change is proposed and validated.

## Phase 1: UI on a fixture API (0.1.0) ✅
Goal: every screen of the design running inside HA, on realistic in-memory data.
- Add-on scaffold (config, Dockerfile, icon/logo), FastAPI backend with versioned API and fixtures, React app shell (header, sections, theme and language from HA).
- Screens: Dashboard, Item editor, Plan preview, Run details, History, Targets, Settings.
- Hold-to-confirm for destructive and consequential actions.
- Exit: installs on a test HA, all pages pass the screenshot review at 3 widths × 2 themes.

Milestone 1a, **base version**: scaffold, API, app shell, Dashboard and History. Milestone 1b: the remaining screens.

## Phase 2: Real config and targets (0.2.0) ✅
Goal: what the user edits is stored and real drives and shares are seen.
- `ConfigStore`: items, targets and settings in `/addon_config/homebackup.yaml` (hand-editable, validated, atomic writes, schema version).
- Secrets (share passwords) kept out of the YAML file, in the add-on's private `/data`.
- Target detection: list block devices (UUID, label, filesystem) via `blkid`/Supervisor hardware info. Mount/unmount helpers with a shared mount per target.
- Test target for real: find → mount rw → write probe → free space → unmount.
- Add-on privileges: `SYS_ADMIN` and device access for mounting (decided), documented in DOCS.md with the reason.

## Phase 3: Backup engine (0.3.0) ✅
Goal: a Generic rsync item runs for real, by hand.
- Plan builder: core steps (find, mount, free-space check, … unmount) around type steps. Every command is an argv list from the allow-list (mount, umount, blkid, df, rsync, find).
- Runner: one process at a time per target, live progress from `rsync --info=progress2`, exit code → Success/Warning/Failed, unmount always runs, cancel = SIGTERM then SIGKILL.
- Dry run (`rsync --dry-run`), run log files under `/data/logs`, run history in SQLite under `/data`.
- The dashboard, run details and history use real data. The sample data lives on as demo mode (`HOMEBACKUP_DEMO=1`) for development, screenshots and tests.
- Phases 2 and 3 were built together in one change (`add-real-backups`), and the remaining screens (milestone 1b) landed with them.

## Phase 4: Schedules, conflicts, hooks (0.4.0)
Goal: unattended operation.
- Cron scheduler in the HA time zone. Missed runs are caught up once, on start-up or when the target appears.
- One run at a time: a FIFO queue shown on the Dashboard. A duplicate request for an item already queued or running is refused.
- Overdue detection → the "Needs attention" card.
- Hooks: call HA scripts (`script.*`) through the HA API, with the run data as variables. Defaults come from Settings and items can override them. No shell scripts.

## Phase 5: Immich preset (0.5.0)
Goal: the Immich type as designed.
- Type folder `types/immich/` (`type.json` + `plan.py`) loaded through the same type interface as Generic rsync.
- User types: folders dropped into `/addon_configs/<slug>/types/` load next to the built-in ones. A Refresh button reloads them, and errors are shown per type. `TYPES_AUTHORING.md` tells an AI or a person how to write `type.json` and `plan.py` (contract, allowed programs, examples).
- Recent mode (window in months/days, per-user library folders with `-R`), Full mode, ordering (DB dumps first), thumbnails and encoded video optional.
- Overlap check between items that share a destination.

## Phase 6: HA integration and polish (0.6.0)
- HA entities per item (last result, last success, next run) for automations and dashboards.
- Retention cleanup (runs per item and days), log level, config "Check again".
- Accessibility audit (WCAG 2.2 AA), complete Dutch translation review, empty states and first-run onboarding.

## Phase 7: Release 1.0
- Multi-arch images (amd64, aarch64) built in CI and published to GHCR, with versioned add-on releases.
- DOCS.md, troubleshooting, and screenshots for the add-on store page.
- Upgrade path for the config schema from 0.x.

Decisions behind these phases: [DECISIONS.md](DECISIONS.md).

## Cross-cutting rules (every phase)
- Specs first (OpenSpec), tests with every task group (superpowers TDD), and the smallest change that fully works (ponytail).
- Nothing leaves the HA host: no telemetry, fonts bundled. Sources are read-only.
