from datetime import datetime
from typing import Literal

from pydantic import BaseModel, Field, field_validator

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
    id: str = ""  # assigned by the server on create
    name: str = Field(min_length=1, max_length=64)
    enabled: bool = True
    type: str = "rsync"  # a loaded backup type id
    source: str = Field(pattern=r"^/")
    target_id: str
    target_path: str = Field(min_length=1)
    immich_mode: Literal["recent", "full"] | None = None
    window: int | None = None
    window_unit: Literal["months", "days"] | None = None
    include_thumbs: bool = False
    delete: bool = False
    schedule: str
    hooks: Hooks = Hooks()

    @field_validator("target_path")
    @classmethod
    def stays_inside_target(cls, v: str) -> str:
        if ".." in v.replace("\\", "/").split("/"):
            raise ValueError("may not contain '..'")
        return v


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


class Step(BaseModel):
    n: int
    origin: str  # "core" or the type id
    title: Message
    why: Message | None = None
    argv: list[str] = []  # empty = no command (skipped step)
    skipped: bool = False


class StepResult(Step):
    exit_code: int | None = None
    duration_s: float | None = None
    output: list[str] = []  # last lines


class RunDetail(RunSummary):
    steps: list[StepResult] = []


class LogLine(BaseModel):
    t: datetime
    level: Literal["INFO", "CMD", "WARN", "ERROR"]
    msg: str


class Plan(BaseModel):
    steps: list[Step]
    programs: list[str]
    error: Message | None = None


class Check(BaseModel):
    level: Literal["ok", "warning", "error"]
    message: Message


class Folder(BaseModel):
    path: str
    tag: Literal["full", "window", "skipped"]


class ItemCheck(BaseModel):
    checks: list[Check]
    schedule_valid: bool
    next_runs: list[datetime]
    folders: list[Folder]


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
    id: str = ""  # assigned by the server on create
    name: str = Field(min_length=1, max_length=64)
    kind: Literal["drive", "share"]
    filesystem: str | None = None  # drive: exfat|ext4|ntfs|vfat|auto
    find_by: Literal["uuid", "label"] | None = None
    ident: str | None = None
    protocol: Literal["smb", "nfs"] | None = None
    host: str | None = None
    share: str | None = None
    username: str | None = None
    mount_options: str = ""
    rsync_flags: str
    min_free_bytes: int = Field(ge=0)


class TargetIn(Target):
    password: str | None = None  # write-only: stored in /data/secrets, never returned


class TargetView(Target):
    password_set: bool
    status: TargetStatus
    used_by: list[str]  # item ids


class TargetTest(BaseModel):
    ok: bool
    problem: Message | None = None
    device: str | None = None
    free_bytes: int | None = None


class Device(BaseModel):
    device: str
    uuid: str | None = None
    label: str | None = None
    filesystem: str | None = None


class Settings(BaseModel):
    hook_success: str | None = None
    hook_warning: str | None = None
    hook_failure: str | None = None
    overdue_days: int = Field(7, ge=1)
    keep_runs: int = Field(30, ge=1)
    keep_days: int = Field(90, ge=1)
    language: Literal["auto", "en", "nl"] = "auto"  # auto = follow HA
    time_zone: str = "UTC"  # read-only: always HA's time zone
    log_level: Literal["info", "warning", "debug"] = "info"


class ConfigStatus(BaseModel):
    path: str
    valid: bool
    items: int
    targets: int
    error: str | None = None


class BackupType(BaseModel):
    id: str
    name: str
    version: str = "1"
    builtin: bool = True
    error: str | None = None
