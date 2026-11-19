"""Home Assistant via the Supervisor proxy (needs `homeassistant_api: true`). Outside HA every call returns None."""

import json
import os
import urllib.request


def _get(path: str):
    token = os.environ.get("SUPERVISOR_TOKEN")
    if not token:
        return None
    req = urllib.request.Request(f"http://supervisor{path}", headers={"Authorization": f"Bearer {token}"})
    try:
        with urllib.request.build_opener(urllib.request.ProxyHandler({})).open(req, timeout=5) as r:
            return json.load(r)
    except (OSError, ValueError):
        return None


def time_zone() -> str:
    return (_get("/core/api/config") or {}).get("time_zone") or os.environ.get("TZ") or "UTC"


def scripts() -> list[str] | None:
    states = _get("/core/api/states")
    return None if states is None else sorted(s["entity_id"] for s in states if s["entity_id"].startswith("script."))
