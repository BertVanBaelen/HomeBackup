# HomeBackup

A Home Assistant add-on that backs up Home Assistant, Immich and media to USB drives and SMB/NFS shares with rsync. It is opened from the HA sidebar.

[![Add repository to Home Assistant](https://my.home-assistant.io/badges/supervisor_add_addon_repository.svg)](https://my.home-assistant.io/redirect/supervisor_add_addon_repository/?repository_url=https%3A%2F%2Fgithub.com%2FBertVanBaelen%2FHomeBackup)

Status: **0.3**: Generic rsync items run for real (by hand); scheduling and hooks come in 0.4, the Immich preset in 0.5. See [docs/ROADMAP.md](docs/ROADMAP.md) and [docs/DECISIONS.md](docs/DECISIONS.md).

## Layout
| Path | What |
|---|---|
| `homebackup/` | The add-on (config, Dockerfile, icon) |
| `homebackup/backend/` | Python 3.12 + FastAPI, API under `/api/v1` |
| `homebackup/frontend/` | React + TypeScript + Vite, Tailwind, shadcn/ui, Kokonut UI |
| `openspec/` | Specs and change proposals (OpenSpec) |

## Develop
```sh
# backend (http://127.0.0.1:8099)
cd homebackup/backend
python -m venv .venv && .venv/Scripts/python -m pip install -e ".[dev]"
.venv/Scripts/python -m pytest
HOMEBACKUP_DEMO=1 .venv/Scripts/python -m uvicorn homebackup.main:app_factory --factory --port 8099

# frontend (http://localhost:5173, proxies /api to the backend)
cd homebackup/frontend
npm install --legacy-peer-deps
npm test && npm run dev
```
- `HOMEBACKUP_DEMO=1` runs on the design's sample data with simulated commands (no root or Linux needed), on a frozen clock (Tue 10 Nov 2026 14:09); `HOMEBACKUP_FAKE_NOW=live` uses the real clock. Without it the add-on uses `/config/homebackup.yaml`, `/data` and real commands.
- After an API change, regenerate the OpenAPI file and the test sample (`homebackup/backend`: `.venv/Scripts/python scripts_sample.py`), then the types (`homebackup/frontend`: `npm run api:types`).
