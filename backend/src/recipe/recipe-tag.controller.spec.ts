import { PATH_METADATA } from '@nestjs/common/constants';
import { RecipeTagController } from './recipe-tag.controller.js';
import { RecipeController } from './recipe.controller.js';
import { TAG_VOCABULARY } from './recipe-tags.js';

describe('GET /recipe-tags', () => {
  const controller = new RecipeTagController();

  it('serves the whole vocabulary', () => {
    expect(controller.getTagVocabulary()).toEqual(TAG_VOCABULARY);
  });

  it('tells the client that asian stands over thai and japanese', () => {
    const asian = controller
      .getTagVocabulary()
      .cuisines.find((tag) => tag.value === 'asian');
    expect(asian?.children).toEqual(['thai', 'japanese']);
  });

  it('lives on its own path, where no :id route can shadow it', () => {
    // Moved back onto RecipeController it would sit below `@Get(':id')`, and
    // Nest matches in declaration order: the URL would answer 404 "Recipe not
    // found" with nothing failing — the handler itself is fine.
    expect(Reflect.getMetadata(PATH_METADATA, RecipeTagController)).toBe(
      'recipe-tags',
    );
    const proto = RecipeController.prototype as unknown as Record<string, object>;
    const onRecipes = Object.getOwnPropertyNames(proto).filter(
      (name) => name !== 'constructor' && name.toLowerCase().includes('vocabulary'),
    );
    expect(onRecipes).toEqual([]);
  });
});
