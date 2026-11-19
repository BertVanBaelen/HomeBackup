from datetime import UTC, datetime, timedelta

from homebackup.history import History
from homebackup.models import RunDetail

NOW = datetime(2026, 11, 10, 14, 0, tzinfo=UTC)


def run(i, item="it1", status="success", days_ago=0):
    return RunDetail(id=f"{item}-{i}", item_id=item, trigger="scheduled", status=status,
                     started=NOW - timedelta(days=days_ago, minutes=i))


def test_save_query_counts(tmp_path):
    h = History(tmp_path / "h.db", tmp_path / "logs")
    for i in range(5):
        h.save(run(i, status="failure" if i == 2 else "success"))
    h.save(run(0, item="it2"))
    rows, total, counts = h.query("it1", None, 3, 0)
    assert total == 5 and [r.id for r in rows] == ["it1-0", "it1-1", "it1-2"]
    assert counts["success"] == 4 and counts["failure"] == 1
    rows, total, _ = h.query(None, "failure", 10, 0)
    assert total == 1 and rows[0].id == "it1-2"


def test_retention_by_count_and_age_removes_logs(tmp_path):
    h = History(tmp_path / "h.db", tmp_path / "logs")
    for i in range(31):
        h.save(run(i))
    h.log("it1-30", "INFO", "old", NOW)
    h.save(run(99, item="it2", days_ago=100))
    removed = h.prune(keep_runs=30, keep_days=90, now=NOW)
    assert sorted(removed) == ["it1-30", "it2-99"]
    assert not (tmp_path / "logs" / "it1-30.log").exists()
    assert h.query("it1", None, 100, 0)[1] == 30


def test_log_roundtrip_and_interrupted(tmp_path):
    h = History(tmp_path / "h.db", tmp_path / "logs")
    h.log("r1", "CMD", "rsync -a x y", NOW)
    h.log("r1", "WARN", "file has vanished", NOW)
    assert [(l.level, l.msg) for l in h.read_log("r1")] == [("CMD", "rsync -a x y"), ("WARN", "file has vanished")]
    h.save(run(1, status="running"))
    h.mark_interrupted()
    assert h.get("it1-1").status == "failure" and h.get("it1-1").message.code == "interrupted"
