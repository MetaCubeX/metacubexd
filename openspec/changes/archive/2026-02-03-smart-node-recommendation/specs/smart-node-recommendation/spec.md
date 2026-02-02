## ADDED Requirements

### Requirement: Batch latency testing

The system SHALL provide batch latency testing for all nodes in a proxy group.

#### Scenario: Test all nodes in group

- **WHEN** user clicks "Test All" button on a proxy group
- **THEN** system tests latency for all nodes in that group concurrently (max 10 parallel)

#### Scenario: Show testing progress

- **WHEN** batch testing is in progress
- **THEN** system displays a progress indicator showing completed/total nodes

#### Scenario: Test all groups

- **WHEN** user clicks "Test All Groups" button
- **THEN** system tests all nodes across all proxy groups

### Requirement: Node scoring

The system SHALL calculate a performance score for each node based on multiple metrics.

#### Scenario: Calculate node score

- **WHEN** latency test completes for a node
- **THEN** system calculates score: 50% latency + 30% stability + 20% success rate

#### Scenario: Display node score

- **WHEN** a node has been tested
- **THEN** system displays the score (0-100) on the node card

#### Scenario: Score color coding

- **WHEN** displaying node score
- **THEN** system uses green (80-100), yellow (50-79), red (0-49) color coding

### Requirement: Smart node recommendation

The system SHALL recommend the best node in each proxy group.

#### Scenario: Show recommended badge

- **WHEN** viewing a proxy group with tested nodes
- **THEN** system displays a "Recommended" badge on the highest-scoring available node

#### Scenario: Quick switch to recommended

- **WHEN** user clicks "Switch to Recommended" button on a proxy group
- **THEN** system switches the active node to the recommended node

#### Scenario: Auto-switch option

- **WHEN** user enables "Auto-switch to recommended" setting
- **THEN** system automatically switches to recommended node after batch testing

### Requirement: Node performance history

The system SHALL track historical performance data for nodes.

#### Scenario: Store test results

- **WHEN** a latency test completes
- **THEN** system stores the result (timestamp, latency, success) keeping last 20 records per node

#### Scenario: Show performance trend

- **WHEN** user hovers over a node
- **THEN** system displays a mini chart showing recent latency trend

#### Scenario: Show last test time

- **WHEN** viewing a node
- **THEN** system displays time since last test (e.g., "5 min ago")

### Requirement: Recommendation settings

The system SHALL allow users to configure recommendation parameters.

#### Scenario: Configure score weights

- **WHEN** user opens recommendation settings
- **THEN** user can adjust latency/stability/success rate weight percentages

#### Scenario: Configure test interval

- **WHEN** user opens recommendation settings
- **THEN** user can set minimum interval between batch tests

#### Scenario: Exclude nodes from recommendation

- **WHEN** user marks a node as "excluded"
- **THEN** system never recommends that node regardless of score
