# Spec Delta

## Purpose

Lets the user see every backup item at a glance and create, edit, delete and preview items of the Generic rsync and Immich preset types.

## ADDED Requirements

### Requirement: Items overview
The Dashboard SHALL list every backup item with its name, type, a mirror badge when deletes are on, the source → target route, the last 14 run results as a bar strip, the last result with its date and detail, and the next run with its schedule.

#### Scenario: Failed item
- **WHEN** ha-backups' last run failed
- **THEN** its row shows "Failed · Sun 8 Nov" with "Drive usb-archive not found", and the bar strip ends in two failure bars

#### Scenario: Run strip is accessible
- **WHEN** a screen reader reaches an item's run strip
- **THEN** it reads a summary such as "Last 14 runs: 12 succeeded, 2 failed"

### Requirement: Needs-attention summary
The Dashboard SHALL show a "Needs attention" card for each item whose first scheduled run after its last good run (success or warning) is more than the overdue threshold late, with the last result and a link to that run.

#### Scenario: Monthly item is not overdue
- **WHEN** immich-full-monthly last ran with a warning 9 days ago and its next run is in 3 weeks
- **THEN** it is not shown under Needs attention

#### Scenario: Overdue item
- **WHEN** ha-backups has had no successful run for 16 days and the threshold is 7 days
- **THEN** the card shows "No successful run for 16 days" with the last error and a View run link

### Requirement: Item editor
The editor SHALL let the user set the name and enabled state, the type (Generic rsync or Immich preset), the source folder, the target and the folder on it, cleanup (mirror delete), the cron schedule, and the success, warning and failure hooks (Home Assistant scripts, Default or None).

#### Scenario: Immich preset fields
- **WHEN** the type is Immich preset
- **THEN** the editor shows the Recent or Full mode, the library window (number plus months or days) and the thumbnails toggle

#### Scenario: Schedule preview
- **WHEN** the user enters `0 3 * * *`
- **THEN** the editor shows "Every day at 03:00 · <HA time zone>" and the next five run times

### Requirement: Pre-save checks and folder preview
The editor SHALL show checks for the current values (source exists, target present, free space, overlap with another item's destination) and the list of folders that will sync, each tagged full, window or skipped.

#### Scenario: Shared destination
- **WHEN** immich-recent and immich-full-monthly write to the same target folder
- **THEN** a warning banner explains the conflict, and the checks list shows "Overlaps with immich-full-monthly"

### Requirement: Hold to confirm destructive item actions
Deleting an item and turning on mirror deletes SHALL require a press-and-hold confirmation. A short click SHALL NOT perform the action.

#### Scenario: Short click on Delete item
- **WHEN** the user clicks Delete item and releases immediately
- **THEN** the item is not deleted, and the button prompts the user to keep holding

#### Scenario: Turning on cleanup
- **WHEN** the user holds the cleanup control until it completes
- **THEN** cleanup turns on and the chip changes from "Safe · nothing is deleted" to "Mirror · deletes on the target"

### Requirement: Plan preview
For each item, the app SHALL show the ordered steps it would run, with their origin (Core or the item's type), purpose and exact commands. It SHALL also show the allowed programs, an explanation of each rsync flag used, and how the result is decided. Nothing is executed.

#### Scenario: Skipped step
- **WHEN** thumbnails are turned off for an Immich item
- **THEN** the step "Thumbnails and encoded video" appears dashed and marked Skipped, with the reason

#### Scenario: Phone width
- **WHEN** the plan preview is opened at phone width
- **THEN** the steps are collapsed except the main copy step, and each opens on selection
