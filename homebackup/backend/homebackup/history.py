"""Run history in SQLite (one row per run, details as JSON) and one log file per run."""

import sqlite3
from datetime import datetime, timedelta
from pathlib import Path

from .models import LogLine, Message, RunDetail, RunSummary

STATUSES = ("success", "warning", "failure", "running")


class History:
    def __init__(self, db: Path, logs: Path):
        db.parent.mkdir(parents=True, exist_ok=True)
        logs.mkdir(parents=True, exist_ok=True)
        self.logs = logs
        # one process, one run at a time: a shared connection is enough
        self.con = sqlite3.connect(db, check_same_thread=False)
        self.con.execute("""create table if not exists runs (
            id text primary key, item_id text not null, status text not null, trigger text not null,
            ts real not null, data text not null)""")
        self.con.execute("create index if not exists runs_item_ts on runs (item_id, ts)")
        self.con.commit()

    def save(self, run: RunDetail):
        self.con.execute("insert or replace into runs values (?, ?, ?, ?, ?, ?)",
                         (run.id, run.item_id, run.status, run.trigger, run.started.timestamp(), run.model_dump_json()))
        self.con.commit()

    def get(self, run_id: str) -> RunDetail | None:
        row = self.con.execute("select data from runs where id = ?", (run_id,)).fetchone()
        return RunDetail.model_validate_json(row[0]) if row else None

    def query(self, item_id: str | None, status: str | None, limit: int, offset: int):
        where, args = ("where item_id = ?", [item_id]) if item_id else ("", [])
        counts = dict.fromkeys(STATUSES, 0)
        counts.update(self.con.execute(f"select status, count(*) from runs {where} group by status", args).fetchall())
        if status:
            where, args = (f"{where} and status = ?" if where else "where status = ?"), [*args, status]
        total = self.con.execute(f"select count(*) from runs {where}", args).fetchone()[0]
        rows = self.con.execute(f"select data from runs {where} order by ts desc limit ? offset ?",
                                [*args, limit, offset]).fetchall()
        return [RunSummary.model_validate_json(r[0]) for r in rows], total, counts

    def for_item(self, item_id: str, limit: int = 50) -> list[RunSummary]:
        rows = self.con.execute("select data from runs where item_id = ? order by ts desc limit ?",
                                (item_id, limit)).fetchall()
        return [RunSummary.model_validate_json(r[0]) for r in rows]

    def mark_interrupted(self):
        """Runs left 'running' by a restart did not finish."""
        for (data,) in self.con.execute("select data from runs where status = 'running'").fetchall():
            run = RunDetail.model_validate_json(data)
            run.status, run.message = "failure", Message(code="interrupted")
            self.save(run)

    # --- logs ----------------------------------------------------------------------------
    def log(self, run_id: str, level: str, msg: str, t: datetime):
        with open(self.logs / f"{run_id}.log", "a", encoding="utf-8") as f:
            f.write(f"{t.isoformat()}\t{level}\t{msg.replace(chr(10), ' ')}\n")

    def read_log(self, run_id: str) -> list[LogLine]:
        p = self.logs / f"{run_id}.log"
        if not p.exists():
            return []
        out = []
        for line in p.read_text(encoding="utf-8").splitlines():
            t, level, msg = line.split("\t", 2)
            out.append(LogLine(t=datetime.fromisoformat(t), level=level, msg=msg))
        return out

    # --- retention -----------------------------------------------------------------------
    def prune(self, keep_runs: int, keep_days: int, now: datetime) -> list[str]:
        cutoff = (now - timedelta(days=keep_days)).timestamp()
        doomed = [r[0] for r in self.con.execute(
            """select id from (select id, ts, status,
                   row_number() over (partition by item_id order by ts desc) as n from runs)
               where status != 'running' and (n > ? or ts < ?)""", (keep_runs, cutoff)).fetchall()]
        for run_id in doomed:
            self.con.execute("delete from runs where id = ?", (run_id,))
            (self.logs / f"{run_id}.log").unlink(missing_ok=True)
        self.con.commit()
        return doomed
