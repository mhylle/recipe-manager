import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { BilkaToGoSendResult } from '../../../shared/models/bilkatogo.model';
import { environment } from '../../../../environments/environment';

@Injectable({ providedIn: 'root' })
export class BilkaToGoService {
  private readonly http = inject(HttpClient);
  private readonly baseUrl = `${environment.apiBase}/api/bilkatogo`;

  login(email: string, password: string): Observable<{ sessionId: string }> {
    return this.http.post<{ sessionId: string }>(`${this.baseUrl}/login`, { email, password });
  }

  sendToCart(shoppingListId: string, sessionId: string): Observable<BilkaToGoSendResult> {
    return this.http.post<BilkaToGoSendResult>(`${this.baseUrl}/send`, { shoppingListId, sessionId });
  }
}
