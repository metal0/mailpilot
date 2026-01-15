# Changelog

All notable changes to Mailpilot will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [1.7.0] - 2025-01-15

### Added
- **Connection Blocker Overlay**: Dashboard now shows a blocking overlay when the server is unreachable
  - Appears after 3 seconds when both API and WebSocket are down
  - Appears after 30 seconds when only WebSocket is down
  - Auto-dismisses when connection is restored
  - Prevents user interaction while disconnected

### Changed
- **Settings Reorganization**: Merged Antivirus and Attachments tabs into a single "Modules" tab for cleaner navigation
- **Light Theme**: Toned down brightness with softer off-white colors for reduced eye strain
- **Settings Header**: Removed config.yaml path display from settings header

### Fixed
- **Account Pause/Resume**: Status now updates dynamically via WebSocket without requiring page refresh

### Documentation
- Added database schema documentation (`docs/database.md`)

## [1.6.4] - Previous Release

Initial tracked version.
