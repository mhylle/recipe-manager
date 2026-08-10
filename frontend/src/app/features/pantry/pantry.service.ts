import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { PantryItem } from '../../shared/models/pantry-item.model';
import { PantryTranslation } from '../../shared/models/translation.model';
import { bcp47Of, type Locale } from '../../shared/i18n';
import { environment } from '../../../environments/environment';
import type { ScannedProduct } from '../../shared/models/scanned-product.model';

@Injectable({ providedIn: 'root' })
export class PantryService {
  private readonly http = inject(HttpClient);
  private readonly baseUrl = `${environment.apiBase}/api/pantry`;

  getAll(): Observable<PantryItem[]> {
    return this.http.get<PantryItem[]>(this.baseUrl);
  }

  /**
   * What a scanned barcode is, as far as an open database knows.
   *
   * Null is an ordinary answer: most of a Danish supermarket is missing from
   * Open Food Facts, and the form stays fillable by hand.
   */
  lookupBarcode(barcode: string): Observable<ScannedProduct | null> {
    return this.http.get<ScannedProduct | null>(
      `${this.baseUrl}/lookup/${encodeURIComponent(barcode)}`,
    );
  }

  getById(id: string): Observable<PantryItem> {
    return this.http.get<PantryItem>(`${this.baseUrl}/${id}`);
  }

  /** Every language stored for an item — drives the per-language editing tabs. */
  getTranslations(id: string): Observable<PantryTranslation[]> {
    return this.http.get<PantryTranslation[]>(`${this.baseUrl}/${id}/translations`);
  }

  create(
    item: Omit<PantryItem, 'id' | 'addedDate' | 'lastUpdated'> & {
      translations?: PantryTranslation[];
    },
    authoringLocale?: Locale,
  ): Observable<PantryItem> {
    return this.http.post<PantryItem>(this.baseUrl, item, authoringHeader(authoringLocale));
  }

  update(
    id: string,
    item: Partial<PantryItem> & { translations?: PantryTranslation[] },
    authoringLocale?: Locale,
  ): Observable<PantryItem> {
    return this.http.patch<PantryItem>(
      `${this.baseUrl}/${id}`,
      item,
      authoringHeader(authoringLocale),
    );
  }

  delete(id: string): Observable<void> {
    return this.http.delete<void>(`${this.baseUrl}/${id}`);
  }
}

/**
 * Pin the request to the language being AUTHORED (the open tab), which need not be
 * the language the UI is displayed in. The locale interceptor yields to a
 * caller-set Accept-Language precisely so this is possible.
 */
function authoringHeader(locale: Locale | undefined) {
  return locale ? { headers: { 'Accept-Language': bcp47Of(locale) } } : {};
}
