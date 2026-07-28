import 'reflect-metadata';
import { ValidationPipe, ArgumentMetadata, BadRequestException } from '@nestjs/common';
import {
  CreatePantryItemRequestDto,
  UpdatePantryItemRequestDto,
} from '../../pantry/dto/pantry-request.dto.js';
import {
  CreateRecipeRequestDto,
  UpdateRecipeRequestDto,
} from '../../recipe/dto/recipe-request.dto.js';

/**
 * Regression cover for the defect where a `@Body()` typed as an intersection
 * (`SomeDto & { translations?: T[] }`) emitted `design:paramtypes` of `Object`,
 * so ValidationPipe skipped the parameter and every malformed write reached
 * Prisma and came back as an opaque 500.
 */

// Same configuration as main.ts — testing a differently-configured pipe would
// prove nothing about what production actually does.
const pipe = new ValidationPipe({ whitelist: true, transform: true });

const meta = (metatype: ArgumentMetadata['metatype']): ArgumentMetadata => ({
  type: 'body',
  metatype,
  data: '',
});

const VALID_PANTRY = { name: 'Salt', quantity: 1, unit: 'tsp', category: 'spices' };

const VALID_RECIPE = {
  name: 'Test',
  description: 'A test recipe',
  servings: 2,
  prepTime: 5,
  cookTime: 10,
  difficulty: 'easy',
  tags: [],
  instructions: ['Do the thing'],
  ingredients: [{ name: 'Salt', quantity: 1, unit: 'tsp', pantryCategory: 'spices' }],
};

describe('write-body validation actually runs', () => {
  describe('the metatype is a validatable class, not Object', () => {
    // The root cause, asserted directly. If someone reintroduces an inline
    // intersection on the controller, the DTO class here still passes its own
    // tests — so this is the check that speaks to the real failure mode.
    it.each([
      ['CreatePantryItemRequestDto', CreatePantryItemRequestDto],
      ['UpdatePantryItemRequestDto', UpdatePantryItemRequestDto],
      ['CreateRecipeRequestDto', CreateRecipeRequestDto],
      ['UpdateRecipeRequestDto', UpdateRecipeRequestDto],
    ])('%s is a class ValidationPipe will not skip', (_name, dto) => {
      expect(typeof dto).toBe('function');
      expect(dto).not.toBe(Object);
    });
  });

  describe('CreatePantryItemRequestDto', () => {
    it('accepts a valid body', async () => {
      // The distractor: an implementation that rejected everything would pass
      // every negative case below and still be broken.
      await expect(pipe.transform({ ...VALID_PANTRY }, meta(CreatePantryItemRequestDto)))
        .resolves.toEqual(expect.objectContaining({ name: 'Salt' }));
    });

    it('rejects a missing required field', async () => {
      const { category: _omitted, ...withoutCategory } = VALID_PANTRY;
      await expect(
        pipe.transform(withoutCategory, meta(CreatePantryItemRequestDto)),
      ).rejects.toThrow(BadRequestException);
    });

    it('rejects an invalid enum value', async () => {
      await expect(
        pipe.transform({ ...VALID_PANTRY, unit: 'furlong' }, meta(CreatePantryItemRequestDto)),
      ).rejects.toThrow(BadRequestException);
    });

    it('rejects a wrong-typed number', async () => {
      await expect(
        pipe.transform({ ...VALID_PANTRY, quantity: 'lots' }, meta(CreatePantryItemRequestDto)),
      ).rejects.toThrow(BadRequestException);
    });

    it('strips unknown properties instead of passing them through', async () => {
      const result = await pipe.transform(
        { ...VALID_PANTRY, sneaky: 'value' },
        meta(CreatePantryItemRequestDto),
      );
      expect(result).not.toHaveProperty('sneaky');
    });

    it('validates nested translations rather than trusting them', async () => {
      await expect(
        pipe.transform(
          { ...VALID_PANTRY, translations: [{ locale: 'da', name: 42 }] },
          meta(CreatePantryItemRequestDto),
        ),
      ).rejects.toThrow(BadRequestException);
    });

    it('accepts well-formed translations', async () => {
      await expect(
        pipe.transform(
          { ...VALID_PANTRY, translations: [{ locale: 'da', name: 'Salt' }] },
          meta(CreatePantryItemRequestDto),
        ),
      ).resolves.toEqual(expect.objectContaining({ translations: [{ locale: 'da', name: 'Salt' }] }));
    });
  });

  describe('CreateRecipeRequestDto', () => {
    it('accepts a valid body', async () => {
      await expect(
        pipe.transform({ ...VALID_RECIPE }, meta(CreateRecipeRequestDto)),
      ).resolves.toEqual(expect.objectContaining({ name: 'Test' }));
    });

    it('rejects an invalid difficulty', async () => {
      await expect(
        pipe.transform({ ...VALID_RECIPE, difficulty: 'impossible' }, meta(CreateRecipeRequestDto)),
      ).rejects.toThrow(BadRequestException);
    });

    it('rejects an unsupported sourceLocale', async () => {
      // Previously this reached the service and was caught there; now it is
      // named at the boundary. "klingon" got as far as the database once.
      await expect(
        pipe.transform({ ...VALID_RECIPE, sourceLocale: 'klingon' }, meta(CreateRecipeRequestDto)),
      ).rejects.toThrow(BadRequestException);
    });

    it('accepts a supported sourceLocale', async () => {
      await expect(
        pipe.transform({ ...VALID_RECIPE, sourceLocale: 'da' }, meta(CreateRecipeRequestDto)),
      ).resolves.toEqual(expect.objectContaining({ sourceLocale: 'da' }));
    });

    it('validates nested recipe translations', async () => {
      await expect(
        pipe.transform(
          {
            ...VALID_RECIPE,
            translations: [{ locale: 'da', name: 'Test', description: 'x', instructions: 'not-an-array', ingredientNames: [] }],
          },
          meta(CreateRecipeRequestDto),
        ),
      ).rejects.toThrow(BadRequestException);
    });
  });

  describe('partial update DTOs', () => {
    it('allow a body with only some fields', async () => {
      await expect(
        pipe.transform({ quantity: 3 }, meta(UpdatePantryItemRequestDto)),
      ).resolves.toEqual({ quantity: 3 });
    });

    it('still reject a bad value on a field that IS present', async () => {
      // PartialType makes fields optional, not unvalidated.
      await expect(
        pipe.transform({ unit: 'furlong' }, meta(UpdatePantryItemRequestDto)),
      ).rejects.toThrow(BadRequestException);
      await expect(
        pipe.transform({ difficulty: 'impossible' }, meta(UpdateRecipeRequestDto)),
      ).rejects.toThrow(BadRequestException);
    });
  });
});
