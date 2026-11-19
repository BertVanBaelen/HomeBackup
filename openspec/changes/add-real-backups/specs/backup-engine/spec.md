# Spec Delta

## Purpose

Turns an item into a safe, inspectable plan and runs it: one run at a time, with live progress, a clear result, a log and history.

## ADDED Requirements

### Requirement: Plans from allow-listed argument lists
A plan SHALL be an ordered list of steps whose commands are argument lists. Only `mount`, `umount`, `blkid`, `df`, `rsync` and `find` SHALL be executed, and never through a shell. Sources SHALL never be a write destination.

#### Scenario: Disallowed program
- **WHEN** a type's plan contains a command whose program is not on the allow-list
- **THEN** the plan is rejected with `program_not_allowed` and nothing runs

### Requirement: Core steps around type steps
Every plan SHALL start with find, mount and free-space steps from Core, then the type's steps, and SHALL end with an unmount step that runs even when an earlier step failed or the run was cancelled.

#### Scenario: Copy fails
- **WHEN** the rsync step exits with code 11
- **THEN** the run is Failed and the target is still unmounted

### Requirement: Result from exit codes
A run SHALL be Success when every step exits 0, Warning when the worst exit is rsync 23 or 24, and Failed otherwise, including a failed find, mount or free-space check and a cancel.

#### Scenario: Files vanished
- **WHEN** rsync exits with code 24
- **THEN** the run result is Warning with message `rsync_vanished`

### Requirement: Queue, cancel and dry run
Runs SHALL execute one at a time, in request order. Cancel SHALL stop the running process and unmount. A dry run SHALL run the same plan with rsync in dry-run mode and SHALL be shown as a Dry run in history.

#### Scenario: Cancel a copy
- **WHEN** the user cancels a run during the rsync step
- **THEN** rsync is stopped, the target is unmounted, and the run is Failed with message `cancelled`

### Requirement: Logs and history with retention
Each run SHALL keep its steps, exit codes, durations, counts and a log under `/data`. History SHALL keep at most the configured runs per item and days, removing older runs and their logs.

#### Scenario: Retention
- **WHEN** an item has 31 runs and the limit is 30
- **THEN** its oldest run and its log are removed
