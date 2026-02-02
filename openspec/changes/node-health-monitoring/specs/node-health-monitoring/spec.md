## ADDED Requirements

### Requirement: Automated health check

The system SHALL perform automated health checks on proxy nodes at configurable intervals.

#### Scenario: Periodic health check

- **WHEN** health monitoring is enabled
- **THEN** system tests active nodes at the configured interval (default: 5 minutes)

#### Scenario: Check on page load

- **WHEN** user opens the Proxies page with monitoring enabled
- **THEN** system performs an initial health check of active nodes

#### Scenario: Pause when tab hidden

- **WHEN** browser tab is hidden for extended period
- **THEN** system pauses health checks to conserve resources

### Requirement: Node health status display

The system SHALL display health status indicators on nodes.

#### Scenario: Show healthy status

- **WHEN** node responds within normal threshold (< 2000ms)
- **THEN** system displays green health indicator

#### Scenario: Show warning status

- **WHEN** node responds but exceeds warning threshold (2000-5000ms)
- **THEN** system displays yellow health indicator

#### Scenario: Show unhealthy status

- **WHEN** node fails to respond or exceeds timeout (> 5000ms)
- **THEN** system displays red health indicator

#### Scenario: Show unknown status

- **WHEN** node has not been checked yet
- **THEN** system displays gray health indicator

### Requirement: Health monitoring panel

The system SHALL provide a dedicated health monitoring panel.

#### Scenario: View monitoring panel

- **WHEN** user clicks "Health Monitor" button on Proxies page
- **THEN** system displays a panel showing all monitored nodes with their status

#### Scenario: Show uptime statistics

- **WHEN** viewing monitoring panel
- **THEN** system displays uptime percentage for each node over the last 24 hours

#### Scenario: Show status timeline

- **WHEN** viewing monitoring panel
- **THEN** system displays a timeline showing status changes for each node

### Requirement: Health alert notifications

The system SHALL send notifications when node health changes.

#### Scenario: Request notification permission

- **WHEN** user enables health monitoring for the first time
- **THEN** system requests browser notification permission

#### Scenario: Notify on node down

- **WHEN** active node fails health check for 2 consecutive times
- **THEN** system sends browser notification: "Node [name] is down"

#### Scenario: Notify on node recovery

- **WHEN** previously down node passes health check
- **THEN** system sends browser notification: "Node [name] has recovered"

#### Scenario: In-app alert fallback

- **WHEN** notification permission is denied
- **THEN** system displays in-app toast alerts instead

### Requirement: Health check configuration

The system SHALL allow users to configure health monitoring settings.

#### Scenario: Configure check interval

- **WHEN** user opens health monitoring settings
- **THEN** user can set check interval (1-60 minutes)

#### Scenario: Configure thresholds

- **WHEN** user opens health monitoring settings
- **THEN** user can set warning threshold and timeout threshold in milliseconds

#### Scenario: Enable/disable monitoring

- **WHEN** user toggles monitoring switch
- **THEN** system starts or stops automated health checks

#### Scenario: Select nodes to monitor

- **WHEN** user opens monitoring settings
- **THEN** user can select which nodes to include in health monitoring

### Requirement: Health history tracking

The system SHALL track node health history.

#### Scenario: Store health check results

- **WHEN** health check completes
- **THEN** system stores result (timestamp, status, latency) keeping last 24 hours

#### Scenario: Calculate uptime

- **WHEN** viewing node health history
- **THEN** system calculates and displays uptime percentage based on stored results

#### Scenario: Export health report

- **WHEN** user clicks "Export Report" button
- **THEN** system downloads a health report with node statistics and timeline
