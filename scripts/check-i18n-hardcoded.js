#!/usr/bin/env node
/**
 * check-i18n-hardcoded.js
 * Finds hardcoded Cyrillic strings in .js and .html files.
 * Exits 1 if any found (for CI). Skips comments, data-i18n keys, locale files.
 *
 * Usage: node scripts/check-i18n-hardcoded.js
 */

const fs   = require('fs');
const path = require('path');

const CYRILLIC = /[а-яёА-ЯЁ]/;

const SKIP_DIRS = [
  'node_modules', 'locales', 'vendor', 'docs', 'fonts',
  'tongue', 'herbs', 'icons', 'media', 'scripts', '.git',
];
const SKIP_FILES = [
  'tailwind.css', 'tailwind.min.js',
];
const EXTS = new Set(['.js', '.html']);

// Patterns that are OK to have Cyrillic (not user-visible hardcoded strings)
const SKIP_LINE_PATTERNS = [
  /^\s*\/\//,           // JS single-line comment (full line)
  /^\s*\*\s/,           // JSDoc / block comment line
  /^\s*\*/,             // block comment continuation
  /^\s*<!--/,           // HTML comment opening
  /data-i18n(?:-\w+)?=["'][^"']*["']/,  // data-i18n attribute key
  /\/\* i18n-ok \*\//,  // explicit i18n-ok pragma (checked on ORIGINAL line before strip)
];

function stripBlockComments(src, ext) {
  if (ext === '.js') {
    // Remove /* ... */ blocks
    src = src.replace(/\/\*[\s\S]*?\*\//g, m => m.replace(/[^\n]/g, ' '));
  }
  if (ext === '.html') {
    // Remove <!-- ... --> blocks
    src = src.replace(/<!--[\s\S]*?-->/g, m => m.replace(/[^\n]/g, ' '));
  }
  return src;
}

function checkFile(filePath) {
  const ext = path.extname(filePath).toLowerCase();
  if (!EXTS.has(ext)) return [];

  const rawSrc = fs.readFileSync(filePath, 'utf8');
  const rawLines = rawSrc.split('\n');
  const stripped = stripBlockComments(rawSrc, ext);
  const lines = stripped.split('\n');
  const findings = [];

  lines.forEach((line, idx) => {
    if (!CYRILLIC.test(line)) return;
    const origLine = rawLines[idx] || '';
    // Check skip patterns against ORIGINAL line (before block-comment stripping)
    if (SKIP_LINE_PATTERNS.some(p => p.test(origLine))) return;
    // Skip if Cyrillic appears only in the inline // comment portion
    const commentStart = line.indexOf('//');
    if (commentStart !== -1 && !CYRILLIC.test(line.slice(0, commentStart))) return;
    findings.push({ line: idx + 1, text: line.trim().slice(0, 120) });
  });

  return findings;
}

function walk(dir) {
  const results = [];
  for (const entry of fs.readdirSync(dir)) {
    const full = path.join(dir, entry);
    const stat = fs.statSync(full);
    if (stat.isDirectory()) {
      if (!SKIP_DIRS.includes(entry)) results.push(...walk(full));
    } else {
      if (!SKIP_FILES.includes(entry)) results.push(full);
    }
  }
  return results;
}

const ROOT = path.join(__dirname, '..');
const files = walk(ROOT).filter(f => EXTS.has(path.extname(f).toLowerCase()));

let total = 0;
for (const f of files) {
  const findings = checkFile(f);
  if (findings.length) {
    const rel = path.relative(ROOT, f);
    console.log(`\n📄 ${rel}`);
    for (const { line, text } of findings) {
      console.log(`  L${line}: ${text}`);
      total++;
    }
  }
}

if (total === 0) {
  console.log('✅ No hardcoded Cyrillic strings found.');
  process.exit(0);
} else {
  console.log(`\n❌ ${total} hardcoded Cyrillic string(s) found. Replace with t() or data-i18n.`);
  process.exit(1);
}
