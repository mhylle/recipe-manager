import { TestBed } from '@angular/core/testing';
import { HttpClient, provideHttpClient, withInterceptors } from '@angular/common/http';
import {
  HttpTestingController,
  provideHttpClientTesting,
} from '@angular/common/http/testing';
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { localeInterceptor } from './locale.interceptor';
import { LocaleService } from './locale.service';

describe('localeInterceptor', () => {
  let http: HttpClient;
  let controller: HttpTestingController;
  let locale: LocaleService;

  beforeEach(() => {
    localStorage.clear();
    vi.spyOn(window.navigator, 'language', 'get').mockReturnValue('en-US');

    TestBed.configureTestingModule({
      providers: [
        provideHttpClient(withInterceptors([localeInterceptor])),
        provideHttpClientTesting(),
      ],
    });
    http = TestBed.inject(HttpClient);
    controller = TestBed.inject(HttpTestingController);
    locale = TestBed.inject(LocaleService);
  });

  afterEach(() => {
    controller.verify();
    vi.restoreAllMocks();
    localStorage.clear();
  });

  it('sends the active locale as a BCP-47 Accept-Language header', () => {
    http.get('/api/recipes').subscribe();
    const req = controller.expectOne('/api/recipes');
    expect(req.request.headers.get('Accept-Language')).toBe('en-US');
    req.flush({});
  });

  it('follows a language switch on subsequent requests', () => {
    locale.setLocale('da');

    http.get('/api/recipes').subscribe();
    const req = controller.expectOne('/api/recipes');
    expect(req.request.headers.get('Accept-Language')).toBe('da-DK');
    req.flush({});
  });

  it('does not clobber an Accept-Language the caller set deliberately', () => {
    http.get('/api/recipes', { headers: { 'Accept-Language': 'fr-FR' } }).subscribe();
    const req = controller.expectOne('/api/recipes');
    expect(req.request.headers.get('Accept-Language')).toBe('fr-FR');
    req.flush({});
  });

  it('leaves cross-origin requests alone', () => {
    // BilkaToGo and other third parties must not receive our UI locale header.
    http.get('https://example.com/thing').subscribe();
    const req = controller.expectOne('https://example.com/thing');
    expect(req.request.headers.has('Accept-Language')).toBe(false);
    req.flush({});
  });
});
