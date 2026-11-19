"""The one façade the API talks to: config file, run history, runner, backup types and the host."""

import os
import tempfile
import time
import uuid
from collections.abc import Awaitable, Callable
from datetime import datetime, timedelta
from pathlib import Path
from zoneinfo import ZoneInfo

from croniter import croniter

from . import fixtures as fx
from . import ha
from .config import ConfigFile, new_id
from .history import History
from .models import (
    Attention,
    BackupType,
    Check,
    ConfigStatus,
    Device,
    Entry,
    Folder,
    Item,
    ItemCheck,
    ItemView,
    Listing,
    Message,
    Plan,
    RunDetail,
    Settings,
    Status,
    Target,
    TargetIn,
    TargetStatus,
    TargetTest,
    TargetView,
)
from .plans import BUILTIN_TYPES, build_plan, load_types, mountpoint
from .runner import Conflict, Runner
from .system import Exec, FakeExec, parse_blkid_export, port_open, real_exec

__all__ = ["Conflict", "InUse", "Store"]


class InUse(Exception):
    pass


class BadPath(Exception):
    pass


SOURCE_ROOTS = ("/homeassistant", "/backup", "/media", "/share")
BROWSE_LIMIT = 500


class Store:
    def __init__(self, data_dir: Path, config_path: Path, mount_root: Path, exec: Exec,
                 port_check: Callable[[str, int], Awaitable[bool]] = port_open,
                 clock: Callable[[], datetime] | None = None, time_zone: str | None = None,
                 scripts: Callable[[], list[str] | None] = ha.scripts, type_dirs: list[tuple[Path, bool]] | None = None):
        self.cfg = ConfigFile(config_path, data_dir / "secrets")
        self.cfg.load()
        self.history = History(data_dir / "history.db", data_dir / "logs")
        self.history.mark_interrupted()
        self.mount_root, self.exec, self.port_check, self.list_scripts = mount_root, exec, port_check, scripts
        self.tz = time_zone or ha.time_zone()
        self.clock = clock or (lambda: datetime.now(ZoneInfo(self.tz)))
        self.type_dirs = type_dirs or [(BUILTIN_TYPES, True)]
        self.types = load_types(self.type_dirs)
        self.last_free: dict[str, int | None] = {}
        # the read-only source folders HA maps into the add-on: visible path -> real path
        self.sources = {p: Path(p) for p in SOURCE_ROOTS}
        self.runner = Runner(self)

    # --- construction ----------------------------------------------------------------------
    @classmethod
    def from_env(cls) -> "Store":
        if os.environ.get("HOMEBACKUP_DEMO"):
            return cls.demo(Path(os.environ.get("HOMEBACKUP_DATA") or tempfile.mkdtemp(prefix="homebackup-demo-")))
        data = Path(os.environ.get("HOMEBACKUP_DATA", "/data"))
        return cls(data, Path(os.environ.get("HOMEBACKUP_CONFIG", "/config/homebackup.yaml")),
                   Path(os.environ.get("HOMEBACKUP_MOUNT_ROOT", "/mnt/hb")), real_exec)

    @classmethod
    def demo(cls, data: Path, rsync_seconds: float = 600, start_running: bool = True) -> "Store":
        """The design's sample data on a frozen clock, with simulated commands (no root, no Linux needed)."""
        t0 = time.monotonic()
        fake_now = os.environ.get("HOMEBACKUP_FAKE_NOW")
        base = datetime.fromisoformat(fake_now) if fake_now and fake_now != "live" else fx.SAMPLE_NOW
        clock = (lambda: datetime.now(fx.TZ)) if fake_now == "live" else (
            lambda: base + timedelta(seconds=time.monotonic() - t0))
        fresh = not (data / "homebackup.yaml").exists()
        store = cls(data, data / "homebackup.yaml", data / "mnt",
                    FakeExec(fx.DEVICES, rsync_seconds=rsync_seconds, rsync_bytes=int(45.6 * fx.GB)),
                    port_check=lambda host, port: _true(), clock=clock, time_zone="Europe/Brussels",
                    scripts=lambda: fx.SCRIPTS)
        if fresh:
            store.cfg.config.targets, store.cfg.config.items = list(fx.TARGETS), list(fx.ITEMS)
            store.cfg.config.settings = fx.SETTINGS.model_copy()
            store.cfg.save()
            store.cfg.set_password(fx.TARGETS[2], "demo")
            for r in fx.build_runs(base):
                store.history.save(RunDetail(**r.model_dump()))
        store.sources = {p: data / "fs" / p.strip("/") for p in SOURCE_ROOTS}
        if fresh:
            _demo_files(data / "fs")
        if start_running:
            store.runner.request(next(i.id for i in fx.ITEMS if i.name == fx.RUNNING["item"]), "scheduled")
        return store

    # --- config views ------------------------------------------------------------------------
    @property
    def items(self) -> dict[str, Item]:
        return {i.id: i for i in self.cfg.config.items}

    @property
    def targets(self) -> dict[str, Target]:
        return {t.id: t for t in self.cfg.config.targets}

    @property
    def settings(self) -> Settings:
        return self.cfg.config.settings.model_copy(update={"time_zone": self.tz})

    def config_status(self) -> ConfigStatus:
        c = self.cfg.config
        return ConfigStatus(path=str(self.cfg.path), valid=self.cfg.error is None, items=len(c.items),
                            targets=len(c.targets), error=self.cfg.error)

    def reload_config(self) -> ConfigStatus:
        self.cfg.load()
        return self.config_status()

    def save_settings(self, s: Settings) -> Settings:
        self.cfg.config.settings = s
        self.cfg.save()
        return self.settings

    # --- items ---------------------------------------------------------------------------------
    def save_item(self, item: Item, item_id: str | None = None) -> Item:
        if item.target_id not in self.targets:
            raise KeyError(item.target_id)
        items = self.cfg.config.items
        if item_id is None:
            item = item.model_copy(update={"id": new_id("it")})
            items.append(item)
        else:
            idx = next(i for i, x in enumerate(items) if x.id == item_id)  # StopIteration -> 404
            item = item.model_copy(update={"id": item_id})
            items[idx] = item
        self.cfg.save()
        return item

    def delete_item(self, item_id: str):
        if self.runner.current and self.runner.current.item_id == item_id:
            raise InUse(item_id)
        self.cfg.config.items = [i for i in self.cfg.config.items if i.id != item_id]
        self.cfg.save()

    def item_views(self) -> list[ItemView]:
        return [self._view(i) for i in self.items.values()]

    def _view(self, item: Item) -> ItemView:
        runs = self.history.for_item(item.id)  # newest first
        real = [r for r in runs if r.trigger != "dry_run"]  # dry runs say nothing about the backup
        finished = [r for r in real if r.status != "running"]
        ok = next((r for r in finished if r.status in ("success", "warning")), None)
        valid = croniter.is_valid(item.schedule)
        return ItemView(**item.model_dump(),
                        next_run=self._next_runs(item.schedule, 1)[0] if item.enabled and valid else None,
                        last_run=runs[0] if runs else None,
                        recent=[r.status for r in finished[:14]][::-1], last_success=ok.started if ok else None)

    def _next_runs(self, cron: str, n: int) -> list[datetime]:
        it = croniter(cron, self.clock().astimezone(ZoneInfo(self.tz)))
        return [it.get_next(datetime) for _ in range(n)]

    def check_item(self, item: Item) -> ItemCheck:
        checks: list[Check] = []
        valid = croniter.is_valid(item.schedule)
        if not valid:
            checks.append(Check(level="error", message=Message(code="cron_invalid")))
        target = self.targets.get(item.target_id)
        if target is None:
            checks.append(Check(level="error", message=Message(code="target_unknown")))
        else:
            if self.types.get(item.type) is None or self.types[item.type].steps is None:
                checks.append(Check(level="error", message=Message(code="type_not_installed", params={"type": item.type})))
            free = self.last_free.get(target.id)
            if free is not None:
                checks.append(Check(level="ok" if free >= target.min_free_bytes else "warning",
                                    message=Message(code="free_space", params={"free": free, "min": target.min_free_bytes})))
            for other in self.items.values():
                same = other.target_id == item.target_id and other.target_path.strip("/") == item.target_path.strip("/")
                if other.id != item.id and same:
                    checks.append(Check(level="warning", message=Message(code="overlap", params={"item": other.name})))
        return ItemCheck(checks=checks, schedule_valid=valid,
                         next_runs=self._next_runs(item.schedule, 5) if valid else [],
                         folders=[Folder(path=item.source.rstrip("/") + "/", tag="full")])

    def plan_for(self, item: Item, dry_run: bool = False) -> Plan:
        target = self.targets[item.target_id]
        return build_plan(item, target, self.types, self.mount_root, str(self.cfg.cred_path(target.id)), dry_run)

    # --- targets -------------------------------------------------------------------------------
    def save_target(self, t: TargetIn, target_id: str | None = None) -> Target:
        data = t.model_dump(exclude={"password", "id"})
        targets = self.cfg.config.targets
        if target_id is None:
            target = Target(**data, id=new_id("tg"))
            targets.append(target)
        else:
            idx = next(i for i, x in enumerate(targets) if x.id == target_id)
            target = Target(**data, id=target_id)
            targets[idx] = target
        self.cfg.save()
        if t.password:
            self.cfg.set_password(target, t.password)
        return target

    def delete_target(self, target_id: str):
        if any(i.target_id == target_id for i in self.items.values()):
            raise InUse(target_id)
        self.cfg.config.targets = [t for t in self.cfg.config.targets if t.id != target_id]
        self.cfg.save()
        self.cfg.delete_password(target_id)

    async def devices(self) -> list[Device]:
        lines: list[str] = []
        await self.exec(["blkid", "-o", "export"], lines.append)
        return parse_blkid_export("\n".join(lines))

    async def target_status(self, t: Target, devices: list[Device]) -> TargetStatus:
        if t.kind == "drive":
            dev = next((d for d in devices if (d.uuid if t.find_by == "uuid" else d.label) == t.ident), None)
            if dev is None:
                return TargetStatus(ok=False, problem=Message(code="drive_not_found"))
            return TargetStatus(ok=True, device=dev.device, free_bytes=self.last_free.get(t.id))
        if await self.port_check(t.host or "", 445 if t.protocol == "smb" else 2049):
            return TargetStatus(ok=True, free_bytes=self.last_free.get(t.id))
        return TargetStatus(ok=False, problem=Message(code="host_unreachable", params={"host": t.host or ""}))

    async def target_views(self) -> list[TargetView]:
        devices = await self.devices()
        return [TargetView(**t.model_dump(), password_set=self.cfg.has_password(t.id),
                           status=await self.target_status(t, devices),
                           used_by=[i.id for i in self.items.values() if i.target_id == t.id])
                for t in self.targets.values()]

    async def test_target(self, t: TargetIn) -> TargetTest:
        """Find, mount read/write, write a probe file, check free space, and always unmount."""
        # a typed (unsaved) password goes in a temporary credentials file, never over the saved one
        temp = bool(t.password) or not t.id
        probe = Target(**t.model_dump(exclude={"password", "id"}), id=f"test-{uuid.uuid4().hex[:6]}" if temp else t.id)
        if t.password:
            self.cfg.set_password(probe, t.password)
        mp = mountpoint(self.mount_root, probe)
        sink: list[str] = []
        device, mounted = None, False
        try:
            if probe.kind == "drive":
                code = await self.exec(["blkid", "-U" if probe.find_by == "uuid" else "-L", probe.ident or ""], sink.append)
                if code != 0 or not sink:
                    return TargetTest(ok=False, problem=Message(code="drive_not_found"))
                device = sink[-1].strip()
            dummy = Item(id="test", name="test", source="/", target_id=probe.id, target_path="x", schedule="0 0 * * *")
            mount = self.plan_for_target(dummy, probe).steps
            argv = next(s.argv for s in mount if s.argv[:1] == ["mount"])
            Path(mp).mkdir(parents=True, exist_ok=True)  # mount needs an existing mount point
            if await self.exec([device if a == "{device}" else a for a in argv], sink.append) != 0:
                return TargetTest(ok=False, device=device, problem=Message(code="mount_failed", params={"target": probe.name}))
            mounted = True
            try:
                p = Path(mp) / ".homebackup-probe"
                p.write_text("ok")
                p.unlink()
            except OSError:
                return TargetTest(ok=False, device=device, problem=Message(code="not_writable"))
            out: list[str] = []
            await self.exec(["df", "--output=avail", "-B1", mp], out.append)
            free = int(out[-1]) if out and out[-1].strip().isdigit() else None
            if t.id:
                self.last_free[t.id] = free
            return TargetTest(ok=True, device=device, free_bytes=free)
        finally:
            if mounted:
                await self.exec(["umount", mp], sink.append)
            if temp:
                self.cfg.delete_password(probe.id)

    def plan_for_target(self, item: Item, target: Target) -> Plan:
        return build_plan(item, target, self.types, self.mount_root, str(self.cfg.cred_path(target.id)))

    # --- source browser ------------------------------------------------------------------------
    def browse(self, path: str | None) -> Listing:
        """Read-only listing for the folder picker, limited to the mapped source folders."""
        if not path:
            return Listing(path=None, parent=None, entries=[Entry(name=p.strip("/"), path=p, dir=True)
                                                            for p, real in self.sources.items() if real.is_dir()])
        root = next((r for r in self.sources if path == r or path.startswith(r + "/")), None)
        if root is None or ".." in path.split("/"):
            raise BadPath(path)
        base = self.sources[root].resolve()
        real = (base / path[len(root):].lstrip("/")).resolve()
        if real != base and base not in real.parents:  # a symlink pointing out of the source folder
            raise BadPath(path)
        if not real.is_dir():
            raise KeyError(path)
        entries = []
        with os.scandir(real) as it:
            for e in it:
                is_dir = e.is_dir(follow_symlinks=False)
                entries.append(Entry(name=e.name, path=f"{path.rstrip('/')}/{e.name}", dir=is_dir,
                                     size=None if is_dir else _size(e)))
        entries.sort(key=lambda e: (not e.dir, e.name.lower()))
        parent = None if path == root else path.rsplit("/", 1)[0] or None
        return Listing(path=path, parent=parent, entries=entries[:BROWSE_LIMIT], truncated=len(entries) > BROWSE_LIMIT)

    # --- runs and status -------------------------------------------------------------------------
    def status(self) -> Status:
        now = self.clock()
        attention = []
        for v in self.item_views():
            if not v.enabled or v.last_success is None or not croniter.is_valid(v.schedule):
                continue
            # overdue = the first scheduled run after the last good one is more than overdue_days late
            due = croniter(v.schedule, v.last_success).get_next(datetime)
            if (now - due).days >= self.settings.overdue_days:
                last = next(r for r in self.history.for_item(v.id) if r.status != "running" and r.trigger != "dry_run")
                attention.append(Attention(item_id=v.id, days_since_success=(now - v.last_success).days, last_run=last))
        r = self.runner
        return Status(now=now, time_zone=self.tz, queue=[i for i, _ in r.queue],
                      running=[r.progress] if r.current and r.progress else [], attention=attention)

    def backup_types(self) -> list[BackupType]:
        return [t.meta for t in self.types.values()]

    def refresh_types(self) -> list[BackupType]:
        self.types = load_types(self.type_dirs)
        return self.backup_types()

    def scripts(self) -> list[str]:
        return self.list_scripts() or []


async def _true() -> bool:
    return True


def _size(e: os.DirEntry) -> int | None:
    try:
        return e.stat(follow_symlinks=False).st_size
    except OSError:
        return None


def _demo_files(fs: Path):
    tree = {
        "homeassistant": ["configuration.yaml", "automations.yaml", "secrets.yaml", "custom_components/hacs/manifest.json",
                          "blueprints/automation/motion_light.yaml", ".storage/core.config_entries"],
        "backup": ["a1b2c3d4.tar", "e5f6a7b8.tar"],
        "media": ["music/Daft Punk/Discovery/01 One More Time.flac", "music/Nina Simone/Pastel Blues/01 Be My Husband.flac",
                  "immich/library/admin/2026/11/IMG_2214.HEIC", "immich/library/family/2026/10/PXL_20261031.jpg",
                  "immich/upload/.immich", "immich/backups/immich-db-backup-1731200000.sql.gz", "immich/profile/admin.jpg"],
        "share": ["documents/taxes-2025.pdf", "scans/receipt-0412.pdf"],
    }
    for root, files in tree.items():
        for f in files:
            p = fs / root / f
            p.parent.mkdir(parents=True, exist_ok=True)
            p.write_text("demo " * (len(f) * 37))
