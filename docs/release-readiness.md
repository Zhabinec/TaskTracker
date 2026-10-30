# Local release: use cases and acceptance

The current build is local 1.0.0-rc.1, pending physical-device and deployment acceptance. The first release
is an offline single-device workspace. Cloud identity, Workspace service and sync
have a separate release scope; a browser profile is never a cloud credential.

## Task workflows

| Situation | Expected behavior | Current implementation |
|---|---|---|
| Add planned work | Choose To do and optional due date | Single-task composer |
| Log work already completed | Choose Done before adding; progress updates immediately | Single and batch composer; completion recorded at insertion time |
| Log work already underway | Choose In progress directly | No mandatory intermediate states |
| Add several tasks | One nonempty line per task; shared status/date; all saved together | Up to 100 per batch; duplicate titles represent distinct tasks |
| Switch single/batch mode | Keep each draft independently | Saved locally; submitting one retains the other atomically |
| Change status | Choose the destination by name | Explicit select; circular status button removed |
| Item leaves active filter | Explain destination and offer navigation | Persistent notice with View destination |
| Edit title/date/status | Explicit Save; Cancel/Escape leaves stored data intact | Version-checked transaction |
| Select several tasks | Selection mode, count, destination, Apply | Up to 100 loaded tasks; never implies all unloaded tasks |
| One selected task changes in another tab | Fail the entire action; no partial writes | Expected version checked for every task |
| Reopen Done work | Clear completion timestamp and decrement progress once | All non-Done destinations supported |
| Delete one/several tasks | Confirm scope before permanent deletion | Cancel, Escape and explicit Delete permanently |
| Go offline or reload | Keep committed data and cached shell | Production PWA tests |
| Download backup | Export one consistent snapshot with every project/task | Explicit bounded full export, not normal list loading |
| Restore or transfer backup | Validate, preview counts, confirm, add independent copies | New IDs, remapped project links, recomputed counters; existing data kept |
| Invalid backup | Reject before any write | Version, fields, IDs, references, dates and completion validation |
| Navigate/reload with unfinished input | Recover project/task creation and edits | Versioned IndexedDB drafts; current-tab form pointers and view restored |
| Close the original tab | Find saved work in a new tab | Project drafts / Saved drafts → Resume |
| Shared draft changes elsewhere | Keep both texts | Reject stale autosave; Keep my copy creates a new draft |
| Original task was changed/deleted | Preserve the edit; prevent stale overwrite | Original version retained; Add as new task recovers the text |
| Cancel an edit | Remove the saved draft and leave task unchanged | Cancel/Escape; reopening starts from the current task |
| Storage rejects autosave | Retain text and show retry | In-memory controller, beforeunload guard, Retry/Keep my copy |
| Install an app update | Flush drafts before activation | Update waits; failed flush prevents activation |

Backup limits: 5 MiB per file, 1,000 projects, 20,000 tasks. Exceeding a limit is
an explicit error; export never silently truncates. Files contain project/task data
as plain JSON. Profile settings and unfinished drafts are not imported. Duplicate imports intentionally
create additional copies; this is not a merge or automatic synchronization.

## Implemented in the local release candidate

- Project rename (with recoverable draft and version conflict checks), archive and
  restore. Archive keeps tasks/drafts; task mutations require restoration first.
- Descriptions up to 5,000 characters. Individual and selected-task moves preserve
  status, completion time and exact counters in both projects; stale batches roll back.
- Search in titles/descriptions, local-calendar due filters and cursor pagination.
  Selected projects are pinned through direct lookup even beyond the loaded list.
- IndexedDB v1/v2→v3 migration, legacy/v2 backups, empty and 1,000-task backup round
  trips, import-write rollback and storage-failure recovery tests.
- Pinned, repeatable Chromium/Firefox/WebKit container checks; updated CI matrix,
  production dependency audit and direct dependency/font notice inventory.
- Validated optional Caddy HTTPS configuration and [release runbook](release.md).

## Required acceptance outside this checkout

1. Physical iOS/Android installed PWA lifecycle, touch targets and accessibility text
   scaling. Recovery cannot be promised after forced OS termination while storage
   rejects writes.
2. A real DNS hostname/server, working public TLS, phone installation and rehearsal
   of the production update/rollback procedure with existing data.
3. Connect a Git remote and run the prepared CI jobs there. No remote is configured;
   local verification does not establish remote CI success.

The candidate can be tested locally now. Public 1.0 requires these environmental
checks; cloud Workspace/sync remains a separately scoped future release.
