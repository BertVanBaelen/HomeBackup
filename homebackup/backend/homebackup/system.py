"""Talking to the host: allow-listed commands (never through a shell) and parsers for their output."""

import asyncio
import re
from collections.abc import Callable
from pathlib import Path
from typing import Protocol

from .models import Device

ALLOWED = ("mount", "umount", "blkid", "df", "rsync", "find")


class NotAllowed(Exception):
    pass


class Exec(Protocol):
    async def __call__(self, argv: list[str], on_line: Callable[[str], None]) -> int: ...


def check_argv(argv: list[str]):
    if not argv or argv[0] not in ALLOWED:
        raise NotAllowed(argv[0] if argv else "")


async def real_exec(argv: list[str], on_line: Callable[[str], None]) -> int:
    """Runs one allow-listed program; cancelling the awaiting task terminates it."""
    check_argv(argv)
    proc = await asyncio.create_subprocess_exec(
        *argv, stdout=asyncio.subprocess.PIPE, stderr=asyncio.subprocess.STDOUT)
    try:
        assert proc.stdout
        buf = b""
        while chunk := await proc.stdout.read(4096):
            # rsync --info=progress2 ends progress updates with \r, not \n
            buf += chunk
            *lines, buf = re.split(rb"[\r\n]", buf)
            for raw in lines:
                if raw.strip():
                    on_line(raw.decode(errors="replace"))
        if buf.strip():
            on_line(buf.decode(errors="replace"))
        return await proc.wait()
    except asyncio.CancelledError:
        proc.terminate()
        try:
            await asyncio.wait_for(proc.wait(), 10)
        except TimeoutError:
            proc.kill()
        raise


# --- parsers -----------------------------------------------------------------------------

def parse_blkid_export(text: str) -> list[Device]:
    """`blkid -o export`: KEY=value blocks separated by blank lines."""
    devices = []
    for block in re.split(r"\n\s*\n", text.strip()):
        kv = dict(line.split("=", 1) for line in block.splitlines() if "=" in line)
        if "DEVNAME" in kv:
            devices.append(Device(device=kv["DEVNAME"], uuid=kv.get("UUID"), label=kv.get("LABEL"),
                                  filesystem=kv.get("TYPE")))
    return devices


_UNITS = {"": 1, "B": 1, "K": 1024, "M": 1024**2, "G": 1024**3, "T": 1024**4}
PROGRESS = re.compile(r"^\s*([\d,.]+)\s+(\d+)%\s+([\d.]+)([KMGT]?)B/s\s+(\d+):(\d+):(\d+)")


def parse_progress(line: str) -> tuple[int, float, int, int] | None:
    """`--info=progress2` line -> (bytes done, percent, bytes/s, eta seconds)."""
    m = PROGRESS.match(line)
    if not m:
        return None
    done = int(m[1].replace(",", "").replace(".", ""))
    speed = int(float(m[3]) * _UNITS[m[4]])
    return done, float(m[2]), speed, int(m[5]) * 3600 + int(m[6]) * 60 + int(m[7])


def parse_stats(lines: list[str]) -> dict[str, int]:
    """Counts from `rsync --stats`."""
    want = {"files": r"Number of regular files transferred: ([\d,.]+)",
            "bytes": r"Total transferred file size: ([\d,.]+)",
            "deleted": r"Number of deleted files: ([\d,.]+)"}
    out = {}
    for key, rx in want.items():
        for line in lines:
            if m := re.search(rx, line):
                out[key] = int(re.sub(r"[,.]", "", m[1]))
    return out


async def port_open(host: str, port: int, timeout: float = 2) -> bool:
    try:
        _, w = await asyncio.wait_for(asyncio.open_connection(host, port), timeout)
        w.close()
        return True
    except (OSError, TimeoutError):
        return False


# --- demo / test executor ------------------------------------------------------------------

class FakeExec:
    """Simulates the allow-listed programs, for demo mode and tests (no root, no Linux needed)."""

    def __init__(self, devices: list[Device], free: int = 412 * 1024**3, rsync_seconds: float = 0,
                 rsync_bytes: int = 6 * 1024**3, exit_codes: dict[str, int] | None = None):
        self.devices, self.free = devices, free
        self.rsync_seconds, self.rsync_bytes = rsync_seconds, rsync_bytes
        self.exit_codes = exit_codes or {}
        self.calls: list[list[str]] = []

    async def __call__(self, argv: list[str], on_line: Callable[[str], None]) -> int:
        check_argv(argv)
        self.calls.append(argv)
        prog = argv[0]
        if prog in self.exit_codes:
            return self.exit_codes[prog]
        if prog == "blkid":
            if argv[1:3] == ["-o", "export"]:
                for d in self.devices:
                    on_line(f"DEVNAME={d.device}\nUUID={d.uuid or ''}\nLABEL={d.label or ''}\nTYPE={d.filesystem or ''}\n")
                return 0
            key = {"-U": "uuid", "-L": "label"}[argv[1]]
            dev = next((d for d in self.devices if getattr(d, key) == argv[2]), None)
            if dev:
                on_line(dev.device)
            return 0 if dev else 2
        if prog == "mount":
            Path(argv[-1]).mkdir(parents=True, exist_ok=True)
            return 0
        if prog == "df":
            on_line("Avail")
            on_line(str(self.free))
            return 0
        if prog == "rsync":
            steps = 20
            for i in range(1, steps + 1):
                if self.rsync_seconds:
                    await asyncio.sleep(self.rsync_seconds / steps)
                done = self.rsync_bytes * i // steps
                left = int(self.rsync_seconds * (steps - i) / steps)
                on_line(f"{done:,} {100 * i // steps}%  38.00MB/s  0:{left // 60:02d}:{left % 60:02d}")
            on_line("Number of regular files transferred: 1,204")
            on_line(f"Total transferred file size: {self.rsync_bytes:,} bytes")
            on_line("Number of deleted files: 0")
            return 0
        return 0
