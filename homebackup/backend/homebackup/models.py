from datetime import datetime
from typing import Literal

from pydantic import BaseModel

Result = Literal["success", "warning", "failure", "running"]
Trigger = Literal["scheduled", "manual", "dry_run"]


class Hooks(BaseModel):
    # None = use the default from Settings, "" = no hook
    on_success: str | None = None
    on_warning: str | None = None
    on_failure: str | None = None


class Message(BaseModel):
    """Language-neutral message: the UI translates `code` and fills in `params`."""
    code: str
    params: dict[str, str | int] = {}


class Item(BaseModel):
    id: str
    name: str
    enabled: bool = True
    type: Literal["rsync", "immich"]
    source: str
    target_id: str
    target_path: str
    immich_mode: Literal["recent", "full"] | None = None
    window: int | None = None
    window_unit: Literal["months", "days"] | None = None
    include_thumbs: bool = False
    delete: bool = False
    schedule: str
    hooks: Hooks = Hooks()


class RunSummary(BaseModel):
    id: str
    item_id: str
    trigger: Trigger
    status: Result
    started: datetime
    ended: datetime | None = None
    files: int | None = None
    bytes: int | None = None
    deleted: int | None = None
    exit_code: int | None = None
    message: Message | None = None


class ItemView(Item):
    next_run: datetime | None
    last_run: RunSummary | None
    recent: list[Result]  # oldest first, at most 14
    last_success: datetime | None


class Progress(BaseModel):
    run_id: str
    percent: float
    bytes_done: int
    bytes_total: int
    speed: int  # bytes per second
    eta_s: int


class Attention(BaseModel):
    item_id: str
    days_since_success: int
    last_run: RunSummary


class Status(BaseModel):
    now: datetime  # server clock; the UI computes Today/Tomorrow from this, not the browser clock
    time_zone: str
    queue: list[str]  # item ids waiting, first runs next
    running: list[Progress]
    attention: list[Attention]


class TargetStatus(BaseModel):
    ok: bool
    problem: Message | None = None
    device: str | None = None
    free_bytes: int | None = None


class Target(BaseModel):
    id: str
    name: str
    kind: Literal["drive", "share"]
    filesystem: str | None = None  # drive: exfat|ext4|ntfs|vfat|auto
    find_by: Literal["uuid", "label"] | None = None
    ident: str | None = None
    protocol: Literal["smb", "nfs"] | None = None
    host: str | None = None
    share: str | None = None
    username: str | None = None
    password_set: bool = False
    mount_options: str = ""
    rsync_flags: str
    min_free_bytes: int


class TargetView(Target):
    status: TargetStatus
    used_by: list[str]  # item ids


class Settings(BaseModel):
    hook_success: str | None = None
    hook_warning: str | None = None
    hook_failure: str | None = None
    overdue_days: int = 7
    keep_runs: int = 30
    keep_days: int = 90
    language: Literal["auto", "en", "nl"] = "auto"  # auto = follow HA
    time_zone: str = "Europe/Brussels"
    log_level: Literal["info", "warning", "debug"] = "info"
