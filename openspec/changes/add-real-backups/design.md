# Design

## Context
See proposal.md. The 0.1 `Store` serves fixtures. The API contract and the frontend stay. This change swaps the data behind them for the real data and adds the endpoints the remaining screens need.

## Goals / Non-Goals
**Goals:** real persistence, a real run for Generic rsync items, and the five remaining screens.
**Non-Goals:** the scheduler, missed-run catch-up and hooks (0.4), the Immich type and user type folders (0.5), and HA entities (0.6).

## Decisions
- **Modules:** `config.py` (YAML + secrets), `system.py` (allow-listed exec, blkid, mount helpers), `plans.py` (core steps + type loader), `runner.py` (queue worker), `history.py` (SQLite + log files). `store.py` stays the single façade the API uses. No repository interfaces: one implementation of each.
- **Executor seam:** the runner gets an `exec(argv)` function that yields output lines and returns an exit code. Production uses `asyncio.create_subprocess_exec`. Demo mode and tests use a fake that simulates `blkid`, `mount`, `df` and rsync progress. This is the only abstraction, and tests need it.
- **Storage:** stdlib `sqlite3` with one `runs` table (steps as JSON) and plain log files at `/data/logs/<run id>.log`. Everything runs in one process, one run at a time, so there is no locking beyond SQLite's own.
- **Mounts:** `/mnt/hb/<target id>`. SMB uses `credentials=` pointing to a 0600 file in `/data/secrets/`. Drives are found with `blkid -U` or `blkid -L`.
- **rsync progress:** `--info=progress2 --outbuf=L` lines are parsed for bytes, percent, speed and ETA. File counts come from `--stats` at the end.
- **Types:** a folder with `type.json` (id, name, version) and `plan.py` exposing `steps(item, ctx) -> list[dict]`. The built-in `types/rsync/` copies `source/` → `<mount>/<target_path>/` with the target's flags, plus `--delete` when cleanup is on.
- **Demo mode:** `HOMEBACKUP_DEMO=1` seeds a temporary data folder from `fixtures.py`, uses the fake executor, and keeps the fixed sample clock. Without it, the add-on starts empty with real execution.

## Risks / Trade-offs
- [Mounting inside the container needs the kernel and permissions that HA OS provides] → Test on a real HA instance. DOCS.md lists the privileges.
- [The rsync progress format differs between versions] → The parser tolerates unknown lines, and progress is only used for display.
- [A YAML file edited by hand while the add-on writes to it] → Atomic replace. Check again reloads, and an invalid file keeps the last good config.
