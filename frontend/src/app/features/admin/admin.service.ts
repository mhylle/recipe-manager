import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../../environments/environment';

/** A person, as the owner needs to see them to decide about access. */
export interface AdminUser {
  id: string;
  email: string;
  displayName: string;
  createdAt: string;
  /** Granted here, on this page. The owner controls this one. */
  localContributor: boolean;
  /** Granted in the auth-service, via the token's `apps` claim. Read-only. */
  appGrant: boolean;
  /** What the API will actually decide — the OR of the two above. */
  canContribute: boolean;
  recipeCount: number;
}

@Injectable({ providedIn: 'root' })
export class AdminService {
  private readonly http = inject(HttpClient);
  private readonly baseUrl = `${environment.apiBase}/api/admin`;

  listUsers(): Observable<AdminUser[]> {
    return this.http.get<AdminUser[]>(`${this.baseUrl}/users`, {
      withCredentials: true,
    });
  }

  setContributor(id: string, granted: boolean): Observable<AdminUser> {
    return this.http.put<AdminUser>(
      `${this.baseUrl}/users/${id}/contributor`,
      { granted },
      { withCredentials: true },
    );
  }
}
