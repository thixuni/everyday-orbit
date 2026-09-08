# Everyday Orbit

A personal planner: calendar, task board, Eisenhower matrix, routines and notes.
Five views over one set of tasks, sharing one set of categories that work like
calendar layers.

Everything is stored on your own computer. There is no account and no server.

**[Download the latest release](https://github.com/thixuni/everyday-orbit/releases/latest)** ·
[Download page](https://thixuni.github.io/everyday-orbit/)

---

## Running it

```bash
npm install
npm start
```

`npm start` opens the Electron app, which loads `src/index.html` directly. There
is no bundler and no compile step.

To open it in a browser instead:

```bash
node scripts/serve.js
```

Then visit <http://localhost:4173>.

## The commands

| Command | What it does |
| --- | --- |
| `npm start` | Run the desktop app |
| `npm test` | Run the checks in `test/` |
| `npm run build:html` | Inline `src/` into `dist/everyday-orbit.html` |
| `npm run check` | Build the single file, then test |
| `npm run build` | Build installers into `release/` |

## Layout

```
src/index.html   Page shell, the SVG icon sprite, and the app markup
src/app.css      Every style. All colours are tokens on :root
src/app.js       The whole application, in one IIFE
main.js          Electron shell: window, menu, backup/restore, updates
scripts/         build-standalone.js (the single file), serve.js (dev server)
test/            Guards for the conventions in CLAUDE.md
docs/            The download page, served by GitHub Pages
build/           App icons and macOS entitlements
```

`dist/` and `release/` are build output and are not committed.

## Two ways it ships

**The desktop app** is what most people should use. It installs properly, gets a
Start menu entry, and updates itself from GitHub Releases.

**The single file** — `dist/everyday-orbit.html` — is the whole planner inlined
into one HTML file that runs by double-clicking it, with no install. It is
attached to every release. `scripts/build-standalone.js` produces it, and
`npm test` checks that it stays genuinely self-contained.

## Cutting a release

1. Bump `version` in `package.json`.
2. Commit, then tag and push:

   ```bash
   git tag v1.1.0
   git push origin v1.1.0
   ```

3. The **Build installers** workflow runs the checks, builds on real Windows,
   macOS and Linux machines, and publishes a GitHub Release with the installers,
   the single-file build, and the `latest.yml` metadata that installed copies
   read when they check for updates.

Pressing **Run workflow** on the Actions tab builds without publishing, which is
the way to test a change to the pipeline.

## Updates

Installed copies check for a new version on launch and every six hours, download
it in the background, and offer to restart. Updating never touches planner data.

Auto-update only works in the installed build. The portable `.exe`, the
AppImage and `npm start` all skip it — **Help ▸ Check for updates** says so
rather than failing quietly. Set `EVERYDAY_ORBIT_NO_UPDATE=1` to turn the check
off entirely.

## Code signing

The build works without certificates and produces unsigned installers. Windows
then shows a SmartScreen warning, and macOS asks the user to right-click and
choose Open. To sign, add repository secrets — the workflow already reads them:

| Secret | For |
| --- | --- |
| `CSC_LINK` | The certificate, base64-encoded (`.pfx` on Windows, `.p12` on macOS) |
| `CSC_KEY_PASSWORD` | Its password |
| `APPLE_ID`, `APPLE_APP_SPECIFIC_PASSWORD`, `APPLE_TEAM_ID` | macOS notarisation |

For notarisation, also set `"notarize": true` under `build.mac` in
`package.json`. Leave it off until the Apple credentials are in place, or the
macOS build will fail.

Costs, roughly: an OV Windows certificate is 200–400 USD a year (EV clears
SmartScreen immediately, and costs more); the Apple Developer Programme is
99 USD a year.

## Backups

**File ▸ Back up planner** writes a `.json` file and **File ▸ Restore from
backup** reads one back. That is also how you move a planner to another
computer. In the browser build the same two actions are the download and upload
icons at the bottom of the sidebar.

## Contributing to the code

Read [CLAUDE.md](CLAUDE.md) first — it documents the conventions that are not
obvious from reading the source, several of which exist because breaking them
fails silently. `npm test` enforces the ones that can be checked mechanically.
