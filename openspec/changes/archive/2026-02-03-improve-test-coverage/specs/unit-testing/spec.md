## ADDED Requirements

### Requirement: Utils unit tests

The system SHALL have unit tests for utility functions in `utils/` directory.

#### Scenario: Test nodeScoring calculateNodeScore

- **WHEN** calculateNodeScore is called with node performance data and weights
- **THEN** system returns a score between 0-100 based on latency, stability, and success rate

#### Scenario: Test nodeScoring getScoreColorClass

- **WHEN** getScoreColorClass is called with a score value
- **THEN** system returns appropriate color class (green for 80+, yellow for 50-79, red for 0-49)

#### Scenario: Test nodeScoring formatTimeSince

- **WHEN** formatTimeSince is called with a timestamp
- **THEN** system returns human-readable relative time string

#### Scenario: Test utility functions

- **WHEN** utility functions in index.ts are called with valid inputs
- **THEN** system returns expected transformed outputs

### Requirement: Stores unit tests

The system SHALL have unit tests for Pinia stores.

#### Scenario: Test nodeRecommendation store recordTestResult

- **WHEN** recordTestResult is called with node name and latency
- **THEN** system stores the result in performance history (max 20 entries)

#### Scenario: Test nodeRecommendation store exclusion

- **WHEN** toggleExclusion is called for a node
- **THEN** system adds or removes the node from excluded list

#### Scenario: Test shortcuts store updateShortcut

- **WHEN** updateShortcut is called with action and key
- **THEN** system updates custom shortcuts in localStorage

#### Scenario: Test shortcuts store findConflict

- **WHEN** findConflict is called with a key already in use
- **THEN** system returns the conflicting action name

### Requirement: Composables unit tests

The system SHALL have unit tests for Vue composables.

#### Scenario: Test useKeyboardShortcuts navigation

- **WHEN** g+p keys are pressed outside input fields
- **THEN** system navigates to proxies page

#### Scenario: Test useKeyboardShortcuts input focus

- **WHEN** keys are pressed while input is focused
- **THEN** system does not trigger shortcuts

#### Scenario: Test useBatchLatencyTest concurrency

- **WHEN** batch test is started with many nodes
- **THEN** system limits concurrent tests to configured maximum

### Requirement: Test coverage reporting

The system SHALL generate test coverage reports.

#### Scenario: Coverage report generation

- **WHEN** test suite runs with coverage flag
- **THEN** system generates coverage report showing line, branch, and function coverage

#### Scenario: Coverage thresholds

- **WHEN** coverage falls below configured threshold
- **THEN** system warns but does not fail the build
