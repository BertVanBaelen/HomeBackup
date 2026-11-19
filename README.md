# HomeBackup

A Home Assistant add-on that backs up Home Assistant, Immich and media to USB drives and SMB/NFS shares with rsync. It is opened from the HA sidebar.

[![Add repository to Home Assistant](https://my.home-assistant.io/badges/supervisor_add_addon_repository.svg)](https://my.home-assistant.io/redirect/supervisor_add_addon_repository/?repository_url=https%3A%2F%2Fgithub.com%2FBertVanBaelen%2FHomeBackup)

Status: **0.1 preview**, which is the UI on sample data. See [docs/ROADMAP.md](docs/ROADMAP.md) and [docs/DECISIONS.md](docs/DECISIONS.md).

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
.venv/Scripts/python -m uvicorn homebackup.main:app --port 8099

# frontend (http://localhost:5173, proxies /api to the backend)
cd homebackup/frontend
npm install --legacy-peer-deps
npm test && npm run dev
```
- Sample data runs on a frozen clock (Tue 10 Nov 2026 14:09). Set `HOMEBACKUP_FAKE_NOW=live` for the real clock.
- After an API change, regenerate the frontend types. With the backend's venv active, run this from the repo root:

```sh
python -c "import json; from homebackup.main import create_app; json.dump(create_app().openapi(), open('homebackup/frontend/src/api/openapi.json','w'), indent=1)"
```

  Then run `npm run api:types` in `homebackup/frontend`.
