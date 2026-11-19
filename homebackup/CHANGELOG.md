# Changelog

## 0.3.3
- Fix: opening HomeBackup showed `{"detail":"Not Found"}`. Home Assistant's init system started the add-on without the image's environment, so the UI folder (and the Supervisor token) were missing. The add-on now starts through `with-contenv` and also finds the UI without the variable.
- Live progress uses polling (every 2 s during a run, 10 s otherwise) instead of a long-lived stream, which web proxies such as corporate gateways cut off (502 Bad Gateway).

## 0.3.2
- Fix: the add-on image now builds and runs on Home Assistant OS. The base image is declared in the Dockerfile (`build.yaml` is deprecated), the frontend builds on a glibc Node image, and the GNU `df`, util-linux `blkid`/`mount`/`umount` and `findutils` are installed (BusyBox's versions lack the options HomeBackup uses).
- Fix: the mount point under `/mnt/hb/` is created before mounting (runs and Test target).

## 0.3.1
- Pages slide left or right when you switch sections.
- Every tab-like choice (filters, Drive/Share, UUID/Label, SMB/NFS, language) uses the Kokonut swipe tabs.
- Dropdowns are restyled (shadcn/Radix Select in the HomeBackup look).
- New and edited targets open in a bottom sheet in the style of Kokonut's smooth drawer, with Test, Cancel and Save always visible.
- Schedules are picked with radio buttons (every hour, day, week or month, at a time); "Custom" still takes a cron expression.
- The source folder can be picked from a folder tree of the read-only folders Home Assistant shares with the add-on (/homeassistant, /backup, /media, /share). Files are shown; folders are picked.

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
