# Render deployment and client acceptance

The local release candidate runs as one Docker web service. Projects, tasks and
drafts stay in browser IndexedDB. Identity/PostgreSQL and the future Workspace
service are not required. No Render disk is needed: container restarts do not
touch device data.

## Current acceptance deployment

- App: [tasktracker-7wc0.onrender.com](https://tasktracker-7wc0.onrender.com).
- Service: `srv-dbpq83gae00c73capcng`, Blueprint `exs-dbpq7r56e07s73b5b5jg`.
- Live automatic deploy: `dep-dbprl1bncjis73ccgki0`, Git commit `6651ea7`.
- Shell build: `1e4e7670-3bda-4419-867d-48d1190105ed`.
- [Release CI](https://github.com/Zhabinec/TaskTracker/actions/runs/42932290143):
  backend, frontend, database and containers all succeeded.

On November 11, public HTTPS smoke checks passed and the app displayed Offline
ready in a fresh production browser. Telegram frame-policy tests also passed
against this public deployment in Chromium, Firefox and WebKit. The owner replaced physical Android PWA
installation with [Telegram Mini App acceptance](telegram.md). Actual Telegram
launch and close/reopen retention were confirmed by the owner on a phone on
November 11. A real A→B→A deployment rehearsal also passed with isolated browser
data, backups, task IDs, drafts and offline reload. See [verification](verification.md) for browser
results, including WebKit startup timeouts during concurrent runs.

## Provision

1. Connect Render to `Zhabinec/TaskTracker` through its GitHub integration. Inspect
   existing services first; update an existing TaskTracker service rather than
   creating another origin and separating installed users from their data.
2. Create a Blueprint from `render.yaml` on `master`. It uses the existing pinned
   Node 24 Dockerfile with context `frontend`, starts its standalone server, and
   checks `/health/ready`. Render supplies `PORT` and terminates HTTPS.
3. The checked-in `free` plan is for client acceptance only. Free services sleep
   after 15 idle minutes and may need about a minute to start. Before public
   production, approve/select paid compute and update `plan` in the Blueprint
   to match. Never silently change an existing paid service to Free.
4. Wait for Live and record the actual HTTPS URL shown by Render; the service name
   does not guarantee an available `tasktracker.onrender.com` hostname.
5. Run `./scripts/Test-Deployment.ps1 -Origin https://ACTUAL-HOST.onrender.com`.
   Record its build identifier, deployed Git SHA and CI run URL. This checks HTTP
   health, uncached worker/build metadata, manifest and shell/font/icon delivery;
   it does not establish browser offline behavior.

`autoDeployTrigger: checksPass` makes subsequent automatic deploys wait for GitHub
checks. Initial creation/manual deploys must separately target a successful CI
commit. A public Git URL without a connected Git provider does not provide this
automatic CI integration. Docker build/start commands come from the Dockerfile;
do not add `npm start`, Caddy, Compose or a database to the Render service.

The November 11 Telegram release did not start automatically after its successful
CI run. Dashboard later showed After CI Checks Pass selected but no connected
Git provider. After the owner connected GitHub and After CI Checks Pass was
restored, `6651ea7` passed CI and went Live with the Auto-Deploy trigger.

`RENDER_EXTERNAL_URL` supplies the default trusted origin for the optional Identity
boundary. Set `APP_ORIGIN=https://your-custom-host` explicitly if a custom domain is
added. Request headers never select the trusted origin. Local UI still performs
no cloud authentication or sync.

Official references: [Docker](https://render.com/docs/docker),
[Blueprint fields](https://render.com/docs/blueprint-spec),
[platform variables](https://render.com/docs/environment-variables),
[CI deployment gating](https://render.com/docs/deploys#integrating-with-ci) and
[Free limitations](https://render.com/docs/free).

## Physical Android acceptance

Optional historical checklist: physical PWA installation is no longer a release
gate. The current target is [the Telegram Mini App](telegram.md).

Use Chrome on an actual Android device outside Incognito. Record phone model,
Android/Chrome versions, URL and build ID. Desktop emulation does not sign off this
checklist. Do not clear site data or uninstall during retention checks.

- Open the HTTPS URL. Create a space, project, one To do task and a batch already
  Done. Wait for Offline ready, then use Chrome's Install app / Add to Home screen.
- Open from the launcher. Check standalone display, editor Save/Cancel, status/date
  changes, project switching and bulk actions. With the keyboard open, in both
  orientations and with enlarged Android font/display size, actions must remain
  reachable, dialogs scroll and no horizontal clipping appear.
- Enable airplane mode and disable Wi-Fi. Close/reopen the installed app, reload,
  create/edit tasks and verify progress. Close/reopen again: saved work must remain.
  Reconnect and check the same records.
- Export a backup through Backups; find the JSON in Android Downloads. Import it,
  check preview counts and confirm independent copies. Existing projects must
  remain. Avoid duplicate imports into a real workspace.
- Run the update/rollback rehearsal below. Record each result as pass/fail with
  build IDs and any screenshot/error; leave it pending until actually run.

Localhost, the Render origin and each device/browser have separate workspaces.
Transfer real tasks with export/import; unfinished drafts are not in the backup.
There is no automatic multi-device synchronization.

## Update and rollback rehearsal

The real public-origin A→B→A rehearsal passed on November 11. To repeat it with
one isolated Chromium context, start the following from the repository root in
the pinned Playwright container used by Test-Browsers.ps1 (mount frontend at /work):

```text
node scripts/rehearse-release.mjs
```

The script waits for operator-triggered deployments and must not run unattended
in CI. REHEARSAL_ORIGIN selects an exact HTTPS origin; REHEARSAL_EXPECTED_BUILD
optionally guards the initial build. It logs A_prepared before a deployment,
B_verified before rollback, and complete only after the original A build returns.
The artifacts in frontend/test-results/render-rehearsal include backups, screenshots
and result.json. Each deployment wait is bounded to about ten minutes.

The script uses the real Update control after reopening/reloading the page; it
never injects a worker build ID. It compares project/task records and IDs, ignoring
only the backup export timestamp, checks both creation drafts and reloads offline.
An identical cached Docker rebuild may retain its build ID and does not establish
an update. A clean rebuild is needed to exercise a distinct shell build.

Use an acceptance workspace on the same stable Render URL and export a backup
first. Retain a successful deployment that understands IndexedDB v3.

1. On build A, create a project/task and leave a recoverable editor draft.
   Record the shell ID from `/build-info.json` while online.
2. Deploy build B after its CI passes. Keep A open during deployment. Verify HTTP
   checks and a different build ID, then reopen/focus the installed app online.
   When Update appears, use it; confirm saved tasks, counters and the resumed draft.
   Repeat offline reload before accepting the update.
3. Disable automatic deploys before rollback. In Render roll back to the retained
   successful deployment A. Re-run HTTP checks with A's recorded build ID using
   `-ExpectedBuild`. Reopen online and accept the offered Update: existing B shell
   caches do not switch just because the server rolled back.
4. Confirm tasks and the recovered draft survive; reload offline again. Do not
   roll back to an app that only understands IndexedDB v1/v2, delete browser
   storage or reset a database as a rollback step.
5. Restore the intended release, repeat acceptance and re-enable After CI Checks
   Pass. Keep URL, Git SHA, build ID and CI/deploy URLs in the acceptance record.

See [deployment controls](https://render.com/docs/deploys) and
[rollback behavior](https://render.com/docs/rollbacks), including plan-dependent
retention. This runbook does not imply live TLS, Android or rollback acceptance.
