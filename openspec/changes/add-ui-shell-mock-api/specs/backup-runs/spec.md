# Spec Delta

## Purpose

Shows what HomeBackup is doing and has done: the live run, the history of runs, and the full detail of a single run. Also lets the user start a run, start a dry run, or cancel a run.

## ADDED Requirements

### Requirement: Running-now card
While a run is in progress, the Dashboard SHALL show a card with the item, the route, the percent done, the transferred and total size, the speed, the remaining time, a link to the live log, and a Cancel control.

#### Scenario: Run in progress
- **WHEN** music-to-nas is running at 47%
- **THEN** the card shows "47%" and "21.4 of 45.6 GB · 38 MB/s · about 11 min left"

### Requirement: Hold to cancel or start a run
Cancelling a running backup and Run now SHALL each require a press-and-hold confirmation. Dry run SHALL start on a single click.

#### Scenario: Cancel by holding
- **WHEN** the user holds Cancel on the running card until it completes
- **THEN** the run ends with the result Failed (cancelled), and the card disappears

#### Scenario: Dry run
- **WHEN** the user clicks Dry run in the plan preview
- **THEN** a dry run starts at once and the user is taken to its run details

### Requirement: Run history
The History page SHALL list runs, newest first, with result, item, trigger (Scheduled or Manual run), start, duration, what was copied and the detail message. It SHALL filter by item and by result, show counts per result, and load more on request.

#### Scenario: Filter failed runs
- **WHEN** the user selects the Failed filter
- **THEN** only failed runs are listed, and the Failed filter is marked pressed

#### Scenario: Retention note
- **WHEN** History is shown
- **THEN** the retention from Settings is stated, with a link to change it

### Requirement: Run details
The run page SHALL show tiles for the result, duration, copied and deleted amounts. It SHALL explain a warning or failure in plain words and name the hook that was called. It SHALL list each step with its command, duration, exit status and output, and SHALL show the run log.

#### Scenario: Warning explained
- **WHEN** a run ended with rsync exit code 24
- **THEN** the page states "A warning, not a failure" and shows that the warning hook was called, with its time

#### Scenario: Open the step that matters
- **WHEN** a run has a step that ended in a warning or failure
- **THEN** that step is open by default and the others are collapsed

### Requirement: Searchable log
The run log SHALL show the time, level (INFO, CMD, WARN, ERROR) and message for each line. It SHALL filter to warnings or errors and search by text.

#### Scenario: Search the log
- **WHEN** the user types "vanished" in the log search
- **THEN** only lines containing "vanished" are shown

### Requirement: One run at a time
At most one run SHALL be active at a time. Runs requested meanwhile SHALL wait in a first-in, first-out queue that the Dashboard shows, and a request for an item that is already queued or running SHALL be refused.

#### Scenario: Run now while another runs
- **WHEN** the user starts ha-config while music-to-nas is running
- **THEN** ha-config is shown as queued and starts after music-to-nas ends
