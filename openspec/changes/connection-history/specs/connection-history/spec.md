## ADDED Requirements

### Requirement: Connection history storage

The system SHALL persist closed connection records to local storage for later review.

#### Scenario: Save closed connection

- **WHEN** a connection is closed (removed from active connections)
- **THEN** system saves the connection metadata to IndexedDB

#### Scenario: Store connection metadata

- **WHEN** saving a connection to history
- **THEN** system stores: id, host, destinationIP, network, type, chains, start time, end time, upload bytes, download bytes

### Requirement: Connection history viewing

The system SHALL provide a way to view historical connections.

#### Scenario: Access history tab

- **WHEN** user is on the Connections page
- **THEN** system displays tabs for "Active" and "History" connections

#### Scenario: View history list

- **WHEN** user clicks on "History" tab
- **THEN** system displays a paginated table of closed connections sorted by end time (newest first)

### Requirement: History filtering

The system SHALL allow filtering historical connections by various criteria.

#### Scenario: Filter by time range

- **WHEN** user selects a time range filter (today, last 7 days, last 30 days, custom)
- **THEN** system displays only connections within that time range

#### Scenario: Filter by host

- **WHEN** user enters a hostname in the search box
- **THEN** system displays only connections matching that hostname

#### Scenario: Filter by network type

- **WHEN** user selects a network type filter (TCP, UDP)
- **THEN** system displays only connections of that network type

### Requirement: History data export

The system SHALL allow exporting connection history data.

#### Scenario: Export as CSV

- **WHEN** user clicks "Export CSV" button
- **THEN** system downloads a CSV file containing the filtered connection history

#### Scenario: Export as JSON

- **WHEN** user clicks "Export JSON" button
- **THEN** system downloads a JSON file containing the filtered connection history

### Requirement: History capacity management

The system SHALL manage storage capacity to prevent unlimited growth.

#### Scenario: Automatic cleanup

- **WHEN** history records exceed the configured limit (default: 10000 records or 7 days)
- **THEN** system automatically removes the oldest records

#### Scenario: Configure retention settings

- **WHEN** user opens history settings
- **THEN** user can configure maximum record count and retention days

#### Scenario: Manual clear history

- **WHEN** user clicks "Clear History" button and confirms
- **THEN** system removes all connection history records
