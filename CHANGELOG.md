# Changelog

## 1.0.0-rc.1 — 2026-10-30

- Local workspace without registration; installable offline shell and bundled fonts.
- Projects with rename, archive/restore, and safe task moves between projects.
- Single/batch task creation in any status, descriptions, due dates, search,
  cursor pagination and selected-task actions with exact progress counters.
- Recoverable creation/edit/rename drafts, cross-tab conflicts, safe app updates
  and explicit confirmation before permanent task deletion.
- JSON backup export/import as independent copies. Version 2 retains descriptions
  and archive state, with compatibility for legacy version 1 backups.
- Reproducible Chromium/Firefox/WebKit checks and optional HTTPS deployment files.
- Fixed Firefox entry blocked by optional storage permission, focus after editing,
  pending draft cancellation during navigation and premature Offline ready status.

Public 1.0 acceptance still requires physical phone checks and a real deployment;
see [the release runbook](docs/release.md).
