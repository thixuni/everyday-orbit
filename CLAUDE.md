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

Each view is a function returning an HTML string: `viewDashboard`, `viewCalendar`, `viewBoard`,
`viewList`, `viewMatrix`, `viewRoutines`, `viewNotes`.

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

Tracked time is drawn on the calendar rather than summarised elsewhere:
`eventsFor()` returns routines and `S.sessions` rows together, and the week
grid lays them out side by side. A session block is its true length — routines
keep a 20px floor so their label stays legible, sessions do not, because a
block that claims a duration has to be that duration.

Time tracking has one control, Start, and no modes. A run counts up; if the
task has an estimate the readouts say "elapsed of estimate" and turn red past
it, and with no estimate they simply count. Stopping asks whether the task is
done rather than deciding.

The app keeps running when its window closes — a timer must survive the window
being tidied away — so `window-all-closed` deliberately does not quit and the
tray is the only way out. Anything that should really quit sets `quitting`
first, or the close handler will just hide the window again.

Time tracking stores one `S.sessions` row per run. A task total is always
summed from those rows, never cached on the task. The timer in flight lives in
`prefs.running` so it survives a reload, and it is paused rather than resumed
on start-up, so a timer left running overnight does not bank the hours.

### Dashboard

`viewDashboard` is today on one page and owns no data of its own. The
scratch pad is the same `prefs.scratch` that Notes opens, "Needs your
attention" reuses `overdueItems()` — the calendar's Catch-up panel — and
`noteActionItems()` reads open action items straight from `S.notes`. An
action item already due today or overdue is left out of "From your notes",
because it is on the page once already; showing it twice would make one
piece of work look like two. Missed routines fold away past `MISS_SHOWN`:
they are the least actionable thing there, and ten of them buried the rest.

The dashboard is the page the planner opens on. Everyone set up before it
existed has `launch:"calendar"` saved — the old default, not a choice — so
start-up moves them once; picking a page in Settings sets `launchSet` and is
never overridden.

It is also where the caret is most likely to be, in the scratch pad, so
nothing live on it redraws the page. Up next is swapped in place every 30
seconds (`upNextHtml()` into `#dashNext`), and the per-second timer tick
writes the running task's clock and today's total into `data-live` and
`data-live-total` nodes directly. A full `render()` there would throw the
caret out of whatever is being typed.

"Make task" and "Save as note" in the scratch pad work on the selection, or
on the line the caret is in when nothing is selected, and they *move* the
text rather than copy it. The toolbar keeps the selection alive through the
click the same way the formatting buttons do: they are in the `mousedown`
guard that calls `saveSel()` and prevents the default.

### Settings

Settings is a sidebar of sections with one pane open at a time — the tab
list is `SET_TABS`, and the open tab lives in `V.setTab` because which tab
you were on is not a setting. Every change redraws settings, so when the modal
is already open `settingsModal()` swaps its insides rather than calling
`openModal()` again; opening it afresh would replay the pop-in animation on
every toggle, the same flicker the task panel once had. The modal has a fixed
height so switching tabs does not make it jump.

### Theme and accent

Two things vary independently: the neutral ramp (light or dark) and the accent
hue. Both live as attributes on the root element — `data-theme` and
`data-accent` — set by `applyAppearance()` from `prefs`. Theme "system"
sets no attribute at all, which is the only way the media query can keep
tracking the OS.

The neutrals are not fixed greys either: each is a pure grey with a trace of
the accent mixed in, so the greys shift with the hue. Fixed green-grey
neutrals looked wrong the moment the accent was not green.

Dark is a near-black `--ground` with panels a clear step above it, the way
Notion, ClickUp and Gmail build theirs. A mid-charcoal page was tried first
and read as washed out: nothing can lift off a ground that is already halfway
up the ramp. Text is measured against `--surface`, not `--ground`, because
that is the panel it actually sits on — ink 12.1, muted 6.3, faint 4.7.

Anything tinted is derived with `color-mix()` from `--surface`, never
written twice, which is why `--tint-base` is a variable. Add a soft colour the
same way or it will be wrong in one of the two themes. An accent names three
shades and nothing more: on white the mid shade takes white text, on a dark
ground it vanishes, so the light shade becomes `--accent` and `--on-accent`
goes dark.

Those three shades are **not** in the stylesheet, one rule per hue. The accent
can be any colour the user picks, and no stylesheet can hold a rule for a
colour that does not exist yet — so `accentTrio()` works them out from a
single colour and `applyAppearance()` writes them onto the root element. The
CSS holds one default so the page has an accent before any script runs, and
`ACCENTS` in app.js is the palette: presets are just colours that happen to
have names. Two clamps keep a bad pick readable rather than refusing it — the
mid shade is darkened until white text on it clears 4.5:1, the light shade is
lightened until it clears 4.5:1 on a dark panel. Pick neon yellow and it comes
back darkened; pick black and the light shade comes back grey.

A swatch paints itself from `--dot`, set inline, and shows the shade the
theme in force would actually use. Reading `--a-base` in the rule was the old
bug: it resolves on `:root`, so every swatch showed whichever accent was
already chosen.

`src/timer.html` is a second window with its own stylesheet, so it cannot see
any of this. It is *told*: `syncTimerWindow()` sends the resolved theme as
`dark` in the payload and the window sets `data-theme` from it. That is why
changing the theme, changing the accent and the OS flipping at dusk all call
`syncTimerWindow()` — the media query in that file is only what shows before
the first message lands.

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

## Releasing

**Never bump `version` by hand, and never push a tag by hand.** One command
does the whole thing:

```
npm run release patch    # ordinary work: a fix, a refinement, a small addition
npm run release minor    # a major change: a new view, something people notice
```

It refuses unless the working tree is clean, you are on `main`, you are up to
date with origin, and the checks pass — and it changes nothing until every one
of those holds, so a refusal is always safe to ignore and retry.

Then it raises the version, commits, tags, and pushes. The workflow takes over
from the tag and publishes the installers, the single-file build, and the
`latest.yml` metadata that installed copies read.

### Why the version only moves here

The number moves during a release and at no other time. Commits and pushes in
between leave it alone, so **every number that exists is one somebody can
download** and the releases page reads straight through with no gaps. Bumping
per push was tried first and produced exactly those gaps.

Several pushes therefore share a version between releases, which is safe
because installers only ever come from the release workflow. **Do not build
installers locally and give them to anyone** — that is the one way two
different builds could claim the same number, and an installed copy decides
whether an update is newer by comparing exactly that.

Renumbering a release that people already have is worse than a gap: publishing
a lower number than an installed copy is running strands it, because it
compares the two and concludes it is already newer. The workflow runs the
checks, builds on all three platforms, and publishes a release with the
installers, the single-file build, and the `latest.yml` metadata that
electron-updater reads. See README.md for code signing.

## Worth doing next

- Code signing certificates, so the SmartScreen and Gatekeeper warnings go away.
- Widen `test/` beyond convention guards — there is no coverage of the date
  helpers, recurrence logic or filtering, which is where the real logic lives.
