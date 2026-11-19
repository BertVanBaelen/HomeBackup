"""In-memory store backed by fixtures. The engine phase replaces the data source, not this interface."""

import os
import time
from datetime import datetime, timedelta

from croniter import croniter

from . import fixtures as fx
from .models import Attention, ItemView, Message, Progress, RunSummary, Status, TargetView

SPEED = 38 * fx.MB  # simulated transfer speed


class Conflict(Exception):
    pass


class Store:
    def __init__(self, now: datetime | None = None):
        # HOMEBACKUP_FAKE_NOW=live uses the real clock; any ISO time pins it; default = the design's sample time
        env = os.environ.get("HOMEBACKUP_FAKE_NOW")
        self.now = now or (datetime.now(fx.TZ) if env == "live" else
                           datetime.fromisoformat(env) if env else fx.SAMPLE_NOW)
        self.items = {i.id: i for i in fx.ITEMS}
        self.targets = {t.id: t for t in fx.TARGETS}
        self.settings = fx.SETTINGS.model_copy()
        self.runs = fx.build_runs(self.now)
        self.queue: list[str] = []
        self._t0 = time.monotonic()
        # run id -> (monotonic start, percent at start, total bytes); one entry at most (one run at a time)
        self._active = {r.id: (self._t0, fx.RUNNING["percent"], fx.RUNNING["bytes_total"])
                        for r in self.runs if r.status == "running"}

    def clock(self) -> datetime:
        """Fixture time: the sample "now" plus the real time since start-up."""
        return self.now + timedelta(seconds=time.monotonic() - self._t0)

    def _pct(self, run_id: str) -> float:
        t0, start, total = self._active[run_id]
        # shortcut: simulated progress; real numbers come from rsync --info=progress2 in phase 3
        return min(100.0, start + (time.monotonic() - t0) * SPEED / total * 100)

    def _tick(self):
        for run_id in list(self._active):
            if self._pct(run_id) >= 100:
                r = self.run(run_id)
                r.status, r.ended, r.bytes, r.exit_code = "success", self.clock(), self._active[run_id][2], 0
                del self._active[run_id]
        if not self._active and self.queue:
            self._start(self.queue.pop(0))

    def _start(self, item_id: str):
        started = self.clock()
        run = RunSummary(id=f"{item_id}-{started:%Y%m%d%H%M%S}", item_id=item_id, trigger="manual",
                         status="running", started=started)
        self.runs.insert(0, run)
        self._active[run.id] = (time.monotonic(), 0.0, fx.SIZES[self.items[item_id].name][1])

    def run_now(self, item_id: str):
        if item_id not in self.items:
            raise KeyError(item_id)
        self._tick()
        busy = {self.run(r).item_id for r in self._active}
        if item_id in busy or item_id in self.queue:
            raise Conflict(item_id)
        self.queue.append(item_id)
        self._tick()

    def cancel(self, run_id: str) -> RunSummary:
        self._tick()
        r = self.run(run_id)
        if r is None:
            raise KeyError(run_id)
        if run_id not in self._active:
            raise Conflict(run_id)
        del self._active[run_id]
        r.status, r.ended, r.message = "failure", self.clock(), Message(code="cancelled")
        self._tick()
        return r

    def item_views(self) -> list[ItemView]:
        return [self._view(i) for i in self.items.values()]

    def _view(self, item) -> ItemView:
        runs = [r for r in self.runs if r.item_id == item.id]  # newest first
        finished = [r for r in runs if r.status != "running"]
        ok = next((r for r in finished if r.status in ("success", "warning")), None)
        return ItemView(
            **item.model_dump(),
            next_run=croniter(item.schedule, self.now).get_next(datetime) if item.enabled else None,
            last_run=runs[0] if runs else None,
            recent=[r.status for r in finished[:14]][::-1],
            last_success=ok.started if ok else None,
        )

    def progress(self) -> list[Progress]:
        self._tick()
        out = []
        for run_id, (_, _, total) in self._active.items():
            pct = self._pct(run_id)
            done = int(total * pct / 100)
            out.append(Progress(run_id=run_id, percent=round(pct, 1), bytes_done=done, bytes_total=total,
                                speed=SPEED, eta_s=(total - done) // SPEED))
        return out

    def status(self) -> Status:
        attention = []
        for v in self.item_views():
            if v.last_success is None or v.last_run is None:
                continue
            # overdue = the first scheduled run after the last good one is more than overdue_days late
            due = croniter(v.schedule, v.last_success).get_next(datetime)
            if (self.now - due).days >= self.settings.overdue_days:
                days = (self.now - v.last_success).days
                last = next(r for r in self.runs if r.item_id == v.id and r.status != "running")
                attention.append(Attention(item_id=v.id, days_since_success=days, last_run=last))
        running = self.progress()
        return Status(now=self.clock(), time_zone=self.settings.time_zone, queue=list(self.queue),
                      running=running, attention=attention)

    def query_runs(self, item: str | None, status: str | None, limit: int, offset: int):
        base = [r for r in self.runs if item in (None, r.item_id)]
        counts = {s: sum(r.status == s for r in base) for s in ("success", "warning", "failure", "running")}
        rows = [r for r in base if status in (None, r.status)]
        return rows[offset:offset + limit], len(rows), counts

    def run(self, run_id: str) -> RunSummary | None:
        return next((r for r in self.runs if r.id == run_id), None)

    def target_views(self) -> list[TargetView]:
        return [TargetView(**t.model_dump(), status=fx.TARGET_STATUS[t.id],
                           used_by=[i.id for i in self.items.values() if i.target_id == t.id])
                for t in self.targets.values()]
