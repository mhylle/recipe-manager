import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { PantryCategory } from './pantry-category.enum.js';

const root = join(__dirname, '../../../..');
const read = (relative: string): string =>
  readFileSync(join(root, relative), 'utf8');

const sorted = (values: string[]): string[] => [...values].sort();
const wanted = sorted(Object.values(PantryCategory));

/** The words between the braces of `enum PantryCategory { … }`. */
function prismaEnum(): string[] {
  const body = /enum PantryCategory \{([^}]*)\}/.exec(
    read('backend/prisma/schema.prisma'),
  )?.[1];
  return (body ?? '').split(/\s+/).filter(Boolean);
}

/** Every quoted word in the MCP server's category list. */
function mcpList(file: string): string[] {
  const text = read(file);
  const start = text.indexOf("'dairy'");
  const end = text.indexOf(']', start);
  return [...text.slice(start, end).matchAll(/'(\w+)'/g)].map((m) => m[1]);
}

describe('pantry categories, in every place that lists them', () => {
  it('the database enum matches the backend enum', () => {
    expect(sorted(prismaEnum())).toEqual(wanted);
  });

  it('the frontend enum matches', () => {
    const body = read('frontend/src/app/shared/enums/pantry-category.enum.ts');
    const values = [...body.matchAll(/= '(\w+)'/g)].map((m) => m[1]);
    expect(sorted(values)).toEqual(wanted);
  });

  it.each(['mcp-server/tools/recipes.js', 'mcp-server/tools/pantry.js'])(
    'the MCP list in %s matches',
    (file) => {
      expect(sorted(mcpList(file))).toEqual(wanted);
    },
  );

  it('offers alcohol, so spirits are not filed under juice', () => {
    expect(wanted).toContain('alcohol');
  });

  it.each(['en', 'da'])('the %s dictionary names every category', (locale) => {
    const dictionary = read(`frontend/src/app/shared/i18n/${locale}.ts`);
    const missing = wanted.filter(
      (value) => !dictionary.includes(`'enum.pantryCategory.${value}'`),
    );
    expect(missing).toEqual([]);
  });
});
