import pytest
from fastapi.testclient import TestClient

from homebackup.main import create_app
from homebackup.store import Store


@pytest.fixture
def client():
    return TestClient(create_app(store=Store(), extra_clients=("testclient",)))


def by_name(rows):
    return {r["name"]: r for r in rows}


def test_items_match_design(client):
    items = by_name(client.get("/api/v1/items").json())
    assert list(items) == ["ha-backups", "music-to-nas", "immich-full-monthly", "immich-recent", "ha-config"]
    hb = items["ha-backups"]
    assert hb["recent"][-2:] == ["failure", "failure"] and len(hb["recent"]) == 14
    assert hb["last_run"]["message"] == {"code": "target_not_found",
                                         "params": {"target": "usb-archive", "label": "HB-ARCHIVE"}}
    assert hb["next_run"].startswith("2026-11-15T04:00")
    assert items["music-to-nas"]["last_run"]["status"] == "running"
    assert items["immich-full-monthly"]["delete"] is True
    assert items["ha-config"]["source"] == "/homeassistant"


def test_status_running_and_attention(client):
    s = client.get("/api/v1/status").json()
    assert s["now"].startswith("2026-11-10T14:09") and s["time_zone"] == "Europe/Brussels"
    assert len(s["running"]) == 1 and 47 <= s["running"][0]["percent"] < 100
    att = s["attention"]
    assert [a["item_id"] for a in att] == ["it1"]  # ha-backups only; the monthly item is not overdue
    assert att[0]["days_since_success"] == 16  # "No successful run for 16 days" in the design
    assert att[0]["last_run"]["status"] == "failure"


def test_runs_filter_and_counts(client):
    page = client.get("/api/v1/runs", params={"status": "failure"}).json()
    assert {r["status"] for r in page["runs"]} == {"failure"}
    assert page["total"] == page["counts"]["failure"] == 2
    first = client.get("/api/v1/runs").json()
    assert len(first["runs"]) == 12 and first["runs"][0]["status"] == "running"
    assert first["total"] == 71


def test_runs_filter_by_item(client):
    page = client.get("/api/v1/runs", params={"item_id": "it5", "limit": 200}).json()
    assert page["total"] == 14 and {r["item_id"] for r in page["runs"]} == {"it5"}


def test_run_detail_and_404(client):
    rid = client.get("/api/v1/runs").json()["runs"][1]["id"]
    assert client.get(f"/api/v1/runs/{rid}").json()["id"] == rid
    assert client.get("/api/v1/runs/nope").status_code == 404


def test_targets_used_by_and_secret_hidden(client):
    t = by_name(client.get("/api/v1/targets").json())
    assert t["usb-stick"]["used_by"] == ["it3", "it4"]
    assert t["usb-archive"]["status"] == {"ok": False, "problem": {"code": "drive_not_found", "params": {}},
                                          "device": None, "free_bytes": None}
    assert "password" not in t["nas-backup"] and t["nas-backup"]["password_set"] is True


def test_invalid_query_rejected(client):
    assert client.get("/api/v1/runs", params={"status": "bogus"}).status_code == 422


def test_cancel_running_run(client):
    run_id = client.get("/api/v1/status").json()["running"][0]["run_id"]
    r = client.post(f"/api/v1/runs/{run_id}/cancel").json()
    assert r["status"] == "failure" and r["message"]["code"] == "cancelled"
    assert client.get("/api/v1/status").json()["running"] == []
    assert client.post(f"/api/v1/runs/{run_id}/cancel").status_code == 409


def test_run_now_queues_behind_active_run(client):
    s = client.post("/api/v1/items/it5/run").json()
    assert s["queue"] == ["it5"] and len(s["running"]) == 1
    assert client.post("/api/v1/items/it5/run").status_code == 409  # already queued
    assert client.post("/api/v1/items/it2/run").status_code == 409  # already running
    assert client.post("/api/v1/items/nope/run").status_code == 404


def test_cancel_starts_next_in_queue(client):
    client.post("/api/v1/items/it5/run")
    run_id = client.get("/api/v1/status").json()["running"][0]["run_id"]
    client.post(f"/api/v1/runs/{run_id}/cancel")
    s = client.get("/api/v1/status").json()
    assert s["queue"] == [] and s["running"][0]["run_id"].startswith("it5-")
    assert s["running"][0]["percent"] < 5
    items = by_name(client.get("/api/v1/items").json())
    assert items["ha-config"]["last_run"]["trigger"] == "manual"
