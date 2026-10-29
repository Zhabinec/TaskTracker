# TaskTracker development

Read `docs/architecture.md` before changing service boundaries or persistence.
Read `docs/ui-design.md` before UI changes. Preserve the agreed English, minimal
glass interface and Plus Jakarta Sans / Inter font pairing.

For UI work, apply the installed `ui-ux-pro-max` and `shadcn` agent skills when
available. Consult Astryx's official documentation for design tokens and interaction
patterns. Skill availability does not imply that a component runtime is installed;
inspect `frontend/package.json` and existing components before adding dependencies.

Keep offline operation and IndexedDB version checks working. Test persistence
changes with fake-indexeddb and user interactions with production-browser E2E tests.
Use meaningful English Conventional Commits, grouped by completed change.
