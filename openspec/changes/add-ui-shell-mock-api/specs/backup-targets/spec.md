# Spec Delta

## Purpose

Manages the places backups are written to: USB drives or disks found by UUID or label, and SMB or NFS network shares. Each target carries its own rsync flag preset and a minimum free space.

## ADDED Requirements

### Requirement: Targets overview
The Targets page SHALL show a card per target with its name, kind and filesystem, its identifier (UUID, label or share path), its current status (OK or Problem, with detail) and the items that use it.

#### Scenario: Missing drive
- **WHEN** usb-archive is not plugged in
- **THEN** its card shows "Problem" and "Not found. Plug the drive in."

### Requirement: Target editor
The editor SHALL switch between a Drive or disk target (find by UUID or label, filesystem or auto-detect, extra mount options) and a Network share target (SMB with host, share, username and password; NFS with host and export path). Both kinds SHALL have extra mount options, rsync flags with a filesystem preset and a minimum free space with a unit.

#### Scenario: exFAT preset
- **WHEN** a drive target uses exFAT
- **THEN** the rsync flags default to `-rt --no-perms --no-owner --no-group --modify-window=2`, with the reason shown

#### Scenario: Password never shown back
- **WHEN** an SMB target with a saved password is opened
- **THEN** the password field shows that a password is set, but never its value, and the API never returns it

### Requirement: Test target
The editor SHALL offer a test that reports whether the target can be found, mounted read/write, and how much space is free. In this phase the result comes from the fixtures.

#### Scenario: Test usb-stick
- **WHEN** the user tests usb-stick
- **THEN** the result reads "Drive found as /dev/sda2 · mounts read/write · 412 GB free"

### Requirement: Safe target deletion
Deleting a target SHALL require a press-and-hold confirmation, and SHALL be blocked while any item uses the target.

#### Scenario: Target in use
- **WHEN** the user opens usb-stick, which two items use
- **THEN** Delete target is disabled, with "Used by 2 items. Remove them first."
