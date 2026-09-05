import { TestBed } from '@angular/core/testing';
import { describe, it, expect, beforeEach } from 'vitest';
import { provideHttpClient } from '@angular/common/http';
import {
  provideHttpClientTesting,
  HttpTestingController,
} from '@angular/common/http/testing';
import { RecipeTagService } from './recipe-tag.service';
import { EMPTY_VOCABULARY } from './recipe-tags';

describe('RecipeTagService', () => {
  let http: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [provideHttpClient(), provideHttpClientTesting()],
    });
    http = TestBed.inject(HttpTestingController);
  });

  it('asks the backend for the vocabulary and publishes it', () => {
    const service = TestBed.inject(RecipeTagService);
    expect(service.vocabulary()).toEqual(EMPTY_VOCABULARY);

    const request = http.expectOne((r) => r.url.endsWith('/recipe-tags'));
    expect(request.request.method).toBe('GET');
    request.flush({
      cuisines: [{ value: 'asian', children: ['thai', 'japanese'] }],
      proteins: [],
      courses: [],
    });

    expect(service.vocabulary().cuisines[0].children).toEqual(['thai', 'japanese']);
  });

  it('degrades to an empty vocabulary when the fetch fails', () => {
    // The filter bar must still render: search and difficulty do not depend on
    // this list, and a bar that refuses to appear is worse than a shorter one.
    const service = TestBed.inject(RecipeTagService);
    http
      .expectOne((r) => r.url.endsWith('/recipe-tags'))
      .error(new ProgressEvent('network error'));

    expect(service.vocabulary()).toEqual(EMPTY_VOCABULARY);
  });
});
