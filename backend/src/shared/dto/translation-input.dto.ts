import { IsString, IsArray } from 'class-validator';

/**
 * Per-locale text carried alongside a create/update body.
 *
 * These are real classes rather than inline object types for a concrete reason:
 * `emitDecoratorMetadata` cannot represent an intersection, so a parameter typed
 * `SomeDto & { translations?: T[] }` emits `design:paramtypes` of `Object`.
 * ValidationPipe treats a bare `Object` as non-validatable and skips the
 * parameter entirely — so the DTO's decorators never ran, `whitelist` never
 * stripped unknown keys, and malformed bodies travelled to Prisma and came back
 * as an opaque 500 instead of a 400 naming the bad field.
 */
export class PantryTranslationDto {
  @IsString()
  locale: string;

  @IsString()
  name: string;
}

export class RecipeTranslationDto {
  @IsString()
  locale: string;

  @IsString()
  name: string;

  @IsString()
  description: string;

  @IsArray()
  @IsString({ each: true })
  instructions: string[];

  /** Ingredient names, positionally aligned with the recipe's `ingredients`. */
  @IsArray()
  @IsString({ each: true })
  ingredientNames: string[];
}
