# Proposal

## Why

0.1 shows the whole UI on sample data, but nothing is stored or copied. 0.2 and 0.3 make HomeBackup do real work: keep items, targets and settings in a hand-editable config file, find and mount real drives and shares, and run a Generic rsync item by hand (real run or dry run), with logs and history. Scheduling and hooks follow in 0.4 and the Immich preset in 0.5 (see docs/ROADMAP.md).

## What Changes

- **0.2:** items, targets and settings are saved in `/config/homebackup.yaml` (the add-on's `addon_configs` folder), with share passwords kept separately in `/data`. Real block devices are detected, a target's status is live, and Test target mounts, writes a probe file and unmounts. The add-on gets mount privileges and the read-only HA folder mappings.
- **0.3:** a plan builder turns an item into ordered steps (core steps around the type's steps) made of allow-listed argument lists. A runner executes them one run at a time from a FIFO queue, streams rsync progress, maps exit codes to Success, Warning or Failed, always unmounts, supports cancel and dry run, writes a log per run, and keeps history in SQLite with retention.
- Backup types load from folders (`type.json` + `plan.py`). 0.3 ships the built-in Generic rsync type. User type folders and the Immich type come in 0.5.
- UI (finishing milestone 1b on the real API): Item editor, Plan preview, Run details, Targets and Settings, as designed.
- Demo mode (`HOMEBACKUP_DEMO=1`) seeds the design's sample data and simulates commands, for development and screenshots.

## Capabilities

### New Capabilities
- `config-store`: persistence and validation of items, targets and settings, plus secrets handling and config status.
- `target-access`: device detection, target status, mounting and unmounting, and Test target.
- `backup-engine`: plan building, the run queue, execution, results, cancel, dry run, logs and history retention.

### Modified Capabilities
- None.

## Impact

- Backend: new `config`, `system`, `plans`, `runner` and `history` modules. `store` becomes the façade over them. The fixtures become demo seed data.
- Add-on: `config.yaml` gains `map`, `privileged`, `full_access` and `homeassistant_api`. The Dockerfile installs rsync, util-linux, cifs-utils and nfs-utils. This lowers the security rating, as decided.
- New dependency: PyYAML.
