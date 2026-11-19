# Spec Delta

## Purpose

Finds drives and shares, reports whether they can be used, and mounts them for a run.

## ADDED Requirements

### Requirement: Device detection
The add-on SHALL list the block devices it can see, with device path, UUID, label and filesystem, so a drive target can be picked by UUID or label.

#### Scenario: Pick a plugged-in drive
- **WHEN** the user opens a new drive target
- **THEN** the plugged-in drives are offered with their UUID, label and filesystem

### Requirement: Live target status
A drive target SHALL be OK when a device with its UUID or label is present. A share target SHALL be OK when its host answers on the protocol's port. Otherwise the target SHALL show a problem code.

#### Scenario: Unplugged drive
- **WHEN** no device has the label HB-ARCHIVE
- **THEN** usb-archive reports the problem `drive_not_found`

### Requirement: Test target
Test target SHALL find the target, mount it read/write under `/mnt/hb/<target id>`, write and delete a probe file, report the free space, and unmount, even when a step fails.

#### Scenario: Read-only share
- **WHEN** the share mounts but the probe file cannot be written
- **THEN** the test reports `not_writable` and the share is unmounted
