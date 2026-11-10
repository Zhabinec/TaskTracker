# TaskTracker local 1.0.0-rc.1

The local application is a release candidate. It supports offline project/task
management without an account. Cloud Workspace/synchronization is a separate,
unimplemented scope; optional Identity remains independently tested.

## Run and verify

Prerequisites: Node.js 24, Docker with Linux containers, PowerShell. Install locked
frontend dependencies with `npm --prefix frontend ci`, then:

```powershell
.\scripts\Start-Local.ps1
.\scripts\Test-Release.ps1
```

The release check runs lint, TypeScript, unit/storage tests, npm production audit,
a production Docker build, and all browser scenarios. Browser tests run in the
official Playwright Linux image pinned by digest, against the actual frontend
container. This also avoids the Firefox mozglue/SxS startup defect observed in the
Windows browser package. Tests use isolated browser contexts, not your workspace.

To run only a browser matrix against the existing stack:

```powershell
.\scripts\Test-Browsers.ps1
.\scripts\Test-Browsers.ps1 -Browsers chromium,firefox
```

Native `npm run test:e2e` remains available after installing Playwright browsers.
CI installs all three browser engines. Release SHA `83052ef` passed all four
[GitHub jobs](https://github.com/Zhabinec/TaskTracker/actions/runs/42918195830).
The current public deployment is recorded in [the Render runbook](render-release.md).

## Install on a phone with HTTPS

The selected platform is Render; the first physical target is Android. Follow
[the Render deployment and Android checklist](render-release.md). The Blueprint
provisions the local frontend with CI-gated deployment and health checks. The
Caddy setup below remains an optional self-hosted alternative.

On a host reachable from the phone, point a DNS hostname at the host and make
TCP ports 80/443 reachable (UDP 443 is optional for HTTP/3). Set `APP_DOMAIN` to
that hostname, without a scheme or path. Keep the existing generated `.env`.

```powershell
$env:APP_DOMAIN = 'tasks.your-domain.example'
docker compose -f compose.yaml -f compose.https.yaml up --build --wait
```

The optional Caddy proxy acquires/renews certificates and redirects HTTP to HTTPS.
Its configuration and Compose overlay were validated; a live certificate/domain
has not been provisioned. See [Caddy automatic HTTPS](https://caddyserver.com/docs/automatic-https).

Open the HTTPS address, create the local space and wait for Offline ready. Install
from the browser's Add to Home Screen / Install action. Confirm offline reload and
backup import/export on the physical phone before accepting the public release.

Online work can start while the shell is preparing. First-install failure is
retried once within the same 25-second startup budget; persistent failure shows
Retry offline setup. Readiness requires an activated worker controlling the page,
not just a registration or a partially populated cache. Each installation has an
isolated cache and verifies every required page/asset before activation. Navigation
reuses a same-build worker rather than creating another installation. A waiting app update still
requires explicit Update and a successful draft flush.

Each origin/browser has its own data. Moving from localhost to the HTTPS hostname
requires Export backup on the old origin and Import backup on the new one. Import
adds independent copies; it does not synchronize devices. Unfinished drafts are
local and are not part of the JSON backup.

## Update and recover

Export a backup before changing deployment or clearing site data. Build and restart
the frontend; use Update when the installed PWA offers it. Updates flush drafts
before activation. Saved project/task data is independent of the shell cache.

IndexedDB v3 migrates v1/v2 forward without removing data. Backup format v2 retains
project archive state and descriptions; legacy v1 backups are accepted. Downgrading
to an older app that only opens IndexedDB v1/v2 is unsupported. For rollback, retain
a build that understands v3 or restore/export data through this candidate first.
Do not delete browser storage or Docker volumes as an update step.

## Public release acceptance

Software checks are recorded in [verification.md](verification.md). Physical
Android installation, touch/accessibility text scaling, public TLS and actual
deployment upgrade/rollback require their respective environments. Those checks
are not replaced by desktop browser emulation. Until they are signed off, keep the
`rc` version designation. Direct dependency/font notices: [dependency-notices.md](dependency-notices.md).
