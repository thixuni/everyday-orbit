/*
 * Guards for the conventions in CLAUDE.md that are easy to break by accident.
 * Run with: npm test
 */
const test = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const path = require('path');
const { execFileSync } = require('child_process');

const root = path.join(__dirname, '..');
const read = p => fs.readFileSync(path.join(root, p), 'utf8');

const html = read('src/index.html');
const css = read('src/app.css');
const js = read('src/app.js');

/** Strip comments so we test code, not prose about code. */
function stripComments(source) {
  return source.replace(/\/\*[\s\S]*?\*\//g, '').replace(/(^|[^:'"\\])\/\/.*$/gm, '$1');
}
const jsCode = stripComments(js);

/* ---------- sources ---------- */

test('the three sources are present and non-trivial', () => {
  assert.ok(html.length > 1000, 'src/index.html looks empty');
  assert.ok(css.length > 10000, 'src/app.css looks empty');
  assert.ok(js.length > 50000, 'src/app.js looks empty');
});

test('index.html links the split assets exactly once each', () => {
  assert.strictEqual((html.match(/<link rel="stylesheet" href="app\.css">/g) || []).length, 1);
  assert.strictEqual((html.match(/<script src="app\.js"><\/script>/g) || []).length, 1);
});

test('app.js is wrapped in an IIFE so it leaks nothing global', () => {
  assert.match(js.trimStart(), /^\(function\s*\(\s*\)\s*\{/);
  assert.match(js.trimEnd(), /\}\)\(\);$/);
});

/* ---------- documented conventions ---------- */

test('no blocking dialogs: they fail silently in the artifact sandbox', () => {
  const hits = [...jsCode.matchAll(/(^|[^.\w$])(alert|confirm|prompt)\s*\(/g)].map(m => m[2]);
  assert.deepStrictEqual(hits, [], 'use arm() or an inline bar instead of ' + hits.join('/'));
});

test('every data-act is handled somewhere', () => {
  const acts = new Set();
  for (const m of (html + js).matchAll(/data-act="([a-z0-9-]+)"/g)) acts.add(m[1]);

  // Most acts land in the delegated click switch; a few (form inputs) are
  // handled by a direct comparison in the change/input listener instead.
  const handled = new Set([
    ...[...jsCode.matchAll(/case\s+"([a-z0-9-]+)"\s*:/g)].map(m => m[1]),
    ...[...jsCode.matchAll(/\.act\s*===\s*"([a-z0-9-]+)"/g)].map(m => m[1])
  ]);

  assert.ok(acts.size > 30, 'expected to find the data-act attributes, found ' + acts.size);
  const orphans = [...acts].filter(a => !handled.has(a)).sort();
  assert.deepStrictEqual(orphans, [], 'data-act values nothing handles: ' + orphans.join(', '));
});

test('colours come from tokens, not hardcoded hex in rules', () => {
  // Everything before the first closing brace of :root is the token block.
  const tokenBlockEnd = css.indexOf('}');
  const rules = css.slice(tokenBlockEnd);
  const stray = [...rules.matchAll(/#[0-9a-fA-F]{3,8}\b/g)].map(m => m[0]);
  assert.deepStrictEqual(stray, [], 'hardcoded colours outside :root: ' + stray.join(', '));
});

test('the six state keys are the ones persistence knows about', () => {
  const m = jsCode.match(/const KEYS\s*=\s*\[([^\]]+)\]/);
  assert.ok(m, 'KEYS array not found');
  const keys = [...m[1].matchAll(/"([a-z]+)"/g)].map(x => x[1]);
  assert.deepStrictEqual(keys, ['categories', 'tasks', 'routines', 'notes', 'completions', 'prefs']);
});

test('the Eisenhower quadrant is derived, never stored on a task', () => {
  assert.match(jsCode, /const quadOf\s*=\s*t\s*=>/, 'quadOf should derive the quadrant');
  assert.ok(!/\bt\.quad\s*=/.test(jsCode), 'a quadrant must never be assigned onto a task');
});

test('the app ships with no personal data', () => {
  const banned = ['thisuni', 'gunawardena', '@gmail', 'code94'];
  const lower = (html + css + js).toLowerCase();
  for (const word of banned) {
    assert.ok(lower.indexOf(word) === -1, 'found "' + word + '" in the shipped sources');
  }
});

/* ---------- the standalone build ---------- */

test('build:html produces one self-contained file', () => {
  execFileSync(process.execPath, [path.join(root, 'scripts', 'build-standalone.js')], { cwd: root });
  const out = read('dist/everyday-orbit.html');

  assert.ok(out.indexOf('href="app.css"') === -1, 'app.css was not inlined');
  assert.ok(out.indexOf('src="app.js"') === -1, 'app.js was not inlined');

  const scripts = out.match(/<script[^>]*>/g) || [];
  assert.deepStrictEqual(scripts, ['<script>'], 'expected exactly one inline script, got ' + scripts.join(' | '));

  // The $-sequences in the sources must survive inlining untouched.
  assert.ok(out.indexOf('"$& "') !== -1, 'a $-sequence was mangled during inlining');

  assert.ok(out.indexOf(css.trim().slice(0, 200)) !== -1, 'CSS body missing from the build');
  assert.ok(out.indexOf(js.trim().slice(0, 200)) !== -1, 'JS body missing from the build');
  assert.ok(out.length > 100000, 'build looks truncated');
});

test('the built file has no local asset references left', () => {
  const out = read('dist/everyday-orbit.html');
  const refs = [...out.matchAll(/(?:src|href)="(?!https?:|#|data:)([^"]+)"/g)].map(m => m[1]);
  assert.deepStrictEqual(refs, [], 'unresolved local references: ' + refs.join(', '));
});
