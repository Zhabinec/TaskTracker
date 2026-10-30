# Dependency notices

Inventory of direct runtime dependencies and distributed font/build assets, read from
installed package metadata for local 1.0.0-rc.1. Exact transitive versions are in
`frontend/package-lock.json`. Original package notices remain authoritative.

| Package | Version | Declared license | Use |
|---|---|---|---|
| next | 16.4.3 | MIT | runtime |
| react | 19.3.1 | MIT | runtime |
| react-dom | 19.3.1 | MIT | runtime |
| server-only | 0.0.1 | MIT | runtime |
| @fontsource-variable/inter | 5.3.0 | OFL-1.1 | build/assets |
| @fontsource-variable/plus-jakarta-sans | 5.3.0 | OFL-1.1 | build/assets |
| sharp | 0.35.5 | Apache-2.0 | build/assets |

The PWA preparation step copies both font license files into `public/fonts/` beside
the self-hosted WOFF2 files. Containers use official Node.js/PostgreSQL/Caddy images;
their bundled notices remain with their upstream images. Test browsers are confined
to development/test tooling and are not bundled in the application.
