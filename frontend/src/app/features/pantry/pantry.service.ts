import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { PantryItem } from '../../shared/models/pantry-item.model';
import { environment } from '../../../environments/environment';

@Injectable({ providedIn: 'root' })
export class PantryService {
  private readonly http = inject(HttpClient);
  private readonly baseUrl = `${environment.apiBase}/api/pantry`;

  getAll(): Observable<PantryItem[]> {
    return this.http.get<PantryItem[]>(this.baseUrl);
  }

  getById(id: string): Observable<PantryItem> {
    return this.http.get<PantryItem>(`${this.baseUrl}/${id}`);
  }

  create(item: Omit<PantryItem, 'id' | 'addedDate' | 'lastUpdated'>): Observable<PantryItem> {
    return this.http.post<PantryItem>(this.baseUrl, item);
  }

  update(id: string, item: Partial<PantryItem>): Observable<PantryItem> {
    return this.http.patch<PantryItem>(`${this.baseUrl}/${id}`, item);
  }

  delete(id: string): Observable<void> {
    return this.http.delete<void>(`${this.baseUrl}/${id}`);
  }
}
