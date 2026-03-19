import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { StaplesConfig } from '../../shared/models/staples-config.model';

@Injectable({ providedIn: 'root' })
export class StaplesService {
  private readonly http = inject(HttpClient);
  private readonly baseUrl = '/api/staples';

  getStaples(): Observable<StaplesConfig> {
    return this.http.get<StaplesConfig>(this.baseUrl);
  }

  updateStaples(config: StaplesConfig): Observable<StaplesConfig> {
    return this.http.put<StaplesConfig>(this.baseUrl, config);
  }
}
