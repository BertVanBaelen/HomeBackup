"""Turns an item into a plan: Core steps (find, mount, free space ... unmount) around the type's own steps."""

import importlib.util
import json
from collections.abc import Callable
from dataclasses import dataclass
from pathlib import Path

from .models import BackupType, Item, Message, Plan, Step, Target
from .system import ALLOWED

BUILTIN_TYPES = Path(__file__).parent / "types"


@dataclass
class LoadedType:
    meta: BackupType
    steps: Callable[[dict, dict], list[dict]] | None


def load_types(dirs: list[tuple[Path, bool]]) -> dict[str, LoadedType]:
    """Each type is a folder with type.json and plan.py. A broken type is listed with its error, not loaded."""
    out: dict[str, LoadedType] = {}
    for root, builtin in dirs:
        for folder in sorted(p for p in root.glob("*") if (p / "type.json").exists()):
            try:
                meta = json.loads((folder / "type.json").read_text(encoding="utf-8"))
                spec = importlib.util.spec_from_file_location(f"hb_type_{folder.name}", folder / "plan.py")
                mod = importlib.util.module_from_spec(spec)
                spec.loader.exec_module(mod)
                out[meta["id"]] = LoadedType(BackupType(id=meta["id"], name=meta.get("name", meta["id"]),
                                                        version=str(meta.get("version", "1")), builtin=builtin),
                                             mod.steps)
            except Exception as e:  # noqa: BLE001 - a user type must never take the add-on down
                out[folder.name] = LoadedType(BackupType(id=folder.name, name=folder.name, builtin=builtin,
                                                         error=f"{type(e).__name__}: {e}"), None)
    return out


def mountpoint(root: Path, target: Target) -> str:
    return f"{root.as_posix()}/{target.id}"


def _core_before(target: Target, mp: str, cred: str) -> list[dict]:
    extra = f",{target.mount_options}" if target.mount_options else ""
    if target.kind == "drive":
        fs = ["-t", target.filesystem] if target.filesystem and target.filesystem != "auto" else []
        return [
            {"title": {"code": "step_find"}, "why": {"code": "why_find"},
             "argv": ["blkid", "-U" if target.find_by == "uuid" else "-L", target.ident or ""]},
            # {device} is filled in at run time from the find step's answer
            {"title": {"code": "step_mount"}, "why": {"code": "why_mount"},
             "argv": ["mount", *fs, "-o", f"rw,noatime{extra}", "{device}", mp]},
        ]
    if target.protocol == "smb":
        src, opts = f"//{target.host}/{target.share}", f"credentials={cred},rw{extra}"
    else:
        src, opts = f"{target.host}:{target.share}", f"rw{extra}"
    return [{"title": {"code": "step_mount"}, "why": {"code": "why_mount_share"},
             "argv": ["mount", "-t", "cifs" if target.protocol == "smb" else "nfs", "-o", opts, src, mp]}]


def build_plan(item: Item, target: Target, types: dict[str, LoadedType], mount_root: Path, cred: str,
               dry_run: bool = False) -> Plan:
    mp = mountpoint(mount_root, target)
    t = types.get(item.type)
    if t is None or t.steps is None:
        return Plan(steps=[], programs=list(ALLOWED), error=Message(code="type_not_installed", params={"type": item.type}))
    raw = [*_core_before(target, mp, cred),
           {"title": {"code": "step_df"}, "why": {"code": "why_df"}, "argv": ["df", "--output=avail", "-B1", mp]}]
    origin = ["core"] * len(raw)
    try:
        own = t.steps(item.model_dump(), {"mount": mp, "rsync_flags": target.rsync_flags, "dry_run": dry_run})
    except Exception as e:  # noqa: BLE001 - same: a failing user type becomes a plan error
        return Plan(steps=[], programs=list(ALLOWED),
                    error=Message(code="type_failed", params={"type": item.type, "error": str(e)}))
    raw += own
    origin += [item.type] * len(own)
    raw.append({"title": {"code": "step_umount"}, "why": {"code": "why_umount"}, "argv": ["umount", mp]})
    origin.append("core")

    steps = []
    for n, (s, o) in enumerate(zip(raw, origin), 1):
        title = s["title"] if isinstance(s["title"], dict) else {"code": "text", "params": {"text": s["title"]}}
        why = s.get("why")
        why = why if isinstance(why, dict) or why is None else {"code": "text", "params": {"text": why}}
        argv = [str(a) for a in s.get("argv", [])]
        if argv and argv[0] not in ALLOWED:
            return Plan(steps=[], programs=list(ALLOWED), error=Message(code="program_not_allowed", params={"program": argv[0]}))
        if argv and argv[0] == "rsync" and not argv[-1].startswith(mp + "/"):
            # the only place rsync may write to is the mounted target
            return Plan(steps=[], programs=list(ALLOWED), error=Message(code="destination_outside_target"))
        steps.append(Step(n=n, origin=o, title=Message(**title), why=Message(**why) if why else None,
                          argv=argv, skipped=bool(s.get("skipped")) or not argv))
    return Plan(steps=steps, programs=list(ALLOWED))
