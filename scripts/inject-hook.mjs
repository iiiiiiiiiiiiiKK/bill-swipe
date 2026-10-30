/**
 * Block-based hook injector.
 *
 * Splits each .tsx file into top-level function blocks (a block starts at a
 * column-0 `function`/`export function` line and ends at the next column-0 `}`),
 * then inserts `const { ... } = useI18n();` just after the block's opening brace
 * when the body calls t()/tp()/money() but has no hook call yet.
 */
import { readdirSync, readFileSync, statSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

function walk(dir, out = []) {
  for (const entry of readdirSync(dir)) {
    const p = join(dir, entry);
    if (statSync(p).isDirectory()) walk(p, out);
    else if (/\.tsx$/.test(entry)) out.push(p);
  }
  return out;
}

const START = /^(?:export\s+(?:default\s+)?)?function\s+[A-Za-z_$][\w$]*\s*[(<]/;

function neededNames(body) {
  const names = [];
  if (/\btp\(/.test(body)) names.push('tp');
  if (/\bmoney\(/.test(body)) names.push('money');
  if (/\bdate\(/.test(body)) names.push('date');
  if (/\btimeAgo\(/.test(body)) names.push('timeAgo');
  if (/\blang\b/.test(body)) names.push('lang');
  if (/\bt\(/.test(body) || names.length > 0) names.unshift('t');
  return [...new Set(names)];
}

let files = 0;
let insertions = 0;

for (const file of walk('src')) {
  if (file.includes('i18n.tsx')) continue;
  const lines = readFileSync(file, 'utf8').split('\n');
  const out = [];
  let i = 0;
  let changed = false;

  while (i < lines.length) {
    const line = lines[i];
    if (START.test(line)) {
      // Collect the block.
      const block = [];
      let depth = 0;
      let started = false;
      let j = i;
      for (; j < lines.length; j++) {
        block.push(lines[j]);
        for (const ch of lines[j]) {
          if (ch === '{') { depth++; started = true; }
          else if (ch === '}') depth--;
        }
        if (started && depth === 0) break;
      }
      const body = block.join('\n');
      if ((/\bt\(|\btp\(|\bmoney\(/.test(body)) && !/useI18n\(\)/.test(body)) {
        // Locate the opening brace line of the signature.
        let openIdx = -1;
        let parens = 0;
        for (let k = 0; k < block.length; k++) {
          for (const ch of block[k]) {
            if (ch === '(') parens++;
            else if (ch === ')') parens--;
          }
          if (parens <= 0 && block[k].trimEnd().endsWith('{')) {
            openIdx = k;
            break;
          }
        }
        if (openIdx >= 0) {
          const names = neededNames(body);
          block.splice(openIdx + 1, 0, `  const { ${names.join(', ')} } = useI18n();`);
          insertions++;
          changed = true;
        }
      }
      out.push(...block);
      i = j + 1;
      continue;
    }
    out.push(line);
    i++;
  }

  if (changed) {
    writeFileSync(file, out.join('\n'), 'utf8');
    files++;
  }
}

console.log('files:', files, 'hooks inserted:', insertions);
