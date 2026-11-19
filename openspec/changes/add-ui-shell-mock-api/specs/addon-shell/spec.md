# Spec Delta

## Purpose

Packages HomeBackup as a Home Assistant add-on whose web UI opens from the HA sidebar through Ingress, and provides the shared app frame: navigation, theme, language and responsive layout.

## ADDED Requirements

### Requirement: Installable Home Assistant add-on
The repository SHALL be addable as a Home Assistant add-on repository and SHALL contain one add-on, HomeBackup, that installs and starts on the amd64 and aarch64 architectures.

#### Scenario: Add repository and install
- **WHEN** the user adds the repository URL in the HA add-on store and installs HomeBackup
- **THEN** the add-on builds, starts, and shows the HomeBackup icon and logo in the store

### Requirement: Opened through Ingress without own authentication
The UI SHALL be served only through HA Ingress, SHALL offer a sidebar panel entry, and SHALL NOT present its own login. All asset and API URLs SHALL resolve relative to the Ingress base path.

#### Scenario: Open from the HA sidebar
- **WHEN** the user selects HomeBackup in the HA sidebar or the companion app menu
- **THEN** the Dashboard loads inside HA with no login prompt

#### Scenario: Frame reload keeps the page
- **WHEN** the HomeBackup frame is reloaded while on the History section
- **THEN** History is shown again and every asset and API request is served under the Ingress base path

### Requirement: Reachable only through the Ingress proxy
The backend SHALL reject every request that does not come from the Supervisor Ingress proxy (or from localhost in development), and SHALL publish no host ports.

#### Scenario: Another add-on calls the API
- **WHEN** a container on the hassio network requests `api/v1/items` directly
- **THEN** the request is refused with 403

### Requirement: Section navigation
The app SHALL show the HomeBackup mark and a section switcher with Dashboard, History, Targets and Settings, and SHALL mark the current section. The Item editor, Plan preview and Run details pages SHALL belong to the section they were opened from.

#### Scenario: Switch section
- **WHEN** the user selects Targets in the section switcher
- **THEN** the Targets page is shown and Targets is marked as the current section

#### Scenario: Phone width hides the wordmark
- **WHEN** the viewport is phone width
- **THEN** the wordmark is hidden and the section switcher stays visible and scrolls horizontally if needed

### Requirement: Theme follows Home Assistant
The app SHALL render in dark or light colors, matching the color scheme reported by the HA frontend, and SHALL switch when that scheme changes.

#### Scenario: HA in dark mode
- **WHEN** Home Assistant is in dark mode
- **THEN** HomeBackup renders with the dark palette from the design

#### Scenario: HA switches theme
- **WHEN** the user switches Home Assistant from dark to light while HomeBackup is open
- **THEN** HomeBackup switches to the light palette without a reload

### Requirement: English and Dutch
All UI text SHALL be available in English and Dutch. The language setting SHALL be Automatic (the default), English or Nederlands. Automatic uses the HA user's language when it is Dutch, and English otherwise.

#### Scenario: Language set in Settings
- **WHEN** the user picks Nederlands in Settings and saves
- **THEN** every page shows Dutch text, and dates and numbers use Dutch formatting

### Requirement: Responsive layouts
Every page SHALL be usable at laptop (≥1024 px), tablet (≥600 px) and phone (<600 px) widths as drawn in the design: tables become stacked rows, toolbars wrap, and touch targets are at least 44 px.

#### Scenario: Items table on a phone
- **WHEN** the Dashboard is opened at phone width
- **THEN** each backup item is a stacked row with name, route, status and next run, and nothing scrolls horizontally except the section switcher

### Requirement: No outside requests
The UI SHALL NOT load any resource from outside the add-on. This includes fonts, icons and scripts.

#### Scenario: Offline HA host
- **WHEN** the HA host has no internet access
- **THEN** every page renders with the correct fonts and icons
