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

/** An MCP credential as listed — never the token itself. */
export interface McpKeyView {
  id: string;
  label: string;
  prefix: string;
  createdAt: string;
  lastUsedAt: string | null;
  revokedAt: string | null;
}

/** The one response that carries the token. */
export interface McpKeyCreated extends McpKeyView {
  token: string;
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

  listMcpKeys(): Observable<McpKeyView[]> {
    return this.http.get<McpKeyView[]>(`${this.baseUrl}/mcp-keys`, {
      withCredentials: true,
    });
  }

  /**
   * Mint a key. The token comes back exactly once — show it immediately, because
   * nothing can retrieve it again.
   */
  createMcpKey(label: string): Observable<McpKeyCreated> {
    return this.http.post<McpKeyCreated>(
      `${this.baseUrl}/mcp-keys`,
      { label },
      { withCredentials: true },
    );
  }

  revokeMcpKey(id: string): Observable<void> {
    return this.http.delete<void>(`${this.baseUrl}/mcp-keys/${id}`, {
      withCredentials: true,
    });
  }
}
