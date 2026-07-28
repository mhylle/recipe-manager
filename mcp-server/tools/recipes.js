import { api, buildResponse, localeProperty, SUPPORTED_LOCALES } from '../lib/api-client.js';

const INGREDIENT_SCHEMA = {
  type: 'object',
  properties: {
    name: { type: 'string' },
    quantity: { type: 'number' },
    unit: {
      type: 'string',
      enum: ['g', 'kg', 'ml', 'l', 'tsp', 'tbsp', 'piece', 'pinch'],
    },
    pantryCategory: {
      type: 'string',
      enum: [
        'dairy', 'meat', 'produce', 'grains', 'spices', 'condiments',
        'baking', 'frozen', 'canned', 'beverages', 'snacks', 'other',
      ],
    },
  },
  required: ['name', 'quantity', 'unit', 'pantryCategory'],
};

export const tools = [
  {
    name: 'recipes_list',
    description:
      'List recipes, optionally filtered. Returns every recipe when called with no arguments, so prefer narrowing with `query` or `tags` when the user is looking for something specific. Text comes back in the requested language.',
    inputSchema: {
      type: 'object',
      properties: {
        query: { type: 'string', description: 'Free-text search across name and description.' },
        difficulty: { type: 'string', enum: ['easy', 'medium', 'hard'] },
        maxPrepTime: { type: 'number', description: 'Maximum preparation time in minutes.' },
        tags: {
          type: 'string',
          description:
            "Comma-separated tags, ALL of which must match, e.g. 'Mexican,Chicken'. Tags are canonical English regardless of the display language.",
        },
        ...localeProperty,
      },
    },
    // getAll, not get: the API paginates, and a partial list reported as the
    // whole collection is worse than an error, because nothing looks wrong.
    handler: ({ query, difficulty, maxPrepTime, tags, locale }) =>
      api.getAll('/recipes', { locale, query: { q: query, difficulty, maxPrepTime, tags } }),
  },

  {
    name: 'recipes_get',
    description:
      'Fetch one recipe in full — ingredients with quantities, and the numbered method. Use this before answering questions about how to cook something; `recipes_list` returns the same shape but is wasteful for a single dish.',
    inputSchema: {
      type: 'object',
      properties: {
        id: { type: 'string', description: 'Recipe id.' },
        ...localeProperty,
      },
      required: ['id'],
    },
    handler: ({ id, locale }) => api.get(`/recipes/${id}`, { locale }),
  },

  {
    name: 'recipes_get_translations',
    description:
      'Every stored language for a recipe. Use this to see which languages a recipe has been written in, or to read one language while the rest of the session runs in another.',
    inputSchema: {
      type: 'object',
      properties: { id: { type: 'string' } },
      required: ['id'],
    },
    handler: ({ id }) => api.get(`/recipes/${id}/translations`),
  },

  {
    name: 'recipes_create',
    description:
      'Create a recipe. The flat fields are the text in the AUTHORING language (`locale`), which becomes the recipe\'s source language. Supply `translations` to write other languages in the same call — doing it in one request keeps the write atomic.\n\nTags are canonical English facets used for filtering (e.g. Mexican, Chicken, Main, Dessert, Baking) and are NOT translated.',
    inputSchema: {
      type: 'object',
      properties: {
        name: { type: 'string' },
        description: { type: 'string' },
        servings: { type: 'number' },
        prepTime: { type: 'number', description: 'Minutes of hands-on preparation.' },
        cookTime: { type: 'number', description: 'Minutes of cooking. Use 0 for no-bake dishes.' },
        difficulty: { type: 'string', enum: ['easy', 'medium', 'hard'] },
        tags: { type: 'array', items: { type: 'string' } },
        instructions: {
          type: 'array',
          items: { type: 'string' },
          description: 'Ordered steps, one sentence or short paragraph each.',
        },
        ingredients: { type: 'array', items: INGREDIENT_SCHEMA },
        imageUrl: { type: 'string' },
        translations: {
          type: 'array',
          description: 'Additional languages for the same recipe.',
          items: {
            type: 'object',
            properties: {
              locale: { type: 'string', enum: SUPPORTED_LOCALES },
              name: { type: 'string' },
              description: { type: 'string' },
              instructions: { type: 'array', items: { type: 'string' } },
              ingredientNames: {
                type: 'array',
                items: { type: 'string' },
                description:
                  'Ingredient names in this language, in the SAME ORDER as `ingredients`. They are matched by position, so a mismatched length attaches names to the wrong ingredients.',
              },
            },
            required: ['locale', 'name', 'description', 'instructions'],
          },
        },
        ...localeProperty,
      },
      required: [
        'name', 'description', 'servings', 'prepTime', 'cookTime',
        'difficulty', 'instructions', 'ingredients',
      ],
    },
    handler: ({ locale, ...body }) => api.post('/recipes', { tags: [], ...body }, { locale }),
  },

  {
    name: 'recipes_update',
    description:
      'Update a recipe. Only the fields you send change.\n\nIMPORTANT: text you send edits the language given by `locale`, not the source language. Sending an English name with locale "da" overwrites the DANISH text with English. When adding a language to an existing recipe, prefer `translations` and leave the flat text fields out.',
    inputSchema: {
      type: 'object',
      properties: {
        id: { type: 'string' },
        name: { type: 'string' },
        description: { type: 'string' },
        servings: { type: 'number' },
        prepTime: { type: 'number' },
        cookTime: { type: 'number' },
        difficulty: { type: 'string', enum: ['easy', 'medium', 'hard'] },
        tags: { type: 'array', items: { type: 'string' } },
        instructions: { type: 'array', items: { type: 'string' } },
        ingredients: { type: 'array', items: INGREDIENT_SCHEMA },
        imageUrl: { type: 'string' },
        translations: {
          type: 'array',
          items: {
            type: 'object',
            properties: {
              locale: { type: 'string', enum: SUPPORTED_LOCALES },
              name: { type: 'string' },
              description: { type: 'string' },
              instructions: { type: 'array', items: { type: 'string' } },
              ingredientNames: { type: 'array', items: { type: 'string' } },
            },
            required: ['locale'],
          },
        },
        ...localeProperty,
      },
      required: ['id'],
    },
    handler: ({ id, locale, ...body }) => api.patch(`/recipes/${id}`, body, { locale }),
  },

  {
    name: 'recipes_delete',
    description:
      'Permanently delete a recipe and all its translations. There is no undo — confirm with the user before calling.',
    inputSchema: {
      type: 'object',
      properties: { id: { type: 'string' } },
      required: ['id'],
    },
    handler: async ({ id }) => {
      await api.del(`/recipes/${id}`);
      return { deleted: id };
    },
  },

  {
    name: 'recipes_what_can_i_cook',
    description:
      "Match the whole recipe library against what is actually in the pantry. Returns three groups: `canMakeNow` (everything in stock), `almostCanMake` (with the specific missing ingredients listed), and `missingMany`.\n\nThis is the right tool for \"what can I make tonight?\" — do not fetch all recipes and reason about the pantry by hand.",
    inputSchema: { type: 'object', properties: { ...localeProperty } },
    handler: ({ locale }) => api.get('/recipes/match', { locale }),
  },
];

export const handlers = Object.fromEntries(tools.map((t) => [t.name, t.handler]));
export const definitions = tools.map(({ handler, ...rest }) => rest);
export { buildResponse };
