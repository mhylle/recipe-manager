import { readFileSync } from 'node:fs';

// Flags user-facing English left hardcoded in an Angular template.
// Re-runnable as a regression check: a new bare literal in a .html file fails it.
//
// Works on the WHOLE file, not line-by-line — attributes routinely span lines, so
// a line-based scanner reports every wrapped tag as prose. Each construct is
// blanked to spaces of equal length, which keeps byte offsets (and therefore line
// numbers) exact while removing it from consideration.

const USER_FACING_ATTRS = ['placeholder', 'aria-label', 'title', 'alt'];

const blank = (s) => s.replace(/[^\n]/g, ' ');
const lineOf = (text, index) => text.slice(0, index).split('\n').length;

/**
 * Blank `@if (...)` / `@for (...)` / `@case (...)` heads including their condition.
 * Needs depth counting, not a regex: conditions routinely contain calls, so
 * `\(.*?\)` stops at the wrong paren in `@if (matchResult().items.length > 0)`.
 */
function blankControlFlow(text) {
  const out = [...text];
  const head = /@(?:if|else if|for|switch|case)\s*\(/g;
  let m;
  while ((m = head.exec(text)) !== null) {
    let depth = 1;
    let i = m.index + m[0].length;
    while (i < text.length && depth > 0) {
      if (text[i] === '(') depth++;
      else if (text[i] === ')') depth--;
      i++;
    }
    for (let j = m.index; j < i; j++) {
      if (out[j] !== '\n') out[j] = ' ';
    }
  }
  return out.join('');
}

/**
 * User-facing strings also escape through TypeScript, which the template scan
 * cannot see. Three shipped that way before this rule existed: an alert() and two
 * error.set() calls. These sinks always render to a human, so a bare string
 * literal in one is always a bug — narrow enough to have no false positives.
 */
const TS_SINKS = /(?:\balert|\bconfirm|\berror\.set|\bsetError)\s*\(\s*(['"`])((?:(?!\1)[\s\S])*?)\1/g;

const findings = [];

for (const file of process.argv.slice(2)) {
  const raw = readFileSync(file, 'utf8');

  if (/\.ts$/.test(file)) {
    for (const m of raw.matchAll(TS_SINKS)) {
      // A translation key ('a.b.c') is fine; prose is not.
      const literal = m[2];
      if (/[A-Za-z]/.test(literal) && !/^[a-z][a-zA-Z]*(\.[a-zA-Z]+)+$/.test(literal)) {
        findings.push({ file, line: lineOf(raw, m.index), kind: 'ts-literal', text: literal });
      }
    }
    continue;
  }

  // --- literal (unbound) values on attributes a user or screen reader reads.
  // A bound attribute is written [attr.x]="..." or [x]="...", so require the
  // preceding char to be neither '[' nor part of a longer identifier.
  for (const attr of USER_FACING_ATTRS) {
    const re = new RegExp(`(?<![\\[\\w.-])${attr}\\s*=\\s*"([^"]*)"`, 'g');
    for (const m of raw.matchAll(re)) {
      if (/[A-Za-z]/.test(m[1])) {
        findings.push({ file, line: lineOf(raw, m.index), kind: attr, text: m[1] });
      }
    }
  }

  // --- text nodes
  //
  // ORDER MATTERS, and not in the obvious way. Control-flow heads are blanked
  // BEFORE tags, because a condition may contain a less-than — `@if (position <
  // baseSteps().length)` — and the tag pattern would read that `<` as the start
  // of a tag and blank everything up to the next `>`, taking real prose with it.
  // That is a false NEGATIVE, which is worse than a noisy check: it reports
  // clean on a template it never looked at.
  let stripped = blankControlFlow(raw.replace(/<!--[\s\S]*?-->/g, blank));
  stripped = stripped
    // `@let x = expr;` is a declaration, not prose. Blanked whole, because the
    // expression routinely mentions method names that read like English.
    .replace(/@let\s+[A-Za-z_$][\w$]*\s*=[^;]*;/g, blank)
    .replace(/\{\{[\s\S]*?\}\}/g, blank) // interpolations (already translated)
    .replace(/<[^>]*>/g, blank) // tags (may span lines)
    .replace(/@(?:else|empty|default)\b/g, blank)
    .replace(/&[a-zA-Z]+;|&#\d+;/g, blank) // entities: &copy; &mdash;
    .replace(/[{}]/g, ' ');

  // Anything with letters left is prose the user would read.
  for (const m of stripped.matchAll(/[^\s][^\n]*/g)) {
    const text = m[0].trim();
    if (/[A-Za-z]/.test(text)) {
      findings.push({ file, line: lineOf(raw, m.index), kind: 'text', text });
    }
  }
}

if (findings.length === 0) {
  console.log('CLEAN — no hardcoded user-facing English found in any template.');
} else {
  console.log(`${findings.length} suspected hardcoded string(s):\n`);
  for (const f of findings) {
    console.log(`  ${f.file}:${f.line}  [${f.kind}]  ${JSON.stringify(f.text)}`);
  }
  process.exitCode = 1;
}
