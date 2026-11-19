"""Regenerates frontend/src/test/api-sample.json (real API responses in demo mode) and the OpenAPI file.

Run from homebackup/backend: .venv/Scripts/python scripts_sample.py
"""
import json
import tempfile
import time
from pathlib import Path

from fastapi.testclient import TestClient

from homebackup.main import create_app
from homebackup.store import Store

FE = Path(__file__).parent.parent / "frontend" / "src"


def client(**kw):
    return TestClient(create_app(store=Store.demo(Path(tempfile.mkdtemp()), **kw), extra_clients=("testclient",)))


def idle(c):
    while (s := c.get("/api/v1/status").json())["queue"] or s["running"]:
        time.sleep(0.05)


with client(rsync_seconds=0, start_running=False) as c:
    (FE / "api" / "openapi.json").write_text(json.dumps(c.app.openapi(), indent=1))
    c.post("/api/v1/items/it5/run")
    idle(c)
    manual = c.get("/api/v1/runs", params={"item_id": "it5"}).json()["runs"][0]["id"]
    c.post("/api/v1/items/it5/run?dry_run=true")
    idle(c)
    item = c.get("/api/v1/items/it5").json()
    out = {p: c.get(f"/api/v1/{p}").json() for p in [
        "targets", "settings", "config", "types", "scripts", "devices", "items/it5", "items/it4",
        "items/it5/plan", "items/it4/plan", f"runs/{manual}", "runs/it1-202611080400",
        "browse", "browse?path=%2Fmedia", "browse?path=%2Fmedia%2Fmusic", "browse?path=%2Fhomeassistant"]}
    out["POST items/check"] = c.post("/api/v1/items/check", json=item).json()
    out["POST plans"] = c.post("/api/v1/plans", json=item).json()
    out["POST targets/test"] = c.post("/api/v1/targets/test", json={
        "id": "tg1", "name": "usb-stick", "kind": "drive", "find_by": "uuid", "ident": "3E4F-91AB",
        "filesystem": "exfat", "rsync_flags": "-rt", "min_free_bytes": 0}).json()
    out["_manual_run_id"] = manual

with client(rsync_seconds=120) as c:  # music-to-nas is copying: the dashboard's running card
    while not ((s := c.get("/api/v1/status").json())["running"] and s["running"][0]["percent"] > 0):
        time.sleep(0.1)
    running = s["running"][0]["run_id"]
    for p in ["status", "items", "runs?limit=12", "runs?status=failure&limit=12", f"runs/{running}"]:
        out[p] = c.get(f"/api/v1/{p}").json()
    out["_running_run_id"] = running

(FE / "test" / "api-sample.json").write_text(json.dumps(out, indent=1))
print("sample keys:", sorted(out))
