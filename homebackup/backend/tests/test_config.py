import os

import yaml

from homebackup.config import ConfigFile
from homebackup.models import Target, TargetIn
from homebackup.store import Store


def test_roundtrip_and_restart(tmp_path, store):
    saved = store.save_target(TargetIn(name="nas2", kind="share", protocol="smb", host="nas", share="b",
                                       username="u", password="s3cret", rsync_flags="-rt", min_free_bytes=0))
    raw = (tmp_path / "homebackup.yaml").read_text()
    assert "nas2" in raw and "s3cret" not in raw and "time_zone" not in raw
    again = Store.demo(tmp_path, rsync_seconds=0, start_running=False)  # same folder: a restart
    assert again.targets[saved.id].name == "nas2" and again.cfg.has_password(saved.id)


def test_credentials_file_is_private(tmp_path):
    cfg = ConfigFile(tmp_path / "c.yaml", tmp_path / "secrets")
    cfg.set_password(Target(id="tg9", name="x", kind="share", username="u", rsync_flags="", min_free_bytes=0), "pw")
    p = cfg.cred_path("tg9")
    assert p.read_text() == "username=u\npassword=pw\n"
    if os.name == "posix":
        assert oct(p.stat().st_mode & 0o777) == "0o600"


def test_invalid_file_keeps_last_good_config(tmp_path, store):
    path = tmp_path / "homebackup.yaml"
    good = path.read_text()
    data = yaml.safe_load(good)
    data["items"][0]["target_id"] = "nope"
    path.write_text(yaml.safe_dump(data))
    status = store.reload_config()
    assert not status.valid and "unknown target" in status.error and status.items == 5
    path.write_text("items: [")
    assert not store.reload_config().valid
    path.write_text(good)
    assert store.reload_config().valid
