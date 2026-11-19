from pathlib import Path

from homebackup.models import Item, Target
from homebackup.plans import BUILTIN_TYPES, build_plan, load_types

TYPES = load_types([(BUILTIN_TYPES, True)])
DRIVE = Target(id="tg1", name="usb-stick", kind="drive", filesystem="exfat", find_by="uuid", ident="3E4F-91AB",
               rsync_flags="-rt --no-perms", min_free_bytes=0)
SMB = Target(id="tg3", name="nas", kind="share", protocol="smb", host="nas.local", share="backup", username="hb",
             rsync_flags="-rt", min_free_bytes=0)
ITEM = Item(id="it5", name="ha-config", source="/homeassistant", target_id="tg1", target_path="homeassistant",
            schedule="30 1 * * *")


def plan(item=ITEM, target=DRIVE, types=TYPES, **kw):
    return build_plan(item, target, types, Path("/mnt/hb"), "/data/secrets/tg.cred", **kw)


def test_builtin_rsync_type_loads():
    assert TYPES["rsync"].meta.name == "Generic rsync" and TYPES["rsync"].meta.error is None


def test_core_steps_wrap_the_copy():
    p = plan()
    assert p.error is None
    assert [s.argv[0] for s in p.steps] == ["blkid", "mount", "df", "rsync", "umount"]
    assert [s.origin for s in p.steps] == ["core", "core", "core", "rsync", "core"]
    assert p.steps[0].argv == ["blkid", "-U", "3E4F-91AB"]
    assert p.steps[1].argv == ["mount", "-t", "exfat", "-o", "rw,noatime", "{device}", "/mnt/hb/tg1"]
    rsync = p.steps[3].argv
    assert rsync[-2:] == ["/homeassistant/", "/mnt/hb/tg1/homeassistant/"]
    assert "--delete" not in rsync and "--dry-run" not in rsync


def test_delete_and_dry_run_flags():
    rsync = plan(ITEM.model_copy(update={"delete": True}), dry_run=True).steps[3].argv
    assert "--delete" in rsync and "--dry-run" in rsync


def test_smb_uses_credentials_file_never_the_password():
    mount = plan(target=SMB).steps[0].argv
    assert mount == ["mount", "-t", "cifs", "-o", "credentials=/data/secrets/tg.cred,rw", "//nas.local/backup", "/mnt/hb/tg3"]


def test_unknown_type():
    assert plan(ITEM.model_copy(update={"type": "immich"})).error.code == "type_not_installed"


def test_program_outside_allow_list_rejected(tmp_path):
    (tmp_path / "evil").mkdir()
    (tmp_path / "evil" / "type.json").write_text('{"id": "evil", "name": "Evil"}')
    (tmp_path / "evil" / "plan.py").write_text("def steps(item, ctx):\n    return [{'title': 'x', 'argv': ['sh', '-c', 'id']}]\n")
    types = load_types([(tmp_path, False)])
    p = plan(ITEM.model_copy(update={"type": "evil"}), types=types)
    assert p.error.code == "program_not_allowed" and p.steps == []


def test_rsync_may_only_write_to_the_target(tmp_path):
    (tmp_path / "bad").mkdir()
    (tmp_path / "bad" / "type.json").write_text('{"id": "bad", "name": "Bad"}')
    (tmp_path / "bad" / "plan.py").write_text("def steps(item, ctx):\n    return [{'title': 'x', 'argv': ['rsync', '-a', '/tmp/', '/homeassistant/']}]\n")
    p = plan(ITEM.model_copy(update={"type": "bad"}), types=load_types([(tmp_path, False)]))
    assert p.error.code == "destination_outside_target"


def test_broken_type_is_listed_with_its_error(tmp_path):
    (tmp_path / "broken").mkdir()
    (tmp_path / "broken" / "type.json").write_text('{"id": "broken"}')
    (tmp_path / "broken" / "plan.py").write_text("def (:")
    t = load_types([(tmp_path, False)])["broken"]
    assert t.steps is None and "SyntaxError" in t.meta.error


def test_target_path_cannot_escape_the_target():
    import pydantic
    import pytest
    with pytest.raises(pydantic.ValidationError):
        ITEM.model_validate({**ITEM.model_dump(), "target_path": "../../data"})
    sneaky = ITEM.model_copy(update={"target_path": "a/../../../data"})  # bypasses validation, as a type could
    assert plan(sneaky).error.code == "destination_outside_target"
