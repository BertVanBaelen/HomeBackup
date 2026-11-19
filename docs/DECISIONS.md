# Product and technical decisions

Settled with the product owner on 2026-11-19. Specs and code follow these. Change them here first.

## Product
| Topic | Decision |
|---|---|
| Hooks | Home Assistant scripts only (`script.*`), called through the HA API with variables `item`, `result`, `files`, `bytes`, `deleted`, `exit_code`, `message`. No shell scripts. The Settings screen picks from HA's script list. |
| Concurrency | One run at a time, add-on wide. Scheduled and manual runs that arrive meanwhile wait in a FIFO queue, which the Dashboard shows. A second request for an item that is already queued or running is refused. |
| Mounting | HomeBackup mounts targets itself (USB by UUID/label, SMB, NFS). The add-on is privileged (`SYS_ADMIN`, device access), and DOCS.md explains why. This lands in phase 2. |
| Needs attention | An item is overdue when the first scheduled run after its last good run (success **or** warning) is more than `overdue_days` late. "No successful run for N days" counts from that last good run. |
| Identity | Items and targets have a stable hidden `id`. The name is a label that can be renamed. Logs, history and references use the id. |
| Backup types | Built-in types ship in the image. Users can add their own by dropping a folder (`type.json` + `plan.py`) into `/addon_configs/<slug>/types/`. `TYPES_AUTHORING.md` explains to an AI (or a person) how to write one. A Refresh button in the UI reloads the types. |
| Missed runs | Catch up once on start-up, or when the target appears (drive plugged in). |
| Access | Admins only (`panel_admin: true`). |
| Language | Settings offers Automatic (follow HA, the default), English or Nederlands. |

## Technical (from the plan review)
- Only the Supervisor Ingress proxy (`172.30.32.2`) may reach the API, plus localhost in dev. No `ports:` are exposed.
- The API returns raw values and message codes with parameters, never preformatted or English-only text. The client formats and translates. Step commands are lists of arguments with secrets redacted.
- Fixtures use a frozen clock (`HOMEBACKUP_FAKE_NOW`, default `2026-11-10T14:09+01:00`, as drawn in the design) so screenshots and tests stay stable.
- HA paths: HA config is `/homeassistant` (read-only), the add-on's own config is `/config` (= `/addon_configs/<slug>`), and the other sources are `/backup`, `/media` and `/share` (read-only).
- Screenshot widths are 1024 (the laptop frame minus the HA sidebar), 820 and 390.
- Live updates use SSE with a heartbeat and event ids, with polling as the fallback. Phase 1a includes a spike on a real HA instance.
- Images: prebuilt multi-arch in CI and published to GHCR, with `image:` in config.yaml from phase 7. Until then the Supervisor builds locally.
