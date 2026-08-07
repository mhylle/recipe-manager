import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { PantrySharingComponent } from './pantry-sharing';
import { PantryContextService } from '../../../shared/services/pantry-context.service';

const MEMBERS = [
  {
    userId: 'u-martin',
    displayName: 'Martin Hylleberg',
    email: 'mhylle@yahoo.com',
    role: 'owner',
    isYou: true,
  },
  {
    userId: 'u-heidi',
    displayName: 'Heidi',
    email: 'heidi@example.com',
    role: 'member',
    isYou: false,
  },
];

describe('PantrySharingComponent', () => {
  let fixture: ReturnType<typeof TestBed.createComponent<PantrySharingComponent>>;
  let component: PantrySharingComponent;
  let httpTesting: HttpTestingController;
  let context: PantryContextService;

  beforeEach(() => {
    TestBed.resetTestingModule();
    TestBed.configureTestingModule({
      imports: [PantrySharingComponent],
      providers: [provideHttpClient(), provideHttpClientTesting()],
    });
    httpTesting = TestBed.inject(HttpTestingController);
    context = TestBed.inject(PantryContextService);
    localStorage.clear();
  });

  afterEach(() => {
    httpTesting.verify();
    localStorage.clear();
  });

  const build = () => {
    fixture = TestBed.createComponent(PantrySharingComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  };

  const resolvePantry = () =>
    httpTesting
      .expectOne((r) => r.url.endsWith('/api/pantry/mine'))
      .flush([{ id: 'p-1', name: 'Home', role: 'owner', isOwner: true, memberCount: 2 }]);

  it('loads members once the kitchen resolves, not only if it already had', () => {
    // The regression this pins down: the component is built BEFORE
    // /api/pantry/mine answers, so the old constructor call found
    // context.current() null, returned early, and never tried again — leaving the
    // household looking empty even to its owner.
    context.load();
    build();

    // Nothing to fetch yet: no kitchen is known.
    httpTesting.expectNone((r) => r.url.includes('/members'));

    resolvePantry();
    fixture.detectChanges();

    httpTesting.expectOne((r) => r.url.endsWith('/api/pantries/p-1/members')).flush(MEMBERS);
    expect(component.members()).toHaveLength(2);
    expect(component.members().map((m) => m.displayName)).toContain('Heidi');
  });

  it('reloads when the kitchen is switched', () => {
    context.load();
    build();
    resolvePantry();
    fixture.detectChanges();
    httpTesting.expectOne((r) => r.url.endsWith('/api/pantries/p-1/members')).flush(MEMBERS);

    // A second kitchen, selected from the switcher. Previously this kept showing
    // the first household's members.
    context.pantries.set([
      { id: 'p-1', name: 'Home', role: 'owner', isOwner: true, memberCount: 2 },
      { id: 'p-2', name: 'Cabin', role: 'owner', isOwner: true, memberCount: 1 },
    ]);
    context.select('p-2');
    fixture.detectChanges();

    httpTesting.expectOne((r) => r.url.endsWith('/api/pantries/p-2/members')).flush([MEMBERS[0]]);
    expect(component.members()).toHaveLength(1);
  });

  it('shows the new member straight after an invitation', () => {
    context.load();
    build();
    resolvePantry();
    fixture.detectChanges();
    httpTesting
      .expectOne((r) => r.url.endsWith('/api/pantries/p-1/members'))
      .flush([MEMBERS[0]]);

    component.emailControl.setValue('heidi@example.com');
    component.invite();

    const invite = httpTesting.expectOne(
      (r) => r.url.endsWith('/api/pantries/p-1/members') && r.method === 'POST',
    );
    expect(invite.request.body).toEqual({ email: 'heidi@example.com' });
    invite.flush(MEMBERS[1]);

    // invite() reloads, so the list reflects the server rather than a guess.
    httpTesting
      .expectOne((r) => r.url.endsWith('/api/pantries/p-1/members') && r.method === 'GET')
      .flush(MEMBERS);
    expect(component.members()).toHaveLength(2);
  });

  it('keeps the backend’s explanation when an invitation fails', () => {
    context.load();
    build();
    resolvePantry();
    fixture.detectChanges();
    httpTesting.expectOne((r) => r.url.endsWith('/api/pantries/p-1/members')).flush([MEMBERS[0]]);

    component.emailControl.setValue('nobody@example.com');
    component.invite();
    httpTesting.expectOne((r) => r.method === 'POST').flush(
      { message: 'No mhylle.com account uses nobody@example.com.' },
      { status: 404, statusText: 'Not Found' },
    );

    // "Could not invite" would throw away the one detail that helps.
    expect(component.error()).toContain('nobody@example.com');
    expect(component.busy()).toBe(false);
  });

  it('does not invite on an invalid address', () => {
    context.load();
    build();
    resolvePantry();
    fixture.detectChanges();
    httpTesting.expectOne((r) => r.url.endsWith('/api/pantries/p-1/members')).flush([MEMBERS[0]]);

    component.emailControl.setValue('not-an-email');
    component.invite();

    httpTesting.expectNone((r) => r.method === 'POST');
  });

  it('actually submits when the Share button is pressed', () => {
    // The bug this pins down, and the reason every other test here missed it:
    // they all called component.invite() directly. The TEMPLATE was the broken
    // part. `(ngSubmit)` is an output of FormGroupDirective — with no
    // [formGroup] on the <form> and FormsModule not imported, Angular bound a
    // listener for a DOM event nothing raises, so the submit button fell
    // through to a native form submission. The page reloaded, no request was
    // ever made, and the reload wiped the evidence.
    context.load();
    build();
    resolvePantry();
    fixture.detectChanges();
    httpTesting.expectOne((r) => r.url.endsWith('/api/pantries/p-1/members')).flush([MEMBERS[0]]);

    component.emailControl.setValue('heidi@example.com');
    fixture.detectChanges();

    const form: HTMLFormElement = fixture.nativeElement.querySelector('form.sharing__invite');
    form.dispatchEvent(new Event('submit'));

    const req = httpTesting.expectOne(
      (r) => r.method === 'POST' && r.url.endsWith('/api/pantries/p-1/members'),
    );
    expect(req.request.body).toEqual({ email: 'heidi@example.com' });
    req.flush(MEMBERS[1]);
    httpTesting.expectOne((r) => r.url.endsWith('/api/pantries/p-1/members')).flush(MEMBERS);
  });

  it('has an owner on the invite form, so the browser cannot submit it natively', () => {
    // Stated directly as well, because the symptom of losing it is a page
    // reload that destroys the console output you would debug it with.
    context.load();
    build();
    resolvePantry();
    fixture.detectChanges();
    httpTesting.expectOne((r) => r.url.endsWith('/api/pantries/p-1/members')).flush([MEMBERS[0]]);

    // NgControlStatusGroup adds these, and it only attaches to a form that a
    // formGroup/ngForm directive owns. An unowned form carries none of them —
    // which is precisely the state that let the browser submit it natively.
    const form: HTMLFormElement = fixture.nativeElement.querySelector('form.sharing__invite');
    expect(form.classList.contains('ng-untouched')).toBe(true);
    expect(form.classList.contains('ng-pristine')).toBe(true);
  });
});
