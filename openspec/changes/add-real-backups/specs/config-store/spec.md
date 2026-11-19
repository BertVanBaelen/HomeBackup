# Spec Delta

## Purpose

Keeps items, targets and settings in one hand-editable YAML file, validates it, and keeps secrets out of it.

## ADDED Requirements

### Requirement: Config file is the source of truth
Items, targets and settings SHALL be saved to `/config/homebackup.yaml` with an atomic write, and SHALL be loaded from it at start-up and when the user asks to check it again.

#### Scenario: Save an item
- **WHEN** the user saves a new item in the editor
- **THEN** the item appears in `homebackup.yaml` and survives an add-on restart

#### Scenario: File edited by hand
- **WHEN** the user edits `homebackup.yaml` and selects Check again in Settings
- **THEN** the new values are used, and an invalid file is reported with the reason while the last valid config stays active

### Requirement: Secrets kept out of the config file
Share passwords SHALL be stored only in the add-on's private `/data` folder, SHALL never be returned by the API, and SHALL never appear in logs or plans.

#### Scenario: Password in a mount
- **WHEN** an SMB target is mounted
- **THEN** the password is passed through a credentials file readable only by the add-on, and the logged command shows no password

### Requirement: Referential integrity
An item SHALL reference an existing target, and a target used by an item SHALL NOT be deletable.

#### Scenario: Delete a used target
- **WHEN** the API is asked to delete a target that an item uses
- **THEN** it responds 409 and nothing is deleted
