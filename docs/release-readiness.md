# Local release: use cases and acceptance

The current build is a local beta, not a finished public release. The first release
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

## Work remaining before public local 1.0

1. **Draft safety device acceptance:** local draft persistence, conflicts, navigation,
   reload, tab recovery and app updates are implemented and covered in Chromium.
   Validate real iOS/Android lifecycle behavior and OS termination. No promise of
   recovery when storage rejects writes and the browser process is forcibly killed.
2. **Project lifecycle:** rename/archive/restore projects, task descriptions and
   moving tasks to another project with exact counters and explicit destination.
3. **Daily use at scale:** search, due/overdue views, stable pagination; ensure a
   selected project stays visible when project order changes beyond the loaded page.
4. **Failure recovery:** browser quota/denied-storage tests, import transaction
   failure tests, empty/large backup round trips and supported schema migration tests.
5. **Browser/device acceptance:** Chromium, Firefox and WebKit automation; real
   Android Chrome and iOS Safari installed PWA, file import/export, keyboard,
   safe areas, accessibility text scaling and multi-tab conflicts.
6. **Release operations:** accessible HTTPS endpoint, installation walkthrough,
   remote CI green, tagged build, license/dependency review, upgrade and rollback
   rehearsal with existing IndexedDB data. No public deployment has been performed.

Each item requires implementation plus evidence. A successful local Chromium test
run does not close physical-device or public deployment acceptance.
