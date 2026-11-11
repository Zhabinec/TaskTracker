# Telegram Mini App

The selected distribution channel is [@TaskTrackerPetBot](https://t.me/TaskTrackerPetBot).
The first version launches the existing HTTPS application inside Telegram using a
Web App menu button. Tasks remain local to that Telegram WebView. No bot process,
webhook, polling worker, database or Telegram identity is required for this launcher.

## Configure the menu

Copy `deploy/.env.telegram.example` to `deploy/.env.telegram.local` and put the bot
token from BotFather in the local file. The local file is ignored by Git and sits
outside the frontend Docker context. Do not put tokens in chat, frontend variables,
Render frontend environment, command arguments or screenshots.

From the repository root with Node 24:

```powershell
node --env-file=deploy/.env.telegram.local scripts/telegram-menu.mjs
node --env-file=deploy/.env.telegram.local scripts/telegram-menu.mjs --apply
```

The first command reads bot identity and the default menu, then shows the planned
change. The second checks the public app's readiness, sets Open app for all private
bot chats and reads the menu back. A mismatched bot username blocks mutation.
Repeated application is idempotent. Neither command sends chat messages or changes
webhooks, commands, bot descriptions or administrator rights. Previously configured
per-chat menu overrides are independent of the default button.

## Main Mini App in the profile

For the profile Launch app button, configure the Main Mini App in BotFather:
`/mybots` → `@TaskTrackerPetBot` → Bot Settings → Configure Mini App → Enable Mini App.
Use `https://tasktracker-7wc0.onrender.com/login`. BotFather labels may vary by
client. After this is enabled, `https://t.me/TaskTrackerPetBot?startapp` can launch
the main app directly. Do not claim this link works until Main Mini App is enabled.
The configuration script reports `mainMiniAppConfigured` from Telegram's getMe.

The default Open app menu for `@TaskTrackerPetBot` was configured and read back on
November 11, 2026. Telegram reports `has_main_web_app=false`: the separate profile
Launch app button is not enabled. On November 11, the owner confirmed that the
Mini App opened and worked from a phone, and then confirmed task/draft retention
after reopening Telegram. Client/OS versions were not recorded.

Menu launch is separate from the profile Main Mini App setting. Bot API does not
configure that profile setting through setChatMenuButton.

## Current scope and acceptance

- Physical Android PWA installation is removed from the current release gate at
  the owner's request. Browser offline coverage remains; actual Telegram WebView
  launch and close/reopen retention were confirmed by the owner on a phone.
  Keyboard, dialogs and backup transfer still need their own acceptance results.
- Open the bot's menu in Telegram, enter the app, create a project and tasks, then
  close/reopen it. Verify saved tasks and drafts. Test editor Save/Cancel, batch
  actions and an exported/imported backup in the Telegram client being used.
- Browser and Telegram storage can differ even for the same HTTPS origin. Use
  backup export/import to transfer confirmed tasks. No automatic device sync or
  Telegram-account login is implied. Clearing WebView storage removes local data.
- The launcher uses the ordinary responsive application, without a Telegram SDK
  dependency. Native Telegram theme/buttons, fullscreen safe areas and Telegram
  authentication are not implemented. If native bridge features are added later,
  keep them in a separate client adapter and retain normal browser/offline behavior.
- `/login` and `/projects` allow only `https://web.telegram.org` as a frame ancestor
  through CSP. Other responses use `frame-ancestors 'none'`. The previous global
  X-Frame-Options DENY prevented Telegram Web from embedding the app. Native
  Telegram WebViews use a top-level page; the policy does not grant access to local
  data or authorize any server identity.
- Any future server access using Telegram identity must validate signed initData
  server-side; initDataUnsafe and the local profile are not credentials.
- Free Render cold starts and the open WebKit startup finding still apply. An
  installed browser shell may reload offline; a cold Telegram launch without a
  network connection is not guaranteed by browser PWA tests.

Official references: [menu and Main Mini App launch](https://core.telegram.org/bots/webapps#launching-mini-apps-from-the-menu-button),
[setChatMenuButton](https://core.telegram.org/bots/api#setchatmenubutton).
