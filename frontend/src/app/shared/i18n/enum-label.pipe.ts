import { Pipe, PipeTransform, inject } from '@angular/core';
import { LocaleService } from './locale.service';
import type { TranslationKey } from './en';
import type { DayOfWeek, Difficulty, MealType, PantryCategory, Unit } from '../enums';

/** Which enum a value belongs to, and therefore which label namespace to read. */
interface EnumValueByKind {
  difficulty: Difficulty;
  unit: Unit;
  pantryCategory: PantryCategory;
  mealType: MealType;
  dayOfWeek: DayOfWeek;
  dayOfWeekShort: DayOfWeek;
}

export type EnumKind = keyof EnumValueByKind;

/**
 * Renders an enum's *display* label in the active language:
 * `{{ recipe.difficulty | enumLabel: 'difficulty' }}`.
 *
 * The stored and wire values stay the untouched English identifiers ('easy',
 * 'tbsp', 'monday') — only what the user reads changes. That matters: these values
 * go to the API and the database, and translating them would corrupt both.
 *
 * The generic ties value to kind, so `unit | enumLabel: 'difficulty'` is a compile
 * error rather than a mystery blank at runtime.
 *
 * Impure for the same reason as TranslatePipe — see the note there.
 */
@Pipe({ name: 'enumLabel', pure: false })
export class EnumLabelPipe implements PipeTransform {
  private readonly locale = inject(LocaleService);

  transform<K extends EnumKind>(value: EnumValueByKind[K], kind: K): string {
    // Safe by construction: en.ts is `satisfies Record<EnumLabelKey, string>`, so
    // every kind/value pair in EnumValueByKind is guaranteed to have a label.
    return this.locale.translate(`enum.${kind}.${value}` as TranslationKey);
  }
}
