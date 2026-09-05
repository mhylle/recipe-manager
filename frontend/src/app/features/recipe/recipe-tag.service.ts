import { Injectable, inject, signal } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { environment } from '../../../environments/environment';
import { EMPTY_VOCABULARY, type TagVocabulary } from './recipe-tags';

/**
 * The tag vocabulary, fetched once from the backend that owns it.
 *
 * A root singleton with a signal rather than an observable per caller: the
 * filters, the authoring form and the list all need the same words, and this way
 * they share one request and re-render when it lands.
 *
 * The values are canonical English and identical in every language, so unlike
 * recipe content this is NOT re-fetched on a language switch — the display names
 * come from the local dictionaries.
 */
@Injectable({ providedIn: 'root' })
export class RecipeTagService {
  private readonly http = inject(HttpClient);
  private readonly url = `${environment.apiBase}/api/recipe-tags`;

  private readonly loaded = signal<TagVocabulary>(EMPTY_VOCABULARY);

  /** The served vocabulary, or an empty one until the fetch lands. */
  readonly vocabulary = this.loaded.asReadonly();

  constructor() {
    this.http.get<TagVocabulary>(this.url).subscribe({
      next: (vocabulary) => this.loaded.set(vocabulary),
      // Deliberate degradation rather than a thrown error: the chip rows render
      // empty and search, difficulty and the free-text tag box still work. A
      // filter bar that refuses to appear because one auxiliary GET failed is
      // worse than one with fewer controls.
      error: () => this.loaded.set(EMPTY_VOCABULARY),
    });
  }
}
