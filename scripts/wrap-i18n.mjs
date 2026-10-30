/**
 * Second-pass i18n wrapper: handles JSX text nodes that span multiple lines.
 * Collapses whitespace before comparing against the dictionary, then replaces
 * the node with a t() call using the collapsed source string.
 */
import { readFileSync, readdirSync, statSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

const dictSource = readFileSync('src/lib/i18n.tsx', 'utf8');
const keys = new Set();
for (const line of dictSource.split('\n')) {
  const m = line.match(/^  (?:'((?:[^'\\]|\\.)*)'|([A-Za-z_$][\w$]*)):\s/);
  if (m) keys.add(m[1] ?? m[2]);
}

function walk(dir, out = []) {
  for (const entry of readdirSync(dir)) {
    const p = join(dir, entry);
    if (statSync(p).isDirectory()) walk(p, out);
    else if (/\.tsx$/.test(entry)) out.push(p);
  }
  return out;
}

const unescapeEntities = (value) =>
  value
    .replace(/&apos;/g, "'")
    .replace(/&quot;/g, '"')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&nbsp;/g, ' ');

const normalise = (value) =>
  value
    .replace(/[\u2018\u2019\u02BC]/g, "'")
    .replace(/[\u201C\u201D]/g, '"')
    .replace(/[\u2013\u2014\u2212]/g, '-')
    .replace(/\s+/g, ' ')
    .trim();

const normalisedKeys = new Map([...keys].map((key) => [normalise(key), key]));
const escape = (value) => value.replace(/\\/g, '\\\\').replace(/'/g, "\\'");

let total = 0;
const report = [];

for (const file of walk('src')) {
  if (file.includes('i18n.tsx') || file.includes('demoContent.ts')) continue;
  let src = readFileSync(file, 'utf8');
  let wrapped = 0;

  src = src.replace(/>(\s*)([^<>{}]+?)(\s*)</gs, (full, pre, text, post) => {
    const collapsed = text.replace(/\s+/g, ' ').trim();
    if (!collapsed || collapsed.length < 3) return full;
    const decoded = unescapeEntities(collapsed);
    const key = normalisedKeys.get(normalise(decoded));
    if (!key) return full;
    wrapped++;
    return `>${pre}{t('${escape(decoded)}')}${post}<`;
  });

  if (wrapped > 0) {
    if (!/useI18n/.test(src)) {
      src = src.replace(/^(import [^\n]*;\n)/, `$1import { useI18n } from '@/lib/i18n';\n`);
    }
    writeFileSync(file, src, 'utf8');
    total += wrapped;
    report.push(`${file}: ${wrapped}`);
  }
}

console.log(`wrapped ${total}`);
for (const line of report) console.log('  ' + line);
