# TaskTracker UI

## Direction

Minimal, calm, light glassmorphism. English interface. Plus Jakarta Sans for headings,
Inter for body and controls; self-hosted fonts also work offline. Preserve user text.
Coral and lavender ambient light, translucent surfaces, clear text and visible focus.
Use the existing CSS variables and CSS Modules; keep client interactions in small RCCs.

## Interaction

- One clear primary action per form. Hide secondary detail until needed.
- Edit tasks inline by selecting the title. Save explicitly; Cancel or Escape discards
  the draft. Return focus to the title after closing. Never overwrite a stale version.
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
