# Project review — 2026-11-10

## Current state

Local 1.0.0-rc.1 supports projects, rename/archive/restore, task editing,
descriptions, explicit statuses, batch operations, moves, search, due filters,
pagination, recoverable drafts, JSON backups and production offline operation.
Identity is optional. Cloud Workspace and synchronization are unimplemented.

The agreed English glass UI and Jakarta/Inter pairing remain in place. The app
uses native controls and CSS Modules; shadcn and Astryx are guidance sources, not
installed component runtimes. No library migration is needed to complete this RC.

## Fresh evidence

- Frontend lint and TypeScript passed; 41 unit/storage tests in 9 files passed.
- Existing production Docker frontend started and became healthy.
- Isolated installed Edge browser: entered local workspace, created a project and
  task, inspected desktop 1440px and mobile 390px layouts. No horizontal overflow
  in that mobile state. Review data did not touch the user's browser profile.
- Native bundled Playwright Chromium was unavailable. Installed Edge was used for
  this smoke review; this does not replace the full three-engine E2E matrix.
- GitHub origin is configured. Remote workflow results were not inspected.
- UI/UX Pro Max keyboard/focus guidance and Astryx official CLI token/rubric docs
  consulted. Astryx component catalog could not load from the package registry;
  no claims of component API or runtime verification are made.

The previous 66 browser and 24 backend test results remain historical evidence in
verification.md; those suites were not rerun in this review.

## Recommended next work, in order

1. Fix misleading no-op move feedback. `TaskList.change` reports its requested
   count/status after `moveTasks` skips same-project rows. `taskChanged` can then
   report a status save although no status changed. Exclude the source from bulk
   destinations or explicitly report no change. Cover the browser interaction.
2. Improve mobile task access. The full project sidebar appears before the board;
   in the reviewed 390px one-project state the first task starts below the initial
   viewport. Make project selection compact on mobile. Preserve clear creation,
   archive and backup access without adding explanatory copy.
3. Complete mobile control sizing. Measured targets below the project's 44x44
   guideline include Create project (42px wide), All (33px wide), task-notice close
   (24px wide), runtime close (29x31px), and the profile link (36px high).
   Runtime notices are fixed overlays: verify focused controls stay visible with
   notices, the software keyboard and safe-area insets.
4. Retain useful progress on narrow screens. `local.module.css` hides `.right`
   below 1100px, removing completed/total and percentage. Provide a compact board
   summary rather than another large mobile panel.
5. Improve recovery/navigation. Workspace startup errors have no explicit retry;
   the project-picker error asks to reopen the form. Project/status state is in
   sessionStorage, not the URL, so browser Back and bookmark links do not restore
   individual views. Prioritize retry first; URL state is a product improvement.
6. Consolidate existing CSS semantic tokens and standardize status, due and batch
   controls. Literal colors and repeated sizes remain across local.module.css;
   preserve the established appearance rather than installing multiple UI stacks.
7. Finish release acceptance: check GitHub CI, public HTTPS and update/rollback,
   then physical Android/iOS installation, offline lifecycle and text scaling.

Docker live reload remains a separate developer-experience improvement: current
Compose runs production output without a source bind mount or watch configuration.
Cloud Workspace/sync is a future release, not a prerequisite for this local RC.
