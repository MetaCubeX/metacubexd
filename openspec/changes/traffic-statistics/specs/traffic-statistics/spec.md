## ADDED Requirements

### Requirement: Traffic data persistence

The system SHALL persist traffic usage data for historical analysis.

#### Scenario: Record traffic data

- **WHEN** traffic data is received from WebSocket
- **THEN** system accumulates and stores upload/download bytes periodically

#### Scenario: Aggregate hourly data

- **WHEN** a new hour begins
- **THEN** system aggregates the previous hour's traffic and stores as hourly record

#### Scenario: Aggregate daily data

- **WHEN** a new day begins
- **THEN** system aggregates the previous day's traffic and stores as daily record

### Requirement: Traffic statistics view

The system SHALL provide traffic statistics visualization on the Overview page.

#### Scenario: View daily statistics

- **WHEN** user selects "Daily" view
- **THEN** system displays a bar chart showing upload/download for each day of the current month

#### Scenario: View weekly statistics

- **WHEN** user selects "Weekly" view
- **THEN** system displays a bar chart showing upload/download for each week

#### Scenario: View monthly statistics

- **WHEN** user selects "Monthly" view
- **THEN** system displays a bar chart showing upload/download for each month of the current year

### Requirement: Traffic trend chart

The system SHALL display traffic usage trends.

#### Scenario: Show trend line

- **WHEN** viewing statistics
- **THEN** system overlays a trend line showing usage pattern over time

#### Scenario: Show total summary

- **WHEN** viewing any statistics view
- **THEN** system displays total upload, total download, and total combined for the selected period

### Requirement: Traffic data export

The system SHALL allow exporting traffic statistics.

#### Scenario: Export as CSV

- **WHEN** user clicks "Export" button
- **THEN** system downloads a CSV file with columns: date, upload, download, total

### Requirement: Statistics widget

The system SHALL provide a statistics summary widget on the Overview page.

#### Scenario: Display today's usage

- **WHEN** user views Overview page
- **THEN** system displays today's upload/download totals in a summary card

#### Scenario: Display monthly usage

- **WHEN** user views Overview page
- **THEN** system displays current month's upload/download totals in a summary card

### Requirement: Data retention

The system SHALL manage statistics data retention.

#### Scenario: Automatic cleanup

- **WHEN** monthly data exceeds 12 months
- **THEN** system removes the oldest monthly records

#### Scenario: Clear all statistics

- **WHEN** user clicks "Clear Statistics" and confirms
- **THEN** system removes all traffic statistics data
