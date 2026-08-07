import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../../environments/environment';

export type ReportKind = 'defect' | 'improvement';

export interface Report {
  id: string;
  kind: ReportKind;
  title: string;
  description: string;
  pagePath: string | null;
  createdAt: string;
  reporterName: string;
  /** Null when it is not on GitHub — for any reason. */
  githubIssueUrl: string | null;
  githubIssueNumber: number | null;
  githubError: string | null;
  /** GitHub's current view. Null means unknown, never assumed open. */
  githubState: 'open' | 'closed' | null;
}

@Injectable({ providedIn: 'root' })
export class ReportsService {
  private readonly http = inject(HttpClient);
  private readonly baseUrl = `${environment.apiBase}/api/reports`;

  send(input: {
    kind: ReportKind;
    title: string;
    description: string;
    pagePath?: string;
  }): Observable<Report> {
    return this.http.post<Report>(this.baseUrl, input, { withCredentials: true });
  }

  mine(): Observable<Report[]> {
    return this.http.get<Report[]>(`${this.baseUrl}/mine`, { withCredentials: true });
  }

  /** Everything, for the owner. 403 for anyone else. */
  all(): Observable<Report[]> {
    return this.http.get<Report[]>(this.baseUrl, { withCredentials: true });
  }
}
