#!/usr/bin/env node
/**
 * check-i18n-keys.js
 * Checks for missing and unused i18n keys.
 *
 * Missing keys: used in code via t('ns:key') but absent from locales/ru/*.json
 * Unused keys:  present in locales/ru/*.json but never referenced in code
 *               (reported as warnings, does not fail CI)
 *
 * Usage: node scripts/check-i18n-keys.js
 */

const fs   = require('fs');
const path = require('path');

const ROOT       = path.join(__dirname, '..');
const LOCALES_RU = path.join(ROOT, 'locales', 'ru');

const SKIP_DIRS  = ['node_modules', 'locales', 'vendor', 'docs', 'fonts',
                    'tongue', 'herbs', 'icons', 'media', '.git', 'scripts'];
const SKIP_FILES = ['tailwind.min.js', 'tailwind.css', 'html2canvas.min.js', 'jspdf.umd.min.js'];
const EXTS = new Set(['.js', '.html']);

// ── 1. Load all locale keys from locales/ru/*.json ─────────────────────────

function flattenKeys(obj, prefix) {
  const out = [];
  for (const [k, v] of Object.entries(obj)) {
    const full = prefix ? `${prefix}.${k}` : k;
    if (v && typeof v === 'object') out.push(...flattenKeys(v, full));
    else out.push(full);
  }
  return out;
}

const localeKeys = new Set(); // 'common:nav.schedule' etc.
for (const file of fs.readdirSync(LOCALES_RU)) {
  if (!file.endsWith('.json')) continue;
  const ns   = path.basename(file, '.json');
  const data = JSON.parse(fs.readFileSync(path.join(LOCALES_RU, file), 'utf8'));
  for (const k of flattenKeys(data, '')) {
    localeKeys.add(`${ns}:${k}`);
  }
}

// ── 2. Scan source files for t('...') calls ────────────────────────────────

const T_CALL = /\bt\(\s*['"`]([\w:.-]+)['"`]/g;

function walk(dir) {
  const results = [];
  for (const entry of fs.readdirSync(dir)) {
    const full = path.join(dir, entry);
    const stat = fs.statSync(full);
    if (stat.isDirectory()) {
      if (!SKIP_DIRS.includes(entry)) results.push(...walk(full));
    } else {
      results.push(full);
    }
  }
  return results;
}

const usedKeys = new Set();
const usedLocations = {}; // key → [{file, line}]

for (const f of walk(ROOT)) {
  if (!EXTS.has(path.extname(f).toLowerCase())) continue;
  if (SKIP_FILES.includes(path.basename(f))) continue;
  const src   = fs.readFileSync(f, 'utf8');
  const lines = src.split('\n');
  lines.forEach((line, idx) => {
    let m;
    T_CALL.lastIndex = 0;
    while ((m = T_CALL.exec(line)) !== null) {
      const key = m[1];
      usedKeys.add(key);
      if (!usedLocations[key]) usedLocations[key] = [];
      usedLocations[key].push({ file: path.relative(ROOT, f), line: idx + 1 });
    }
  });
}

// Also scan data-i18n attribute values in HTML and JS template literals,
// plus any string literal that looks like a namespaced i18n key ('ns:key.sub')
const DATA_I18N  = /data-i18n(?:-\w+)?=["'`]([\w:.-]+)["'`]/g;
const KEY_LITERAL = /['"]((?:common|auth|dashboard|acupoints|sessions|subscription|notifications|errors):[\w.]+)['"]/g;

for (const f of walk(ROOT)) {
  const ext = path.extname(f).toLowerCase();
  if (ext !== '.html' && ext !== '.js') continue;
  if (SKIP_FILES.includes(path.basename(f))) continue;
  const src   = fs.readFileSync(f, 'utf8');
  const lines = src.split('\n');
  lines.forEach((line, idx) => {
    let m;
    DATA_I18N.lastIndex = 0;
    while ((m = DATA_I18N.exec(line)) !== null) {
      const key = m[1];
      if (!key.includes(':')) continue;
      usedKeys.add(key);
      if (!usedLocations[key]) usedLocations[key] = [];
      usedLocations[key].push({ file: path.relative(ROOT, f), line: idx + 1 });
    }
    // Pick up all string literals that look like namespaced keys ('ns:key.sub')
    // works for NAV_I18N maps and other static key references in .js files
    if (ext === '.js') {
      KEY_LITERAL.lastIndex = 0;
      while ((m = KEY_LITERAL.exec(line)) !== null) {
        usedKeys.add(m[1]);
        if (!usedLocations[m[1]]) usedLocations[m[1]] = [];
        usedLocations[m[1]].push({ file: path.relative(ROOT, f), line: idx + 1 });
      }
    }
  });
}

// ── 3. Report ──────────────────────────────────────────────────────────────

const missing = [...usedKeys].filter(k => !localeKeys.has(k));
const unused  = [...localeKeys].filter(k => !usedKeys.has(k));

let exitCode = 0;

if (missing.length) {
  console.log('\n❌ MISSING KEYS (used in code, absent from locales/ru/):');
  for (const k of missing) {
    const locs = (usedLocations[k] || []).map(l => `${l.file}:${l.line}`).join(', ');
    console.log(`  ${k}  ← ${locs}`);
  }
  exitCode = 1;
} else {
  console.log('✅ No missing keys.');
}

if (unused.length) {
  console.log(`\n⚠️  UNUSED KEYS (in locales/ru/ but not referenced in code): ${unused.length}`);
  for (const k of unused) console.log(`  ${k}`);
}

if (exitCode === 0 && unused.length === 0) {
  console.log('✅ No unused keys.');
}

process.exit(exitCode);
