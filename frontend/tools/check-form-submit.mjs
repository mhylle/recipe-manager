#!/usr/bin/env node
/**
 * Refuse a `<form (ngSubmit)="...">` that nothing owns.
 *
 * `ngSubmit` is an OUTPUT of Angular's form directives, not a DOM event. It is
 * raised by `FormGroupDirective` (selector `[formGroup]`) or by `NgForm` (from
 * FormsModule, which claims any bare `<form>`). With neither on the element,
 * Angular happily binds a listener for a DOM event named "ngSubmit" that
 * nothing ever raises — no error, no warning, no failing test.
 *
 * The handler then simply never runs, and a `type="submit"` button falls
 * through to a NATIVE form submission: the page reloads, the request is never
 * made, and the reload wipes the console and network log you would use to work
 * out why. That is recipe-manager#58, where sharing a kitchen silently did
 * nothing for as long as the feature had existed.
 *
 * Component tests do not catch it, because they call the handler directly and
 * never exercise the template's wiring. Hence a check over the templates
 * themselves.
 */
import { readFileSync } from 'node:fs';
import { basename, dirname, join } from 'node:path';

const files = process.argv.slice(2).filter((f) => f.endsWith('.html'));
const findings = [];

for (const file of files) {
  const html = readFileSync(file, 'utf8');
  if (!html.includes('(ngSubmit)')) continue;

  // The component that owns this template, for the FormsModule check.
  const ts = join(dirname(file), `${basename(file, '.html')}.ts`);
  let component = '';
  try {
    component = readFileSync(ts, 'utf8');
  } catch {
    // A template with no sibling component is unusual but not this check's
    // business; without it we cannot judge, so say nothing.
    continue;
  }

  // FormsModule brings NgForm, whose selector claims every <form> that is not
  // already a [formGroup] and is not opted out with ngNoForm.
  const importsFormsModule = /imports:\s*\[[^\]]*\bFormsModule\b/s.test(component);
  if (importsFormsModule) continue;

  // Otherwise every ngSubmit form must carry its own [formGroup].
  for (const tag of html.match(/<form\b[^>]*>/g) ?? []) {
    if (!tag.includes('(ngSubmit)')) continue;
    if (tag.includes('[formGroup]') || tag.includes('formGroupName')) continue;
    findings.push({ file, tag: tag.replace(/\s+/g, ' ').slice(0, 100) });
  }
}

if (findings.length > 0) {
  console.error('Forms whose (ngSubmit) can never fire:\n');
  for (const { file, tag } of findings) {
    console.error(`  ${file}`);
    console.error(`    ${tag}`);
    console.error(
      '    Add [formGroup] to the <form>, or import FormsModule in the component.\n',
    );
  }
  console.error(
    'Left as-is, the submit button triggers a NATIVE form submission: the page\n' +
      'reloads, the handler never runs, and the reload destroys the evidence.',
  );
  process.exit(1);
}

console.log('CLEAN — every (ngSubmit) form has a directive that can raise it.');
