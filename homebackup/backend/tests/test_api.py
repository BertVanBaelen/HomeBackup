import time


def by_name(rows):
    return {r["name"]: r for r in rows}


def wait_idle(client, timeout=5):
    end = time.time() + timeout
    while time.time() < end:
        s = client.get("/api/v1/status").json()
        if not s["running"] and not s["queue"]:
            return s
        time.sleep(0.05)
    raise AssertionError("run did not finish")


def test_items_match_design(client):
    items = by_name(client.get("/api/v1/items").json())
    assert list(items) == ["ha-backups", "music-to-nas", "immich-full-monthly", "immich-recent", "ha-config"]
    hb = items["ha-backups"]
    assert hb["recent"][-2:] == ["failure", "failure"] and len(hb["recent"]) == 14
    assert hb["last_run"]["message"] == {"code": "target_not_found",
                                         "params": {"target": "usb-archive", "label": "HB-ARCHIVE"}}
    assert hb["next_run"].startswith("2026-11-15T04:00")
    assert items["immich-full-monthly"]["delete"] is True


def test_status_attention_as_designed(client):
    s = client.get("/api/v1/status").json()
    assert s["now"].startswith("2026-11-10T14:09") and s["time_zone"] == "Europe/Brussels"
    assert [a["item_id"] for a in s["attention"]] == ["it1"]  # the monthly item is not overdue
    assert s["attention"][0]["days_since_success"] == 16


def test_run_now_then_detail_with_steps_and_log(client):
    client.post("/api/v1/items/it5/run")
    wait_idle(client)
    rid = client.get("/api/v1/runs", params={"item_id": "it5"}).json()["runs"][0]["id"]
    detail = client.get(f"/api/v1/runs/{rid}").json()
    assert detail["run"]["status"] == "success" and detail["run"]["trigger"] == "manual"
    assert [s["argv"][0] for s in detail["run"]["steps"]] == ["mount", "df", "rsync", "umount"]
    assert any(line["level"] == "CMD" for line in detail["log"])


def test_queue_conflicts_and_404(client):
    assert client.post("/api/v1/items/nope/run").status_code == 404
    client.post("/api/v1/items/it5/run")
    assert client.post("/api/v1/items/it5/run").status_code in (200, 409)  # 409 while still queued or running
    wait_idle(client)
    assert client.post("/api/v1/runs/nope/cancel").status_code == 409


def test_runs_filter_and_counts(client):
    page = client.get("/api/v1/runs", params={"status": "failure"}).json()
    assert {r["status"] for r in page["runs"]} == {"failure"} and page["total"] == 2
    assert client.get("/api/v1/runs").json()["total"] == 70


def test_item_crud_and_check(client):
    new = {"name": "photos", "source": "/media/photos", "target_id": "tg1", "target_path": "photos",
           "schedule": "0 2 * * *"}
    created = client.post("/api/v1/items", json=new).json()
    assert created["id"].startswith("it_")
    client.put(f"/api/v1/items/{created['id']}", json={**created, "name": "pictures"})
    assert client.get(f"/api/v1/items/{created['id']}").json()["name"] == "pictures"
    check = client.post("/api/v1/items/check", json={**new, "target_path": "immich"}).json()
    assert check["schedule_valid"] and len(check["next_runs"]) == 5
    assert {c["message"]["params"].get("item") for c in check["checks"]} >= {"immich-full-monthly", "immich-recent"}
    bad = client.post("/api/v1/items/check", json={**new, "schedule": "nope"}).json()
    assert not bad["schedule_valid"] and bad["checks"][0]["message"]["code"] == "cron_invalid"
    assert client.post("/api/v1/items", json={**new, "source": "relative"}).status_code == 422
    assert client.delete(f"/api/v1/items/{created['id']}").status_code == 204


def test_plan_for_saved_and_unsaved(client):
    plan = client.get("/api/v1/items/it5/plan").json()
    assert [s["origin"] for s in plan["steps"]] == ["core", "core", "rsync", "core"]
    assert plan["programs"] == ["mount", "umount", "blkid", "df", "rsync", "find"]
    immich = client.get("/api/v1/items/it4/plan").json()
    assert immich["error"]["code"] == "type_not_installed"  # the Immich type arrives in 0.5
    unsaved = client.post("/api/v1/plans", params={"dry_run": True}, json={
        "name": "x", "source": "/share", "target_id": "tg1", "target_path": "x", "schedule": "0 1 * * *"}).json()
    assert unsaved["steps"][0]["argv"] == ["blkid", "-U", "3E4F-91AB"] and "--dry-run" in unsaved["steps"][3]["argv"]


