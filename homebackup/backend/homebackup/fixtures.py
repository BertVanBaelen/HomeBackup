"""Sample data matching the HomeBackup UI design. Dates are relative to "now" so the UI reads naturally."""

from datetime import datetime, timedelta
from zoneinfo import ZoneInfo

from croniter import croniter

from .models import Hooks, Item, Message, RunSummary, Settings, Target, TargetStatus

SAMPLE_NOW = datetime(2026, 11, 10, 14, 9, tzinfo=ZoneInfo("Europe/Brussels"))  # as drawn in the design
GB = 1024**3
MB = 1024**2
TZ = ZoneInfo("Europe/Brussels")

ITEMS = [
    Item(id="it1", name="ha-backups", type="rsync", source="/backup", target_id="tg2", target_path="ha-backups",
         schedule="0 4 * * 0"),
    Item(id="it2", name="music-to-nas", type="rsync", source="/media/music", target_id="tg3", target_path="music",
         schedule="0 14 * * *"),
    Item(id="it3", name="immich-full-monthly", type="immich", source="/media/immich", target_id="tg1",
         target_path="immich", immich_mode="full", delete=True, schedule="0 5 1 * *"),
    Item(id="it4", name="immich-recent", type="immich", source="/media/immich", target_id="tg1", target_path="immich",
         immich_mode="recent", window=2, window_unit="months", schedule="0 3 * * *",
         hooks=Hooks(on_failure="script.backup_failed")),
    Item(id="it5", name="ha-config", type="rsync", source="/homeassistant", target_id="tg3", target_path="homeassistant",
         schedule="30 1 * * *"),
]

# Last 14 finished runs per item, oldest first: s = success, w = warning, f = failure.
HISTORY = {
    "ha-backups": "ssssssssssssff",
    "music-to-nas": "ssssswssssssss",
    "immich-full-monthly": "sssssswssssssw",
    "immich-recent": "ssssssssswssss",
    "ha-config": "ssssssssssssss",
}

SIZES = {  # (files, bytes) of a typical successful run
    "ha-backups": (4, 3 * GB),
    "music-to-nas": (312, int(3.4 * GB)),
    "immich-full-monthly": (2318, int(14.6 * GB)),
    "immich-recent": (1204, int(6.2 * GB)),
    "ha-config": (37, 18 * MB),
}

MESSAGES = {
    "f": {"ha-backups": Message(code="target_not_found", params={"target": "usb-archive", "label": "HB-ARCHIVE"})},
    "w": {"immich-full-monthly": Message(code="rsync_vanished", params={"exit_code": 24, "files": 3})},
}
DEFAULT_WARNING = Message(code="rsync_vanished", params={"exit_code": 24, "files": 1})

TARGETS = [
    Target(id="tg1", name="usb-stick", kind="drive", filesystem="exfat", find_by="uuid", ident="3E4F-91AB",
           rsync_flags="-rt --no-perms --no-owner --no-group --modify-window=2", min_free_bytes=10 * GB),
    Target(id="tg2", name="usb-archive", kind="drive", filesystem="ext4", find_by="label", ident="HB-ARCHIVE",
           rsync_flags="-a", min_free_bytes=10 * GB),
    Target(id="tg3", name="nas-backup", kind="share", protocol="smb", host="nas.local", share="backup", username="homebackup",
           password_set=True, rsync_flags="-rt --no-perms --no-owner --no-group", min_free_bytes=10 * GB),
]

TARGET_STATUS = {
    "tg1": TargetStatus(ok=True, device="/dev/sda2", free_bytes=412 * GB),
    "tg2": TargetStatus(ok=False, problem=Message(code="drive_not_found")),
    "tg3": TargetStatus(ok=True, free_bytes=int(3.1 * 1024 * GB)),
}

SETTINGS = Settings(hook_success="script.backup_ok", hook_warning="script.backup_warn",
                    hook_failure="script.backup_failed")

RUNNING = {"item": "music-to-nas", "minutes": 9, "bytes_total": int(45.6 * GB), "percent": 47.0}

DURATION = {"ha-backups": 300, "music-to-nas": 26 * 60, "immich-full-monthly": 107 * 60,
            "immich-recent": 18 * 60, "ha-config": 42}


def build_runs(now: datetime) -> list[RunSummary]:
    """All finished runs plus the one running now, newest first."""
    runs: list[RunSummary] = []
    started = now - timedelta(minutes=RUNNING["minutes"])
    for item in ITEMS:
        it = croniter(item.schedule, started - timedelta(minutes=1) if item.name == RUNNING["item"] else now)
        starts = [it.get_prev(datetime) for _ in range(14)][::-1]
        files, size = SIZES[item.name]
        for n, (start, code) in enumerate(zip(starts, HISTORY[item.name])):
            status = {"s": "success", "w": "warning", "f": "failure"}[code]
            failed = code == "f"
            runs.append(RunSummary(
                id=f"{item.id}-{start:%Y%m%d%H%M}", item_id=item.id,
                trigger="manual" if (item.name == "immich-recent" and n == 3) else "scheduled",
                status=status, started=start,
                ended=start if failed else start + timedelta(seconds=DURATION[item.name] * (0.9 + n / 70)),
                files=None if failed else files - 13 + n, bytes=None if failed else int(size * (0.94 + n / 200)),
                deleted=12 if (item.delete and not failed) else None,
                exit_code=None if failed else (24 if code == "w" else 0),
                message=MESSAGES.get(code, {}).get(item.name, DEFAULT_WARNING if code == "w" else None),
            ))
    rid = next(i.id for i in ITEMS if i.name == RUNNING["item"])
    runs.append(RunSummary(id=f"{rid}-{started:%Y%m%d%H%M}", item_id=rid,
                           trigger="scheduled", status="running", started=started))
    return sorted(runs, key=lambda r: r.started, reverse=True)
