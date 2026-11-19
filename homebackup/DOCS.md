# HomeBackup

Back up Home Assistant, Immich and media folders to USB drives and network shares with rsync, and see every run from the HomeBackup panel in the sidebar.

## Version 0.1 (preview)

This version shows the full interface on **sample data**. Nothing is mounted or copied yet. The backup engine arrives in 0.3. See the [roadmap](https://github.com/BertVanBaelen/HomeBackup/blob/main/docs/ROADMAP.md).

## Access

HomeBackup opens only through Home Assistant (Ingress) and is visible to administrators only. It has no login of its own and publishes no ports, and only Home Assistant's Ingress proxy can reach it.

## Privacy

HomeBackup talks to nothing outside your Home Assistant host: no telemetry, and fonts and icons are bundled.