def test_targets_status_used_by_and_secret_hidden(client):
    t = by_name(client.get("/api/v1/targets").json())
    assert t["usb-stick"]["status"]["ok"] and t["usb-stick"]["status"]["device"] == "/dev/sda2"
    assert t["usb-stick"]["used_by"] == ["it3", "it4"]
    assert t["usb-archive"]["status"]["problem"]["code"] == "drive_not_found"
    assert "password" not in t["nas-backup"] and t["nas-backup"]["password_set"] is True
    assert client.delete("/api/v1/targets/tg1").status_code == 409


def test_target_test_and_devices(client):
    ok = client.post("/api/v1/targets/test", json={"id": "tg1", "name": "usb-stick", "kind": "drive", "find_by": "uuid",
                                                   "ident": "3E4F-91AB", "filesystem": "exfat", "rsync_flags": "-rt",
                                                   "min_free_bytes": 0}).json()
    assert ok == {"ok": True, "problem": None, "device": "/dev/sda2", "free_bytes": 412 * 1024**3}
    missing = client.post("/api/v1/targets/test", json={"name": "x", "kind": "drive", "find_by": "label",
                                                        "ident": "HB-ARCHIVE", "rsync_flags": "", "min_free_bytes": 0}).json()
    assert missing["problem"]["code"] == "drive_not_found"
    assert [d["device"] for d in client.get("/api/v1/devices").json()] == ["/dev/sda2", "/dev/sdb1"]


def test_settings_config_types_scripts(client):
    s = client.get("/api/v1/settings").json()
    assert s["time_zone"] == "Europe/Brussels" and s["keep_runs"] == 30
    assert client.put("/api/v1/settings", json={**s, "keep_runs": 50}).json()["keep_runs"] == 50
    assert client.put("/api/v1/settings", json={**s, "keep_runs": 0}).status_code == 422
    cfg = client.get("/api/v1/config").json()
    assert cfg["valid"] and cfg["items"] == 5 and cfg["targets"] == 3
    assert [t["id"] for t in client.post("/api/v1/types/refresh").json()] == ["rsync"]
    assert "script.backup_ok" in client.get("/api/v1/scripts").json()


def test_invalid_query_rejected(client):
    assert client.get("/api/v1/runs", params={"status": "bogus"}).status_code == 422


def test_target_test_reports_not_writable_and_unmounts(client, store, monkeypatch):
    from pathlib import Path

    def refuse(*_a, **_k):
        raise PermissionError("read-only")

    monkeypatch.setattr(Path, "write_text", refuse)
    r = client.post("/api/v1/targets/test", json={"id": "tg1", "name": "usb-stick", "kind": "drive", "find_by": "uuid",
                                                  "ident": "3E4F-91AB", "filesystem": "exfat", "rsync_flags": "-rt",
                                                  "min_free_bytes": 0}).json()
    assert r["problem"]["code"] == "not_writable"
    assert store.exec.calls[-1][0] == "umount"


def test_testing_a_new_password_does_not_replace_the_saved_one(client, store):
    before = store.cfg.cred_path("tg3").read_text()
    client.post("/api/v1/targets/test", json={"id": "tg3", "name": "nas-backup", "kind": "share", "protocol": "smb",
                                              "host": "nas.local", "share": "backup", "username": "homebackup",
                                              "password": "typed-not-saved", "rsync_flags": "-rt", "min_free_bytes": 0})
    assert store.cfg.cred_path("tg3").read_text() == before
    assert not [p for p in store.cfg.secrets_dir.iterdir() if p.name.startswith("test-")]


def test_save_while_config_invalid_is_409(client, store, tmp_path):
    (tmp_path / "homebackup.yaml").write_text("items: [")
    client.post("/api/v1/config/check")
    s = client.get("/api/v1/settings").json()
    assert client.put("/api/v1/settings", json=s).status_code == 409


def test_browse_roots_folders_and_files(client):
    roots = client.get("/api/v1/browse").json()
    assert [e["path"] for e in roots["entries"]] == ["/homeassistant", "/backup", "/media", "/share"]
    media = client.get("/api/v1/browse", params={"path": "/media"}).json()
    assert [e["name"] for e in media["entries"]] == ["immich", "music"] and media["parent"] is None
    ha = client.get("/api/v1/browse", params={"path": "/homeassistant"}).json()
    names = [(e["name"], e["dir"]) for e in ha["entries"]]
    assert names[:3] == [(".storage", True), ("blueprints", True), ("custom_components", True)]  # folders first
    assert ("configuration.yaml", False) in names and all(e["size"] for e in ha["entries"] if not e["dir"])
    deep = client.get("/api/v1/browse", params={"path": "/media/music/Daft Punk"}).json()
    assert deep["parent"] == "/media/music"


def test_browse_cannot_leave_the_source_folders(client):
    for bad in ["/data", "/etc", "/media/../data", "/mediaX", "relative"]:
        assert client.get("/api/v1/browse", params={"path": bad}).status_code == 400, bad
    assert client.get("/api/v1/browse", params={"path": "/media/nope"}).status_code == 404
