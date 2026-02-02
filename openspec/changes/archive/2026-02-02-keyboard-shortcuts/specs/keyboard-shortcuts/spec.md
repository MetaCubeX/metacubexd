## ADDED Requirements

### Requirement: Global keyboard shortcut system

The system SHALL provide a global keyboard shortcut system that allows users to navigate and perform actions without using a mouse.

#### Scenario: Navigate to proxies page

- **WHEN** user presses `g` then `p` keys in sequence
- **THEN** system navigates to the Proxies page

#### Scenario: Navigate to connections page

- **WHEN** user presses `g` then `c` keys in sequence
- **THEN** system navigates to the Connections page

#### Scenario: Navigate to overview page

- **WHEN** user presses `g` then `o` keys in sequence
- **THEN** system navigates to the Overview page

#### Scenario: Navigate to rules page

- **WHEN** user presses `g` then `r` keys in sequence
- **THEN** system navigates to the Rules page

#### Scenario: Navigate to logs page

- **WHEN** user presses `g` then `l` keys in sequence
- **THEN** system navigates to the Logs page

#### Scenario: Navigate to config page

- **WHEN** user presses `g` then `s` keys in sequence
- **THEN** system navigates to the Config/Settings page

### Requirement: Shortcuts disabled in input fields

The system SHALL disable global shortcuts when focus is inside an input element.

#### Scenario: Typing in search box

- **WHEN** user is typing in a search input field
- **THEN** pressing shortcut keys SHALL type characters instead of triggering shortcuts

### Requirement: Keyboard shortcut help panel

The system SHALL provide a help panel showing all available keyboard shortcuts.

#### Scenario: Show help panel

- **WHEN** user presses `?` key
- **THEN** system displays a modal showing all available shortcuts grouped by category

#### Scenario: Close help panel

- **WHEN** help panel is open AND user presses `Escape` key
- **THEN** system closes the help panel

### Requirement: Action shortcuts

The system SHALL provide shortcuts for common actions.

#### Scenario: Refresh data

- **WHEN** user presses `r` key (not in input field)
- **THEN** system refreshes the current page data

#### Scenario: Close modal

- **WHEN** a modal is open AND user presses `Escape` key
- **THEN** system closes the modal

### Requirement: Custom shortcut configuration

The system SHALL allow users to customize keyboard shortcuts.

#### Scenario: View shortcut settings

- **WHEN** user opens Config page
- **THEN** system displays a keyboard shortcuts configuration section

#### Scenario: Change shortcut binding

- **WHEN** user clicks on a shortcut binding and presses new key combination
- **THEN** system updates the shortcut binding and persists to storage

#### Scenario: Detect shortcut conflict

- **WHEN** user attempts to assign a key combination already in use
- **THEN** system displays a conflict warning with the conflicting shortcut name

#### Scenario: Reset to defaults

- **WHEN** user clicks "Reset to Defaults" button
- **THEN** system restores all shortcuts to their default bindings
