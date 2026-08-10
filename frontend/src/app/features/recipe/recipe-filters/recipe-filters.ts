import {
  Component,
  ChangeDetectionStrategy,
  computed,
  inject,
  output,
  signal,
} from '@angular/core';
import { FormControl, ReactiveFormsModule } from '@angular/forms';
import { Difficulty } from '../../../shared/enums/difficulty.enum';
import { EnumLabelPipe, TranslatePipe } from '../../../shared/i18n';
import {
  COURSE_TAGS,
  CUISINE_TAGS,
  PROTEIN_TAGS,
  type TagOption,
} from '../recipe-tags';
import { AuthService } from '../../../shared/services/auth.service';

export interface RecipeFilters {
  query: string;
  difficulty: string;
  maxPrepTime: number | null;
  tags: string;
  cuisines: string[];
  proteins: string[];
  courses: string[];
  /** Narrow to the recipes this reader liked. Always false for a guest. */
  likedOnly: boolean;
}

@Component({
  selector: 'app-recipe-filters',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [ReactiveFormsModule, TranslatePipe, EnumLabelPipe],
  templateUrl: './recipe-filters.html',
  styleUrl: './recipe-filters.scss',
})
export class RecipeFiltersComponent {
  private readonly auth = inject(AuthService);

  readonly filtersChanged = output<RecipeFilters>();

  readonly difficultyOptions = Object.values(Difficulty);

  // The vocabulary itself lives in recipe-tags.ts, shared with the authoring
  // form. Copied into both, the two lists drift and the form starts offering
  // tags no filter matches — which is the bug this extraction exists to stop.
  readonly cuisineOptions: readonly TagOption[] = CUISINE_TAGS;
  readonly proteinOptions: readonly TagOption[] = PROTEIN_TAGS;
  readonly courseOptions: readonly TagOption[] = COURSE_TAGS;

  readonly searchControl = new FormControl('', { nonNullable: true });
  readonly difficultyControl = new FormControl('', { nonNullable: true });
  readonly maxPrepControl = new FormControl<number | null>(null);
  readonly tagsControl = new FormControl('', { nonNullable: true });

  readonly activeCuisines = signal<Set<string>>(new Set());
  readonly activeProteins = signal<Set<string>>(new Set());
  readonly activeCourses = signal<Set<string>>(new Set());
  readonly likedOnly = signal(false);

  /** A guest has no likes, so the chip would only ever empty the list. */
  readonly canFilterLikes = computed(() => this.auth.isAuthenticated());

  toggleCuisine(value: string): void {
    this.activeCuisines.update(s => {
      const next = new Set(s);
      next.has(value) ? next.delete(value) : next.add(value);
      return next;
    });
    this.emitFilters();
  }

  toggleProtein(value: string): void {
    this.activeProteins.update(s => {
      const next = new Set(s);
      next.has(value) ? next.delete(value) : next.add(value);
      return next;
    });
    this.emitFilters();
  }

  toggleCourse(value: string): void {
    this.activeCourses.update(s => {
      const next = new Set(s);
      next.has(value) ? next.delete(value) : next.add(value);
      return next;
    });
    this.emitFilters();
  }

  toggleLikedOnly(): void {
    this.likedOnly.update((on) => !on);
    this.emitFilters();
  }

  emitFilters(): void {
    this.filtersChanged.emit({
      query: this.searchControl.value,
      difficulty: this.difficultyControl.value,
      maxPrepTime: this.maxPrepControl.value,
      tags: this.tagsControl.value,
      cuisines: Array.from(this.activeCuisines()),
      proteins: Array.from(this.activeProteins()),
      courses: Array.from(this.activeCourses()),
      likedOnly: this.likedOnly(),
    });
  }

  resetFilters(): void {
    this.searchControl.reset();
    this.difficultyControl.reset();
    this.maxPrepControl.reset();
    this.tagsControl.reset();
    this.activeCuisines.set(new Set());
    this.activeProteins.set(new Set());
    this.activeCourses.set(new Set());
    this.likedOnly.set(false);
    this.emitFilters();
  }
}
