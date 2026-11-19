import asyncio

from homebackup.store import Store

HA_CONFIG, HA_BACKUPS = "it5", "it1"  # ha-config on nas-backup (SMB); ha-backups on the unplugged usb-archive


def run(store, item_id, trigger="manual"):
    return asyncio.run(store.runner.execute(item_id, trigger))


def test_success_runs_core_and_type_steps_and_unmounts(store):
    r = run(store, HA_CONFIG)
    assert r.status == "success" and r.exit_code == 0 and r.files == 1204
    assert [c[0] for c in store.exec.calls] == ["mount", "df", "rsync", "umount"]
    assert all(s.exit_code == 0 for s in r.steps)
    log = store.history.read_log(r.id)
    assert log[0].msg.startswith("Run started") and any(line.level == "CMD" for line in log)
    assert store.history.get(r.id).status == "success"


def test_missing_drive_fails_without_mounting(store):
    r = run(store, HA_BACKUPS)
    assert r.status == "failure" and r.message.code == "target_not_found"
    assert r.message.params == {"target": "usb-archive", "label": "HB-ARCHIVE"}
    assert [c[0] for c in store.exec.calls] == ["blkid"]


def test_vanished_files_is_a_warning(store):
    store.exec.exit_codes["rsync"] = 24
    r = run(store, HA_CONFIG)
    assert r.status == "warning" and r.message.code == "rsync_vanished"
    assert store.exec.calls[-1][0] == "umount"


def test_rsync_error_fails_but_still_unmounts(store):
    store.exec.exit_codes["rsync"] = 11
    r = run(store, HA_CONFIG)
    assert r.status == "failure" and r.message.params["exit_code"] == 11
    assert store.exec.calls[-1][0] == "umount"


def test_not_enough_space_stops_before_copying(store):
    store.exec.free = 1024
    r = run(store, HA_CONFIG)
    assert r.message.code == "not_enough_space"
    assert "rsync" not in [c[0] for c in store.exec.calls] and store.exec.calls[-1][0] == "umount"


def test_dry_run_flag_and_kept_out_of_the_run_strip(store):
    before = next(v for v in store.item_views() if v.id == HA_CONFIG).recent
    r = run(store, HA_CONFIG, "dry_run")
    assert r.trigger == "dry_run" and "--dry-run" in store.exec.calls[2]
    assert next(v for v in store.item_views() if v.id == HA_CONFIG).recent == before


def test_cancel_stops_rsync_and_unmounts(tmp_path):
    store = Store.demo(tmp_path, rsync_seconds=30, start_running=False)

    async def go():
        task = asyncio.create_task(store.runner.execute(HA_CONFIG, "manual"))
        store.runner._task = task
        while not (store.runner.progress and store.runner.progress.percent > 0):
            await asyncio.sleep(0.05)
        store.runner.cancel(store.runner.current.id)
        return await task

    r = asyncio.run(go())
    assert r.status == "failure" and r.message.code == "cancelled"
    assert store.exec.calls[-1][0] == "umount"


def test_retention_applied_after_a_run(store):
    store.cfg.config.settings.keep_runs = 3
    run(store, HA_CONFIG)
    assert store.history.query(HA_CONFIG, None, 100, 0)[1] == 3
