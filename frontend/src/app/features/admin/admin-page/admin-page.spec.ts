import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { AdminPageComponent } from './admin-page';
import type { AdminUser } from '../admin.service';

const user = (over: Partial<AdminUser> = {}): AdminUser => ({
  id: 'u-1',
  email: 'cook@example.com',
  displayName: 'A Cook',
  createdAt: '2026-08-06T00:00:00.000Z',
  localContributor: false,
  appGrant: false,
  canContribute: false,
  recipeCount: 0,
  ...over,
});

describe('AdminPageComponent', () => {
  let fixture: ReturnType<typeof TestBed.createComponent<AdminPageComponent>>;
  let component: AdminPageComponent;
  let httpTesting: HttpTestingController;

  beforeEach(() => {
    TestBed.resetTestingModule();
    TestBed.configureTestingModule({
      imports: [AdminPageComponent],
      providers: [provideHttpClient(), provideHttpClientTesting()],
    });
    fixture = TestBed.createComponent(AdminPageComponent);
    component = fixture.componentInstance;
    httpTesting = TestBed.inject(HttpTestingController);

    // checkAuth() in the constructor.
    httpTesting
      .expectOne('/api/auth/validate')
      .flush({ success: true, data: { email: 'owner@example.com' } });
    httpTesting
      .expectOne((r) => r.url.endsWith('/api/me'))
      .flush({ id: 'local-owner', canContribute: true, isOwner: true });
  });

  afterEach(() => httpTesting.verify());

  const flushUsers = (users: AdminUser[]) =>
    httpTesting.expectOne((r) => r.url.endsWith('/api/admin/users')).flush(users);

  it('lists accounts', () => {
    flushUsers([user(), user({ id: 'u-2', displayName: 'Another' })]);

    expect(component.users()).toHaveLength(2);
    expect(component.loading()).toBe(false);
  });

  it('allows someone to contribute', () => {
    flushUsers([user()]);

    component.toggle(component.users()[0]);

    const req = httpTesting.expectOne(
      (r) => r.url.endsWith('/api/admin/users/u-1/contributor') && r.method === 'PUT',
    );
    expect(req.request.body).toEqual({ granted: true });
    req.flush(user({ localContributor: true, canContribute: true }));

    expect(component.users()[0].canContribute).toBe(true);
    expect(component.saving()).toBeNull();
  });

  it('withdraws a grant it previously made', () => {
    flushUsers([user({ localContributor: true, canContribute: true })]);

    component.toggle(component.users()[0]);

    const req = httpTesting.expectOne((r) => r.method === 'PUT');
    expect(req.request.body).toEqual({ granted: false });
    req.flush(user({ localContributor: false, canContribute: false }));

    expect(component.users()[0].canContribute).toBe(false);
  });

  it('says when withdrawing here would change nothing', () => {
    // They hold the auth-service grant as well, so this switch is not what is
    // deciding — a control that appears to do nothing is worse than a note.
    flushUsers([user({ appGrant: true, localContributor: false, canContribute: true })]);

    expect(component.keepsAccessAnyway(component.users()[0])).toBe(true);
  });

  it('does not claim that for someone granted only here', () => {
    flushUsers([user({ appGrant: false, localContributor: true, canContribute: true })]);

    expect(component.keepsAccessAnyway(component.users()[0])).toBe(false);
  });

  it('distinguishes "not allowed to look" from "nobody registered"', () => {
    httpTesting
      .expectOne((r) => r.url.endsWith('/api/admin/users'))
      .flush({ message: 'no' }, { status: 403, statusText: 'Forbidden' });

    expect(component.forbidden()).toBe(true);
    expect(component.failed()).toBe(false);
    expect(component.users()).toEqual([]);
  });

  it('reports a server failure as a failure, not as a permission problem', () => {
    httpTesting
      .expectOne((r) => r.url.endsWith('/api/admin/users'))
      .flush({ message: 'boom' }, { status: 500, statusText: 'Error' });

    expect(component.failed()).toBe(true);
    expect(component.forbidden()).toBe(false);
  });

  it('leaves the row usable again after a failed change', () => {
    flushUsers([user()]);
    component.toggle(component.users()[0]);
    httpTesting
      .expectOne((r) => r.method === 'PUT')
      .flush({ message: 'no' }, { status: 500, statusText: 'Error' });

    expect(component.saving()).toBeNull();
    expect(component.failed()).toBe(true);
  });

  it('ignores a second click while one change is in flight', () => {
    flushUsers([user(), user({ id: 'u-2' })]);

    component.toggle(component.users()[0]);
    component.toggle(component.users()[1]);

    // Only the first was sent.
    httpTesting.expectOne((r) => r.method === 'PUT').flush(user({ localContributor: true }));
  });
});
