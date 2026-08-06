import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../../environments/environment';

/** What the backend knows about a stored key — never the key itself. */
export interface GeminiKeyState {
  configured: boolean;
  /** The encrypted envelope, to be opened in the browser. Null when unset. */
  envelope: string | null;
  updatedAt: string | null;
}

/**
 * A user's own settings.
 *
 * The envelope crosses this boundary already encrypted — see key-envelope.ts.
 * Nothing here ever handles a plaintext API key, which is what keeps the secret
 * out of the request that stores it.
 */
@Injectable({ providedIn: 'root' })
export class ProfileService {
  private readonly http = inject(HttpClient);
  private readonly baseUrl = `${environment.apiBase}/api/profile`;

  getGeminiKey(): Observable<GeminiKeyState> {
    return this.http.get<GeminiKeyState>(`${this.baseUrl}/gemini-key`, {
      withCredentials: true,
    });
  }

  saveGeminiKey(envelope: string): Observable<GeminiKeyState> {
    return this.http.put<GeminiKeyState>(
      `${this.baseUrl}/gemini-key`,
      { envelope },
      { withCredentials: true },
    );
  }

  deleteGeminiKey(): Observable<void> {
    return this.http.delete<void>(`${this.baseUrl}/gemini-key`, {
      withCredentials: true,
    });
  }
}
