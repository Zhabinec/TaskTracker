# TaskTracker UI

## Direction

Minimal, calm, light glassmorphism. English interface. Plus Jakarta Sans for headings,
Inter for body and controls; self-hosted fonts also work offline. Preserve user text.
Coral and lavender ambient light, translucent surfaces, clear text and visible focus.
Use the existing CSS variables and CSS Modules; keep client interactions in small RCCs.

## Interaction

- One clear primary action per form. Hide secondary detail until needed.
- The task card, including its status/date area, opens an Edit task dialog. Show a
  persistent Edit hint and a readable status badge; the badge does not cycle state.
  Title, due date and status are immediately available; description and destination
  stay under More details. Save explicitly; Cancel, the close button or Escape
  discards the edit draft. Reload preserves it for recovery through Saved drafts.
  Keep focus inside the modal and return it to the card after closing. Never
  overwrite a stale version. The background stays inert while the dialog is open.
- Touch actions at least 44 × 44 CSS pixels. Accessible names for icon buttons.
- Prefer native controls and keyboard interaction; never depend on hover alone.
- Keep drafts and errors visible when saving fails. Show progress during writes.
- Respect reduced motion. Animate transform/opacity briefly, without shifting layout.
- On small screens, keep forms within the viewport. No nested glass blur per task.
- Status changes always name the destination. A filter changes the view, not data.
  When a task leaves the filter, explain its destination and provide View.
- Single/batch creation supports every status, including Done. Keep shared batch
  settings visible. Multi-selection names the count and affects only selected rows.
- Confirm irreversible deletion with the affected title/count and a safe Cancel.
- Backup import previews counts and adds copies; it never replaces existing data.
- Autosave creation and edit drafts locally. Show Draft saved only after commit;
  keep incomplete single/batch text independently. Navigation must not discard it.
- Resume keeps the original task version. Save cannot overwrite newer work; offer
  Add as new task on a task conflict, or Keep my copy on a shared-draft conflict.
- Cancel/Escape discards the saved edit as well as its in-memory fields. Discard is
  explicit; reload and app updates preserve drafts. Storage failures retain text,
  show feedback, and guard navigation until retry or deliberate discard.
- Project settings stay secondary. Archive is reversible and preserves work;
  archived tasks are read-only until Restore. Rename drafts keep the original
  project revision so another tab's metadata cannot be silently replaced.
- Moves name their destination and offer View project. Preserve task status/dates;
  update both project counters atomically. Search and due filters change only view.
- Keep phone controls at least 16px to avoid input zoom. Restore keyboard focus
  after the new DOM is committed, rather than guessing a frame delay.
- On phones, keep project selection compact. Manage expands secondary creation,
  archive and backup controls without unmounting drafts; the first-project form is
  available immediately. After creation, return focus to Manage before collapsing.
- Keep completed/total progress available below 1100px as a compact board summary.
  Bulk move feedback uses the committed count; moving to the current project must
  never claim a status change.

## Sources and tools

- [UI/UX Pro Max](https://github.com/nextlevelbuilder/ui-ux-pro-max-skill): installed
  agent skill; use its targeted UX/style searches and verify recommendations against
  this product. Its generic landing-page/teal/Inter-only suggestion was unsuitable;
  the explicit glassmorphism style result matches the agreed direction.
- [shadcn/ui](https://ui.shadcn.com/docs): installed agent skill and CLI reference.
  The current application has no Tailwind or shadcn component configuration.
  Do not claim runtime integration. Adopt components deliberately when their behavior
  is needed; review CLI output and retain the app's fonts and visual direction.
- [Astryx](https://astryx.atmeta.com/docs/getting-started): design-system reference,
  currently beta, with React 19 components and StyleX support. Consult official CLI
  docs for tokens and composition. No Astryx runtime dependency is installed.

These are guidance sources, not three simultaneous component stacks. Introducing a
runtime library needs an actual component use case and bundle/compatibility checks.
