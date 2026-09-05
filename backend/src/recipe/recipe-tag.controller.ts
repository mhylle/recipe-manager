import { Controller, Get } from '@nestjs/common';
import { TAG_VOCABULARY, type TagVocabulary } from './recipe-tags.js';

/**
 * The tag vocabulary the filters and the authoring form are built from.
 *
 * Its own controller rather than another route on RecipeController, for two
 * reasons that both bite otherwise:
 *
 * 1. It returns no recipe data, so it does not belong on the identity-aware
 *    recipe read surface. `guard-coverage.spec.ts` requires every GET there to
 *    carry OptionalSsoAuthGuard so private recipes can be filtered per caller —
 *    a rule about recipe payloads, which a fixed word list has none of.
 * 2. On RecipeController it would have to be declared above `@Get(':id')`, or
 *    Nest matches in declaration order and answers 404 "Recipe not found". A
 *    separate path cannot be shadowed by anything.
 *
 * Public and unauthenticated: the recipe list is readable without signing in,
 * and the filters have to render before anything else happens.
 */
@Controller('recipe-tags')
export class RecipeTagController {
  @Get()
  getTagVocabulary(): TagVocabulary {
    return TAG_VOCABULARY;
  }
}
