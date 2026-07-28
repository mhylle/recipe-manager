#!/usr/bin/env node
/**
 * Fail the build if an NgOptimizedImage `fill` image sits in an unpositioned parent.
 *
 * A `fill` image renders `position: absolute; inset: 0`. If its immediate parent
 * is not positioned it anchors to the nearest positioned ancestor instead —
 * usually the page — and covers it at full size. Nothing errors: the template
 * compiles, the tests pass, and the damage is only visible by looking at the
 * running page. This shipped twice.
 *
 * The check is deliberately dumb: for every `<img ... fill ...>` it finds the
 * class on the immediately enclosing element, then requires the component's own
 * stylesheet to declare `position: relative` (or absolute/fixed/sticky) for that
 * class. It cannot see inherited or global rules, so it errs toward demanding an
 * explicit declaration — which is what you want here anyway, since the
 * positioning is load-bearing and should be stated where the image is.
 */
import { readFileSync } from 'node:fs';
import { basename } from 'node:path';

const files = process.argv.slice(2).filter((f) => f.endsWith('.html'));
const POSITIONED = /position:\s*(relative|absolute|fixed|sticky)/;

const problems = [];
let imagesChecked = 0;

for (const htmlPath of files) {
  const html = readFileSync(htmlPath, 'utf8');
  const scssPath = htmlPath.replace(/\.html$/, '.scss');

  let scss = '';
  try {
    scss = readFileSync(scssPath, 'utf8');
  } catch {
    // No stylesheet beside the template; any fill image here is unverifiable.
  }

  // Every <img ...> tag carrying a bare `fill` attribute.
  for (const match of html.matchAll(/<img\b[^>]*?\bfill\b[^>]*>/g)) {
    imagesChecked++;
    const imgTag = match[0];
    const imgClass = /class="([^"]*)"/.exec(imgTag)?.[1] ?? '(no class)';

    // Walk backwards from the tag to the nearest enclosing opening element.
    const before = html.slice(0, match.index);
    const openTags = [...before.matchAll(/<(div|a|section|figure|span|aside|li)\b[^>]*>/g)];
    const closeCount = (before.match(/<\/(div|a|section|figure|span|aside|li)>/g) ?? []).length;
    const parentTag = openTags[openTags.length - 1 - 0];

    // Rough but adequate: the last unclosed opening tag before the image.
    const unclosed = openTags.slice(closeCount);
    const parent = unclosed[unclosed.length - 1] ?? parentTag;
    const parentClass = parent ? /class="([^"]*)"/.exec(parent[0])?.[1] : undefined;

    if (!parentClass) {
      problems.push(
        `${basename(htmlPath)}: fill image .${imgClass} has no identifiable parent class — ` +
          `wrap it in an element with a class whose stylesheet sets position.`,
      );
      continue;
    }

    // Any of the parent's classes may carry the positioning.
    const candidates = parentClass.split(/\s+/).filter(Boolean);
    const positioned = candidates.some((cls) => {
      const rule = new RegExp(`\\.${cls}\\b[^{]*\\{[^}]*\\}`, 'g');
      return [...scss.matchAll(rule)].some((r) => POSITIONED.test(r[0]));
    });

    if (!positioned) {
      problems.push(
        `${basename(htmlPath)}: fill image .${imgClass} sits in .${candidates.join('.')}, ` +
          `which never declares a position in ${basename(scssPath)}. ` +
          `The image will escape its box and cover the nearest positioned ancestor.`,
      );
    }
  }
}

if (problems.length > 0) {
  console.error('Unpositioned parents for NgOptimizedImage `fill` images:\n');
  for (const p of problems) console.error(`  - ${p}`);
  console.error(`\n${problems.length} problem(s) across ${imagesChecked} fill image(s).`);
  process.exit(1);
}

console.log(`CLEAN — all ${imagesChecked} fill image(s) sit in a positioned parent.`);
