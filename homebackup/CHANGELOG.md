# Changelog

## 0.3.0
- **Real backups for Generic rsync items.** Run now and Dry run execute a plan of allow-listed commands (find, mount, free-space check, rsync, unmount), one run at a time from a queue, with live progress and Cancel. The target is always unmounted.
- Results come from exit codes: 0 Success, rsync 23/24 Warning, anything else Failed. Each run keeps its steps, output and log; history is stored in SQLite with retention (runs per item, days).
- New screens: Item editor (checks before saving, next 5 runs), Plan preview, Run details with a searchable log, Targets (detected drives, Test target), Settings (default HA scripts, retention, language, config file status, backup types with Refresh).
- Section tabs use Kokonut's swipe tabs.

## 0.2.0
- Items, targets and settings are stored in `homebackup.yaml` (hand-editable; an invalid file keeps the last good config). Share passwords go in the add-on's private `/data` as credentials files and are never shown or logged.
- Drives are detected (`blkid`) and target status is live; Test target mounts, writes a probe file, checks free space and unmounts.
- The add-on maps `/homeassistant`, `/backup`, `/media` and `/share` read-only and gets mount privileges.

## 0.1.0
- First preview: Dashboard and History on sample data, theme and language (English/Dutch) follow Home Assistant.
- Run now and Cancel use hold-to-confirm, with one run at a time and a queue.
