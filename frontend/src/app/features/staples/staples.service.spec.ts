import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { describe, it, expect, beforeEach } from 'vitest';
import { StaplesService } from './staples.service';
import { StaplesConfig } from '../../shared/models/staples-config.model';

describe('StaplesService', () => {
  let service: StaplesService;
  let httpTesting: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [provideHttpClient(), provideHttpClientTesting()],
    });

    service = TestBed.inject(StaplesService);
    httpTesting = TestBed.inject(HttpTestingController);
  });

  it('getStaples should call GET /api/staples', () => {
    const mockConfig: StaplesConfig = { items: ['salt', 'pepper'] };

    service.getStaples().subscribe((config) => {
      expect(config).toEqual(mockConfig);
    });

    const req = httpTesting.expectOne('/api/staples');
    expect(req.request.method).toBe('GET');
    req.flush(mockConfig);
  });

  it('updateStaples should call PUT /api/staples with body', () => {
    const config: StaplesConfig = { items: ['salt', 'pepper', 'oil'] };

    service.updateStaples(config).subscribe((result) => {
      expect(result).toEqual(config);
    });

    const req = httpTesting.expectOne('/api/staples');
    expect(req.request.method).toBe('PUT');
    expect(req.request.body).toEqual(config);
    req.flush(config);
  });
});
