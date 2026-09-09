# Everyday Orbit

A personal planner desktop app. Electron shell around a single-page web app.

## Layout

```
main.js            Electron main process: windows, menu, vault sync, updates
preload.js         The only bridge to the shell; exposes window.orbit
src/index.html     Page shell, SVG icon sprite, app markup
src/timer.html     The floating timer window (desktop only)
src/app.css        Every style; all colours are tokens on :root
src/app.js         The whole application, in one IIFE
scripts/           build-standalone.js, serve.js
test/              Convention guards, run by npm test
build/             icon.ico, icon.png, entitlements.mac.plist
docs/              The GitHub Pages download page
package.json       Dependencies plus the electron-builder config
```

**There is no bundler and no compile step.** Electron loads `src/index.html`
directly. `npm run build:html` inlines the three sources into
`dist/everyday-orbit.html`, a single file that runs from a double-click. Keep it
that way unless there is a strong reason not to.

## Running it

```
npm install          # first time only
npm start            # launch the desktop app
node scripts/serve.js  # or open it at http://localhost:4173 in a browser
npm test             # run the checks
npm run build        # produce installers into release/
```

## How the app is organised

`src/app.js` reads top to bottom; the sections are marked with comment banners.

### State

A single module-level object `S` holds all data:

```js
S = { categories, tasks, routines, notes, completions, prefs,
      activity, docs, sessions }
```

`KEYS` lists those nine names. Anything that changes data must call
`save("<key>")`, which writes to `localStorage` and, when the page is running as
a published Claude artifact, to a cloud store. `touched[key]` guards against a
slow cloud read overwriting a local edit; do not remove it.

`V` holds view state (current view, calendar anchor date, filters, search) and is
deliberately not persisted.

### Rendering

Rendering is full innerHTML replacement, no virtual DOM:

- `render()` redraws rail, top bar and view. Call after any data change.
- `renderView()` redraws only the viewport. Call for filter and search changes so
  the search box keeps focus.

Each view is a function returning an HTML string: `viewCalendar`, `viewBoard`,
`viewList`, `viewMatrix`, `viewRoutines`, `viewNotes`, `viewTime`.

The task detail panel is a **second root**, `#sheetRoot`, drawn by
`renderSheet()`. `render()` deliberately does not touch it, because a redraw
while someone is typing in it would throw the caret away — so anything that
changes a task from outside the panel must call `renderSheet()` itself.
The panel has no save button: `patchTask()` commits on `change`, which is why
text fields pass `redraw:false`.

### Events

One delegated `click` listener on `document` reads `data-act` from the closest
ancestor and switches on it. To add a control, give it `data-act="thing"` plus
any `data-id` / `data-date` it needs, then add a `case "thing":`. The whole
switch is wrapped in try/catch that surfaces the error in a toast.

Form inputs are the exception: `data-act="f"` is handled in the `change`
listener, not the click switch. `npm test` knows about both.

### Activity, documents and time

`logAct(taskId, kind, text, meta)` appends to `S.activity`; `logChanges()`
diffs a task before and after an edit and writes one entry per changed field.
Keep `FIELD_LABEL` in step with the fields a task has, or changes go unlogged.

Documents are markdown in `S.docs`. On the desktop each one is mirrored into
`<vault>/Everyday Orbit/<title> <id>.md` with YAML front matter carrying
`orbit-id`, which is how an edit made in Obsidian finds its way back to the
right document. The loop is broken on both sides: the main process ignores
file events for two seconds after its own write, and `applyVaultChange()`
never writes back to the vault.

Time tracking stores one `S.sessions` row per run. A task total is always
summed from those rows, never cached on the task. The timer in flight lives in
`prefs.running` so it survives a reload, and it is paused rather than resumed
on start-up, so a timer left running overnight does not bank the hours.

## Conventions that exist for a reason

- **Icons and labels inside a clickable row need `pointer-events: none`.** Clicks
  landing on an inner SVG were breaking the category toggles.
- **Never use `confirm()`, `prompt()` or `alert()`.** They are blocked when the
  page runs inside the artifact sandbox and fail silently. Destructive actions use
  `arm(button, label)`, which requires a second click. The note editor's link
  button uses an inline bar, not a prompt.
- **Never hardcode a colour in a rule.** Every colour is a token on `:root`,
  including `--on-accent` (text on a filled colour) and `--tint-base` (what
  `color-mix()` mixes a category colour toward). A test enforces this.
- **Downloads**: `exportData()` tries the artifact `downloads` capability first,
  then falls back to a blob link. Both paths must keep working.
- **Dates** are `YYYY-MM-DD` strings in local time throughout. Use the helpers
  `ymd`, `parseD`, `addDays`, `startOfWeek`. Weeks start on Monday.
- **Eisenhower quadrant** is derived, never stored. `urgent` and `important` are
  `true`, `false` or `null`; both must be non-null for a task to enter a quadrant.
- The planner ships with **no personal data**. `blankState()` is the default and
  `sampleState()` is the optional demo content offered on first run. Do not seed
  real tasks into the file — a test checks for this.

### Responsive behaviour

Three widths. Above 1080px the rail is full width. Between 821 and 1080 it
collapses to icons. At 820 and below it becomes a drawer over the view, toggled
by `data-act="rail"`, which adds `rail-open` to `<body>`; `closeRail()` clears it
when a nav item is picked.

Only one rule ever sets the rail's transform — `body:not(.rail-open) .rail` —
rather than a base rule plus an override. Keep it that way; it is easier to reason
about and avoids a cascade fight.

## Desktop-only features

The floating timer needs a second always-on-top window and the vault sync needs
a real filesystem, so both live behind `window.orbit` from `preload.js`.
`hasDesktop()` gates the UI: in a browser those controls are hidden or say
plainly that they need the desktop app. Never let a `window.orbit` call run
unguarded — the browser build is not a degraded mode, it is the common one.

`ipcMain.on("timer:state")` carries traffic **both** ways on one channel: a
payload with `cmd` is a button press on the floating window heading for the
planner, anything else is state heading for the widget.

## The two places this code runs

The same sources are both the desktop app and a published Claude artifact
(a hosted web page). Code must degrade gracefully when `window.claude` is absent,
which is the desktop and plain-browser case. Test a change in both if it touches
saving, downloads or dialogs.

## Gotcha when testing in a headless or hidden browser pane

CSS transitions do not advance while the pane is hidden, so a transitioning
property reads as stuck at its start value and `getComputedStyle` lies about it.
Check `element.getAnimations()` before concluding a rule is broken, or measure
with `style.transition = "none"`.

## Version numbers

Three parts, `1.2.3`. Only the last two move:

- **Ordinary work** — a fix, a refinement, a small addition — bumps the last
  number. 1.1.2, 1.1.3, 1.1.4, and so on.
- **A major change** — a new view, a feature people would notice and talk
  about — bumps the middle number and resets the last to zero: 1.2.0.

Bump it when the work lands, not only when it is released. The number is how
an installed copy decides whether a build is newer than the one it is running,
so two different builds must never share one.

## Releasing

Bump `version` in `package.json`, then push a `v*` tag. The workflow runs the
checks, builds on all three platforms, and publishes a release with the
installers, the single-file build, and the `latest.yml` metadata that
electron-updater reads. See README.md for code signing.

## Worth doing next

- Code signing certificates, so the SmartScreen and Gatekeeper warnings go away.
- Widen `test/` beyond convention guards — there is no coverage of the date
  helpers, recurrence logic or filtering, which is where the real logic lives.
