import { ForbiddenException, NotFoundException } from '@nestjs/common';

/**
 * Only the person who added a recipe may change or remove it.
 *
 * The library is shared for READING — everyone sees every recipe — but editing
 * someone else's is not part of that. Before this, any signed-in user could
 * change or delete anything in the collection; the UI hid the buttons, which
 * hides buttons and nothing else.
 *
 * Deliberately a plain function rather than a guard: it needs the recipe row,
 * which only the service has by the time it matters.
 */
export function assertCanModify(
  recipe: { createdById?: string | null } | null,
  callerId: string,
): void {
  if (!recipe) {
    // 404 before 403, so a probe cannot use the error to learn that a given id
    // exists and belongs to someone else.
    throw new NotFoundException('Recipe not found');
  }
  if (!recipe.createdById || !callerId || recipe.createdById !== callerId) {
    throw new ForbiddenException(
      'Only the person who added this recipe can change it.',
    );
  }
}
