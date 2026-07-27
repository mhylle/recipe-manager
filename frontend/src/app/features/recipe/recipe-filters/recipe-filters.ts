import { Component, ChangeDetectionStrategy, output, signal } from '@angular/core';
import { FormControl, ReactiveFormsModule } from '@angular/forms';
import { Difficulty } from '../../../shared/enums/difficulty.enum';
import { EnumLabelPipe, TranslatePipe } from '../../../shared/i18n';
import type { TranslationKey } from '../../../shared/i18n';

/** A filter chip: the tag value sent to the API, plus the key for its display label. */
interface FilterOption {
  readonly value: string;
  readonly labelKey: TranslationKey;
}

export interface RecipeFilters {
  query: string;
  difficulty: string;
  maxPrepTime: number | null;
  tags: string;
  cuisines: string[];
  proteins: string[];
  courses: string[];
}

@Component({
  selector: 'app-recipe-filters',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [ReactiveFormsModule, TranslatePipe, EnumLabelPipe],
  templateUrl: './recipe-filters.html',
  styleUrl: './recipe-filters.scss',
})
export class RecipeFiltersComponent {
  readonly filtersChanged = output<RecipeFilters>();

  readonly difficultyOptions = Object.values(Difficulty);

  // `value` is matched against tags stored on the recipe and MUST stay English;
  // only `labelKey` drives what the user reads.
  readonly cuisineOptions: readonly FilterOption[] = [
    { value: 'Mexican', labelKey: 'recipe.filters.cuisine.mexican' },
    { value: 'Italian', labelKey: 'recipe.filters.cuisine.italian' },
    { value: 'Thai', labelKey: 'recipe.filters.cuisine.thai' },
    { value: 'Japanese', labelKey: 'recipe.filters.cuisine.japanese' },
    { value: 'Danish', labelKey: 'recipe.filters.cuisine.danish' },
    { value: 'French', labelKey: 'recipe.filters.cuisine.french' },
  ];
  readonly proteinOptions: readonly FilterOption[] = [
    { value: 'Chicken', labelKey: 'recipe.filters.protein.chicken' },
    { value: 'Pork', labelKey: 'recipe.filters.protein.pork' },
    { value: 'Beef', labelKey: 'recipe.filters.protein.beef' },
    { value: 'Fish', labelKey: 'recipe.filters.protein.fish' },
    { value: 'Vegetarian', labelKey: 'recipe.filters.protein.vegetarian' },
  ];
  readonly courseOptions: readonly FilterOption[] = [
    { value: 'Main', labelKey: 'recipe.filters.course.main' },
    { value: 'Dessert', labelKey: 'recipe.filters.course.dessert' },
    { value: 'Appetizer', labelKey: 'recipe.filters.course.appetizer' },
    { value: 'Soup', labelKey: 'recipe.filters.course.soup' },
    { value: 'Snack', labelKey: 'recipe.filters.course.snack' },
  ];

  readonly searchControl = new FormControl('', { nonNullable: true });
  readonly difficultyControl = new FormControl('', { nonNullable: true });
  readonly maxPrepControl = new FormControl<number | null>(null);
  readonly tagsControl = new FormControl('', { nonNullable: true });

  readonly activeCuisines = signal<Set<string>>(new Set());
  readonly activeProteins = signal<Set<string>>(new Set());
  readonly activeCourses = signal<Set<string>>(new Set());

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

  emitFilters(): void {
    this.filtersChanged.emit({
      query: this.searchControl.value,
      difficulty: this.difficultyControl.value,
      maxPrepTime: this.maxPrepControl.value,
      tags: this.tagsControl.value,
      cuisines: Array.from(this.activeCuisines()),
      proteins: Array.from(this.activeProteins()),
      courses: Array.from(this.activeCourses()),
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
    this.emitFilters();
  }
}
