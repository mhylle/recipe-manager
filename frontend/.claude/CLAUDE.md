
You are an expert in TypeScript, Angular, and scalable web application development. You write functional, maintainable, performant, and accessible code following Angular and TypeScript best practices.

## TypeScript Best Practices

- Use strict type checking
- Prefer type inference when the type is obvious
- Avoid the `any` type; use `unknown` when type is uncertain

## Angular Best Practices

- Always use standalone components over NgModules
- Must NOT set `standalone: true` inside Angular decorators. It's the default in Angular v20+.
- Use signals for state management
- Implement lazy loading for feature routes
- Do NOT use the `@HostBinding` and `@HostListener` decorators. Put host bindings inside the `host` object of the `@Component` or `@Directive` decorator instead
- Use `NgOptimizedImage` for all static images.
  - `NgOptimizedImage` does not work for inline base64 images.

## Accessibility Requirements

- It MUST pass all AXE checks.
- It MUST follow all WCAG AA minimums, including focus management, color contrast, and ARIA attributes.

### Components

- Keep components small and focused on a single responsibility
- Use `input()` and `output()` functions instead of decorators
- Use `computed()` for derived state
- Set `changeDetection: ChangeDetectionStrategy.OnPush` in `@Component` decorator
- ALWAYS use external templates and styles — every component is `<name>.ts` + `<name>.html` + `<name>.scss`. Never inline `template:` or `styles:`, not even for a one-line component. (This overrides Angular's general "inline for small components" advice: the i18n sweep needs templates to be greppable and diffable, and mixed conventions defeat that.)
- Prefer Reactive forms instead of Template-driven ones
- Do NOT use `ngClass`, use `class` bindings instead
- Do NOT use `ngStyle`, use `style` bindings instead
- When using external templates/styles, use paths relative to the component TS file.

## Internationalisation (English + Danish)

Runtime i18n lives in `src/app/shared/i18n/`. There is no `@angular/localize`.

- NEVER put a user-facing literal in a template. Use `{{ 'some.key' | t }}`, and `[attr.placeholder]` / `[attr.aria-label]` bindings rather than literal attributes. `npm run check:i18n` fails the build on violations.
- Add every key to `en.ts` first — it is the source of truth, and `Dictionary` is derived from its shape, so `da.ts` fails to compile until it has the key too.
- Enum values render via `{{ value | enumLabel: 'kind' }}`. The stored/wire value MUST stay the English identifier (`easy`, `tbsp`, `monday`) — only the display translates. Translating the value corrupts the API payload and the database.
- PARAMETERISE, never concatenate: `'x.y' | t: { name: item.name }`, not `('x.y' | t) + item.name`. Word order differs between languages, and concatenation hard-codes English order.
- The `t` and `enumLabel` pipes are deliberately `pure: false`. Do not "optimise" them to pure — a pure pipe memoises on its input, and the key never changes, so the UI would keep showing the previous language after a switch. `translate.pipe.spec.ts` guards this.
- Strings shared across features go under `common.*`. Do not duplicate them per feature.
- Brand names (`The Atelier Kitchen`, `BilkaToGo`, `Salling Group`) are identical in every dictionary — they live in the dictionary so templates stay literal-free, not because they translate.
- Danish compound nouns run 30-40% longer than English. Never size a container to fit the English string exactly; check both languages before considering a layout done.

## State Management

- Use signals for local component state
- Use `computed()` for derived state
- Keep state transformations pure and predictable
- Do NOT use `mutate` on signals, use `update` or `set` instead

## Templates

- Keep templates simple and avoid complex logic
- Use native control flow (`@if`, `@for`, `@switch`) instead of `*ngIf`, `*ngFor`, `*ngSwitch`
- Use the async pipe to handle observables
- Do not assume globals like (`new Date()`) are available.
- Do not write arrow functions in templates (they are not supported).

## Services

- Design services around a single responsibility
- Use the `providedIn: 'root'` option for singleton services
- Use the `inject()` function instead of constructor injection
