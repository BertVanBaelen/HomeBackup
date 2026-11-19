"""Executes plans: one run at a time from a FIFO queue, always unmounting, with live rsync progress."""

import asyncio
import time
from collections import deque
from typing import TYPE_CHECKING

from .models import Message, Progress, RunDetail, StepResult
from .system import parse_progress, parse_stats

if TYPE_CHECKING:
    from .store import Store

WARNING_EXITS = {23, 24}  # rsync: partial transfer / files vanished while copying


class Conflict(Exception):
    pass


class Runner:
    def __init__(self, store: "Store"):
        self.s = store
        self.queue: deque[tuple[str, str]] = deque()  # (item id, trigger)
        self.current: RunDetail | None = None
        self.progress: Progress | None = None
        self._task: asyncio.Task | None = None
        self._cancellable = False
        self._wake: asyncio.Event | None = None

    # --- requests from the API -------------------------------------------------------------
    def request(self, item_id: str, trigger: str = "manual"):
        if item_id not in self.s.items:
            raise KeyError(item_id)
        busy = {i for i, _ in self.queue} | ({self.current.item_id} if self.current else set())
        if item_id in busy:
            raise Conflict(item_id)
        self.queue.append((item_id, trigger))
        if self._wake:
            self._wake.set()

    def cancel(self, run_id: str):
        if not self.current or self.current.id != run_id or not self._task:
            raise Conflict(run_id)
        if self._cancellable:  # once unmounting has started, let it finish
            self._task.cancel()

    # --- worker --------------------------------------------------------------------------
    async def worker(self):
        self._wake = asyncio.Event()
        while True:
            if not self.queue:
                self._wake.clear()
                await self._wake.wait()
                continue
            item_id, trigger = self.queue.popleft()
            if item_id not in self.s.items:  # deleted while queued
                continue
            self._task = asyncio.create_task(self.execute(item_id, trigger))
            await asyncio.gather(self._task, return_exceptions=True)
            self._task = None

    async def execute(self, item_id: str, trigger: str) -> RunDetail:
        s = self.s
        item = s.items[item_id]
        target = s.targets[item.target_id]
        now = s.clock()
        plan = s.plan_for(item, dry_run=trigger == "dry_run")
        run = RunDetail(id=f"{item.id}-{now:%Y%m%d%H%M%S}", item_id=item.id, trigger=trigger, status="running",
                        started=now, steps=[StepResult(**st.model_dump()) for st in plan.steps])
        self.current, self.progress = run, Progress(run_id=run.id, percent=0, bytes_done=0, bytes_total=0,
                                                    speed=0, eta_s=0)
        s.history.save(run)
        log = lambda level, msg: s.history.log(run.id, level, msg, s.clock())
        log("INFO", f"Run started · {trigger} · {item.name}")

        failure: Message | None = plan.error
        warn_exit = 0
        vanished = 0
        mounted = False
        device = None
        body, umount = (run.steps[:-1], run.steps[-1]) if run.steps else ([], None)
        self._cancellable = True
        try:
            for st in body:
                if failure or st.skipped:
                    continue
                argv = [device if a == "{device}" else a for a in st.argv]
                code, lines = await self._step(run, st, argv, log)
                prog = argv[0]
                if prog == "blkid":
                    if code != 0 or not lines:
                        failure = Message(code="target_not_found", params={"target": target.name, "label": target.ident or ""})
                    else:
                        device = lines[-1].strip()
                elif prog == "mount":
                    if code != 0:
                        failure = Message(code="mount_failed", params={"target": target.name, "exit_code": code})
                    else:
                        mounted = True
                elif prog == "df":
                    free = int(lines[-1]) if code == 0 and lines and lines[-1].strip().isdigit() else None
                    s.last_free[target.id] = free
                    if free is None:
                        failure = Message(code="step_failed", params={"step": st.n, "exit_code": code})
                    elif free < target.min_free_bytes:
                        failure = Message(code="not_enough_space", params={"free": free, "min": target.min_free_bytes})
                elif prog == "rsync":
                    stats = parse_stats(lines)
                    run.files = (run.files or 0) + stats.get("files", 0)
                    run.bytes = (run.bytes or 0) + stats.get("bytes", 0)
                    run.deleted = (run.deleted or 0) + stats.get("deleted", 0)
                    run.exit_code = code
                    vanished += sum("vanished" in line for line in lines)
                    if code in WARNING_EXITS:
                        warn_exit = code
                    elif code != 0:
                        failure = Message(code="rsync_failed", params={"exit_code": code})
                elif code != 0:
                    failure = Message(code="step_failed", params={"step": st.n, "exit_code": code})
        except asyncio.CancelledError:
            failure = Message(code="cancelled")
            log("WARN", "Cancelled by the user")
        finally:
            self._cancellable = False
            if umount and mounted:
                code, _ = await self._step(run, umount, umount.argv, log)
                if code != 0 and not failure:
                    failure = Message(code="umount_failed", params={"exit_code": code})

        run.ended = s.clock()
        if failure:
            run.status, run.message = "failure", failure
        elif warn_exit:
            run.status = "warning"
            run.message = Message(code="rsync_vanished" if warn_exit == 24 else "rsync_partial",
                                  params={"exit_code": warn_exit, "files": vanished})
        else:
            run.status = "success"
        log("ERROR" if failure else "WARN" if warn_exit else "INFO",
            f"Result: {run.status}" + (f" · {failure.code}" if failure else ""))
        s.history.save(run)
        s.history.prune(s.settings.keep_runs, s.settings.keep_days, s.clock())
        self.current = self.progress = None
        return run

    async def _step(self, run: RunDetail, st: StepResult, argv: list[str], log) -> tuple[int, list[str]]:
        lines: list[str] = []

        def on_line(line: str):
            if argv[0] == "rsync" and (p := parse_progress(line)):
                done, pct, speed, eta = p
                total = int(done * 100 / pct) if pct else 0
                self.progress = Progress(run_id=run.id, percent=pct, bytes_done=done, bytes_total=total,
                                         speed=speed, eta_s=eta)
                return
            for part in line.splitlines():
                lines.append(part)
                level = "WARN" if ("vanished" in part or "warning" in part.lower()) else "INFO"
                log(level, part)

        log("CMD", " ".join(argv))
        t0 = time.monotonic()
        try:
            code = await self.s.exec(argv, on_line)
        finally:
            st.duration_s = round(time.monotonic() - t0, 1)
            st.output = lines[-20:]
        st.exit_code = code
        log("INFO", f"exit {code} · {st.duration_s} s")
        self.s.history.save(run)
        return code, lines
