import asyncio

import pytest

from homebackup.system import FakeExec, NotAllowed, parse_blkid_export, parse_progress, parse_stats


def test_blkid_export():
    text = "DEVNAME=/dev/sda2\nUUID=3E4F-91AB\nTYPE=exfat\n\nDEVNAME=/dev/sdb1\nLABEL=HB-ARCHIVE\nUUID=a-b\nTYPE=ext4\n"
    d = parse_blkid_export(text)
    assert [x.device for x in d] == ["/dev/sda2", "/dev/sdb1"]
    assert d[0].uuid == "3E4F-91AB" and d[0].label is None and d[1].label == "HB-ARCHIVE"


def test_progress_line():
    assert parse_progress("  1,234,567  47%   38.12MB/s    0:11:02 (xfr#12, to-chk=100/2000)") == (
        1234567, 47.0, int(38.12 * 1024**2), 662)
    assert parse_progress("sending incremental file list") is None


def test_stats():
    lines = ["Number of regular files transferred: 2,318", "Total transferred file size: 15,676,334 bytes",
             "Number of deleted files: 12"]
    assert parse_stats(lines) == {"files": 2318, "bytes": 15676334, "deleted": 12}


def test_fake_exec_refuses_programs_outside_allow_list():
    with pytest.raises(NotAllowed):
        asyncio.run(FakeExec([])(["sh", "-c", "rm -rf /"], print))
