import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../../../environments/environment';

export interface PantryMember {
  userId: string;
  displayName: string;
  email: string;
  role: string;
  isYou: boolean;
}

@Injectable({ providedIn: 'root' })
export class PantrySharingService {
  private readonly http = inject(HttpClient);
  private readonly baseUrl = `${environment.apiBase}/api/pantries`;

  members(pantryId: string): Observable<PantryMember[]> {
    return this.http.get<PantryMember[]>(`${this.baseUrl}/${pantryId}/members`);
  }

  invite(pantryId: string, email: string): Observable<PantryMember> {
    return this.http.post<PantryMember>(`${this.baseUrl}/${pantryId}/members`, { email });
  }

  remove(pantryId: string, userId: string): Observable<void> {
    return this.http.delete<void>(`${this.baseUrl}/${pantryId}/members/${userId}`);
  }

  create(name: string): Observable<{ id: string }> {
    return this.http.post<{ id: string }>(this.baseUrl, { name });
  }
}
