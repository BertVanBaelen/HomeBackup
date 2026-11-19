# Spec Delta

## Purpose

Holds the add-on-wide defaults every item inherits (hook scripts, overdue threshold, history retention, language, log level) and shows the health of the config file.

## ADDED Requirements

### Requirement: Default hooks
Settings SHALL let the user pick a default Home Assistant script for success, warning and failure from HA's script list, or None. An item's own hook SHALL override the default.

#### Scenario: Item without its own hook
- **WHEN** an item's On warning hook is set to Default and the default is script.backup_warn
- **THEN** the item editor shows "Default · script.backup_warn" for On warning

### Requirement: Overdue threshold and retention
Settings SHALL hold the number of days after which an item without a success counts as overdue, and how many runs per item and how many days of history are kept.

#### Scenario: Change retention
- **WHEN** the user sets retention to 50 runs and 120 days and saves
- **THEN** the History page states "Keeping the last 50 runs of each item for 120 days"

### Requirement: Language, time zone and log level
Settings SHALL let the user choose Automatic, English or Nederlands and the log level (Info, Warnings and errors only, Debug). Settings SHALL show the time zone taken from Home Assistant as read-only.

#### Scenario: Time zone is read-only
- **WHEN** Settings is shown
- **THEN** the time zone reads "Europe/Brussels" with "Follows Home Assistant", and cannot be edited

### Requirement: Config file status
Settings SHALL show the path of the config file and whether it is valid, with item and target counts, and SHALL let the user check it again.

#### Scenario: Valid config
- **WHEN** the config holds 5 items and 3 targets
- **THEN** Settings shows "Valid · 5 items · 3 targets"

### Requirement: Explicit save
Changes on the Settings page SHALL apply only after Save settings, and Cancel SHALL discard them.

#### Scenario: Cancel changes
- **WHEN** the user changes the log level and selects Cancel
- **THEN** the saved log level is unchanged
