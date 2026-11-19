"""Items, targets and settings in a hand-editable YAML file; share passwords in /data/secrets."""

import os
import uuid
from pathlib import Path

import yaml
from pydantic import BaseModel, ValidationError

from .models import Item, Settings, Target


class ConfigInvalid(Exception):
    """The file on disk is invalid: saving would overwrite the user's hand edits."""


class Config(BaseModel):
    version: int = 1
    settings: Settings = Settings()
    targets: list[Target] = []
    items: list[Item] = []


class ConfigFile:
    def __init__(self, path: Path, secrets_dir: Path):
        self.path = path
        self.secrets_dir = secrets_dir
        self.config = Config()
        self.error: str | None = None

    def load(self) -> bool:
        """Read the file. An invalid file keeps the last good config and records the error."""
        if not self.path.exists():
            self.error = None
            return True
        try:
            data = yaml.safe_load(self.path.read_text(encoding="utf-8")) or {}
            cfg = Config.model_validate(data)
            _check_refs(cfg)
        except (yaml.YAMLError, ValidationError, ValueError) as e:
            self.error = str(e).splitlines()[0] if isinstance(e, ValidationError) else str(e)
            if isinstance(e, ValidationError):
                err = e.errors()[0]
                self.error = f"{'.'.join(str(p) for p in err['loc'])}: {err['msg']}"
            return False
        self.config, self.error = cfg, None
        return True

    def save(self):
        if self.error:
            raise ConfigInvalid(self.error)
        _check_refs(self.config)
        self.path.parent.mkdir(parents=True, exist_ok=True)
        data = self.config.model_dump(mode="json", exclude={"settings": {"time_zone"}})
        tmp = self.path.with_suffix(".tmp")
        tmp.write_text("# HomeBackup config. Edit by hand if you like, then use Settings > Check again.\n"
                       + yaml.safe_dump(data, sort_keys=False, allow_unicode=True), encoding="utf-8")
        os.replace(tmp, self.path)  # atomic: a reader never sees a half-written file

    # --- secrets -------------------------------------------------------------------------
    def cred_path(self, target_id: str) -> Path:
        return self.secrets_dir / f"{target_id}.cred"

    def has_password(self, target_id: str) -> bool:
        return self.cred_path(target_id).exists()

    def set_password(self, target: Target, password: str):
        """Writes a mount.cifs credentials file, readable by the add-on only."""
        self.secrets_dir.mkdir(parents=True, exist_ok=True)
        p = self.cred_path(target.id)
        p.write_text(f"username={target.username or ''}\npassword={password}\n", encoding="utf-8")
        os.chmod(p, 0o600)

    def delete_password(self, target_id: str):
        self.cred_path(target_id).unlink(missing_ok=True)


def new_id(prefix: str) -> str:
    return f"{prefix}_{uuid.uuid4().hex[:8]}"


def _check_refs(cfg: Config):
    targets = {t.id for t in cfg.targets}
    for kind, rows in (("target", cfg.targets), ("item", cfg.items)):
        ids = [r.id for r in rows]
        if len(ids) != len(set(ids)) or "" in ids:
            raise ValueError(f"{kind} ids must be unique and non-empty")
    for i in cfg.items:
        if i.target_id not in targets:
            raise ValueError(f"item {i.name}: unknown target {i.target_id}")
