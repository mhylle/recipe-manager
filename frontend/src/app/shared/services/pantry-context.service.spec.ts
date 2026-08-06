import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { PantryContextService } from './pantry-context.service';

describe('PantryContextService', () => {
  let service: PantryContextService;
  let httpTesting: HttpTestingController;

  beforeEach(() => {
    TestBed.resetTestingModule();
    TestBed.configureTestingModule({
      providers: [provideHttpClient(), provideHttpClientTesting()],
    });
    service = TestBed.inject(PantryContextService);
    httpTesting = TestBed.inject(HttpTestingController);
    localStorage.clear();
  });

  afterEach(() => {
    httpTesting.verify();
    localStorage.clear();
  });

  const flushMine = (list: unknown[]) =>
    httpTesting.expectOne((r) => r.url.endsWith('/api/pantry/mine')).flush(list);

  describe('load', () => {
    it('reports no-pantry rather than an empty kitchen', () => {
      // Three states look identical if you only check for an empty array, and
      // conflating them is what left new users at a dead end.
      service.load();
      flushMine([]);

      expect(service.state()).toBe('no-pantry');
    });

    it('reports anonymous for a guest, not no-pantry', () => {
      service.load();
      httpTesting
        .expectOne((r) => r.url.endsWith('/api/pantry/mine'))
        .flush({ message: 'no' }, { status: 401, statusText: 'Unauthorized' });

      // Telling a signed-out visitor they have no kitchen sends them to create
      // one they cannot create.
      expect(service.state()).toBe('anonymous');
    });

    it('selects a kitchen when there is one', () => {
      service.load();
      flushMine([{ id: 'p-1', name: 'Mine', role: 'owner', isOwner: true, memberCount: 1 }]);

      expect(service.state()).toBe('ready');
      expect(service.currentId()).toBe('p-1');
    });
  });

  describe('create', () => {
    it('posts to the PLURAL pantries path', () => {
      // Creating and sharing sit on a different controller from the item CRUD;
      // getting this wrong is a 404 that looks like a permissions problem.
      service.create('Peter’s kitchen').subscribe();

      const req = httpTesting.expectOne(
        (r) => r.url.endsWith('/api/pantries') && r.method === 'POST',
      );
      expect(req.request.body).toEqual({ name: 'Peter’s kitchen' });
      req.flush({ id: 'p-new' });

      // Reloads, so role and member count come from the server.
      flushMine([{ id: 'p-new', name: 'Peter’s kitchen', role: 'owner', isOwner: true, memberCount: 1 }]);
    });

    it('leaves the new owner ready to add items and invite people', () => {
      service.create('Peter’s kitchen').subscribe();
      httpTesting.expectOne((r) => r.method === 'POST').flush({ id: 'p-new' });
      flushMine([
        { id: 'p-new', name: 'Peter’s kitchen', role: 'owner', isOwner: true, memberCount: 1 },
      ]);

      expect(service.state()).toBe('ready');
      expect(service.current()?.isOwner).toBe(true);
    });

    it('does not reload when creation fails', () => {
      service.create('Peter’s kitchen').subscribe({ error: () => undefined });
      httpTesting
        .expectOne((r) => r.method === 'POST')
        .flush({ message: 'no' }, { status: 500, statusText: 'Error' });

      // No /mine request to satisfy: verify() in afterEach would fail if one
      // had been issued.
      expect(service.state()).toBe('loading');
    });
  });
});
