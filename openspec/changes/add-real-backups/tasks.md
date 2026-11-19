# Tasks

## 1. Config store (0.2)
- [x] 1.1 `config.py`: load, validate and save `homebackup.yaml` atomically, with ids for new items and targets and secrets in `/data/secrets`; verify tests for the round trip, that an invalid file keeps the last good config, and that a password is never serialized
- [x] 1.2 CRUD endpoints for items, targets and settings, with referential checks (409), plus `config/status` and `config/check`; verify API tests
- [x] 1.3 Demo mode seeds from the fixtures; verify the 0.1 tests pass against demo mode

## 2. Target access (0.2)
- [x] 2.1 `system.py`: allow-listed async exec, a `blkid -o export` parser, find/mount/umount/df helpers, and the SMB credentials file; verify the parser and argv tests (no password in argv)
- [x] 2.2 Live target status and `POST targets/test` (find → mount rw → probe → df → umount); verify with the fake executor, including the not-writable path
- [ ] 2.3 Add-on config: map, privileges, homeassistant_api, and the Dockerfile packages; verify with the add-on linter

## 3. Engine (0.3)
- [x] 3.1 Type loader, the built-in `rsync` type, and the core steps in `plans.py`; verify plan tests (order, allow-list rejection, delete flag, no shell)
- [x] 3.2 `history.py`: SQLite, logs and retention; verify tests
- [x] 3.3 `runner.py`: queue worker, rsync progress parser, exit-code mapping, always-unmount, cancel and dry run; verify tests with the fake executor
- [x] 3.4 API: plan for a saved or unsaved item, run (and dry run), run detail with steps and log, item checks and next runs; verify API tests

## 4. Screens (milestone 1b)
- [x] 4.1 Item editor; verify component tests
- [x] 4.2 Plan preview; verify component tests
- [x] 4.3 Run details with log filter and search; verify component tests
- [x] 4.4 Targets list, editor and test; verify component tests
- [x] 4.5 Settings; verify component tests

## 5. Integration
- [x] 5.1 Demo-mode walkthrough in the browser at 1024, 820 and 390 px, in light and dark
- [x] 5.2 Bump to 0.3.0, update the changelog, commit and push

## Workflow follow-up
- Check on real hardware (mount USB and SMB on an HA instance) before announcing 0.3.0.
