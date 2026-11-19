# HomeBackup

Back up Home Assistant, Immich and media folders to USB drives and network shares with rsync, and see every run from the HomeBackup panel in the sidebar.

## Version 0.3

- Items, targets and settings are kept in `homebackup.yaml` in this add-on's config folder (`/addon_configs/<slug>/`). You can edit it by hand; use **Settings › Check again** afterwards.
- Generic rsync items run for real when you start them (**Run now** or **Dry run**). Scheduling and hooks arrive in 0.4, and the Immich preset in 0.5. See the [roadmap](https://github.com/BertVanBaelen/HomeBackup/blob/main/docs/ROADMAP.md).
- Sources are mounted read-only: `/homeassistant`, `/backup`, `/media`, `/share`.

## Why the add-on needs privileges

HomeBackup mounts your USB drives (found by UUID or label) and SMB/NFS shares itself, under `/mnt/hb/` inside the add-on. Mounting needs `SYS_ADMIN`, access to the block devices (`full_access`, `udev`), and AppArmor turned off. This lowers the add-on's security rating. HomeBackup only runs `mount`, `umount`, `blkid`, `df`, `rsync` and `find`, never through a shell, and it never writes to a source. Share passwords are stored in the add-on's private `/data` folder, never in `homebackup.yaml` or a log.

## Access

HomeBackup opens only through Home Assistant (Ingress) and is visible to administrators only. It has no login of its own and publishes no ports, and only Home Assistant's Ingress proxy can reach it.

## Privacy

HomeBackup talks to nothing outside your Home Assistant host: no telemetry, and fonts and icons are bundled.
