# Spec Delta

## Purpose

Defines the versioned JSON API between the HomeBackup UI and its backend. In this phase it is backed by in-memory fixtures, so the UI and contract can be reviewed before the backup engine exists.

## ADDED Requirements

### Requirement: Versioned resource endpoints
The backend SHALL expose JSON endpoints under `api/v1` for items, targets, runs (with steps and log lines), plans and settings, plus a status endpoint for the dashboard summary. The schema SHALL be published as OpenAPI.

#### Scenario: Fetch the OpenAPI schema
- **WHEN** a client requests `api/v1/openapi.json`
- **THEN** the response describes every endpoint and model the UI uses

### Requirement: Fixture data matches the design
In this phase, read endpoints SHALL return fixture data matching the design's samples: items ha-backups, music-to-nas, immich-full-monthly, immich-recent and ha-config; targets usb-stick, usb-archive and nas-backup; and their runs.

#### Scenario: List items
- **WHEN** the UI requests the item list
- **THEN** five items are returned, each with type, source, target, schedule, next run, last result and the last 14 run results

### Requirement: Session-scoped mutations
Create, update, delete, run and cancel requests SHALL validate their input, update the in-memory fixtures, and return the new state. Changes SHALL last until the add-on restarts, and SHALL NOT touch any disk, mount or process.

#### Scenario: Save an edited item
- **WHEN** the UI saves immich-recent with its window changed to 3 months
- **THEN** the API returns the updated item, and the dashboard shows "Immich · recent 3 mo"

#### Scenario: Invalid input
- **WHEN** the UI saves an item with an invalid cron expression
- **THEN** the API responds 422 with a field-level error that the editor shows next to the cron field

### Requirement: Live run updates
The API SHALL provide a server-sent events stream of run progress (percent, bytes, speed, remaining time, new log lines). In this phase the stream is simulated for the running fixture.

#### Scenario: Running card updates
- **WHEN** the Dashboard is open while music-to-nas is running
- **THEN** its progress, transferred size and remaining time update without a page reload

### Requirement: Language-neutral payloads
The API SHALL return raw values (timestamps, bytes, counts, exit codes, durations) and messages as a code with parameters, never preformatted or translated text. Step commands SHALL be lists of arguments with secrets redacted.

#### Scenario: Failure message in Dutch
- **WHEN** a run failed because a drive was not found and the UI language is Dutch
- **THEN** the API returns code `target_not_found` with the target name and label, and the UI shows the Dutch sentence

### Requirement: Stable identifiers
Items and targets SHALL have a stable id separate from their editable name, and all references, runs and URLs SHALL use the id.

#### Scenario: Rename an item
- **WHEN** ha-config is renamed to ha-configuration
- **THEN** its run history and links stay attached to it

### Requirement: Checks on unsaved values
The API SHALL check an unsaved item or target and return its checks, folder preview, schedule preview (next runs in the HA time zone) and plan, without saving it.

#### Scenario: Check while editing
- **WHEN** the editor sends an unsaved item with a new schedule
- **THEN** the API returns the next five run times and the checks for those values

### Requirement: Stable sample clock
In fixture mode the API SHALL compute every date relative to a fixed sample time unless told otherwise, so the sample data matches the design.

#### Scenario: Default sample time
- **WHEN** the add-on runs in fixture mode with no clock override
- **THEN** "now" is Tue 10 Nov 2026 14:09 Europe/Brussels and ha-backups shows 16 days without a successful run
