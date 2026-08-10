import { api, buildResponse, localeProperty, SUPPORTED_LOCALES } from '../lib/api-client.js';

const INGREDIENT_SCHEMA = {
  type: 'object',
  properties: {
    id: {
      type: 'string',
      description:
        'Which existing ingredient this row IS, from `recipes_get`. Omit to add a new one. Needed whenever an update changes the NUMBER of ingredients on a recipe that has variations: they point at ingredient ids, so without them the server refuses rather than silently dropping "this version uses 10 g of yeast".',
    },
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
      'List recipes, optionally filtered. Returns every recipe when called with no arguments, so prefer narrowing with `query` or `tags` when the user is looking for something specific. Text comes back in the requested language.\n\nEach recipe carries `reactions`: `ratingAverage` (null when nobody has rated it — that is NOT a zero) and `ratingCount`, plus `likeCount`, and `likedByMe`/`myStars` for this user. Answer "what are our favourites?" or "what is highly rated?" from these rather than guessing, and say how many ratings an average rests on — one 5-star vote is not a verdict.',
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
      'Fetch one recipe in full — ingredients with quantities, and the numbered method. Use this before answering questions about how to cook something; `recipes_list` returns the same shape but is wasteful for a single dish. A recipe may carry `variations`: other ways to cook it, each with a name and the reason it exists. Pass `variationId` to get the recipe AS that variation — ingredients, method and times all resolved to it, so nothing has to apply the differences itself.\n\nAlso carries `reactions`: what everyone thought (`ratingAverage`, `ratingCount`, `likeCount`) and what this user thought (`likedByMe`, `myStars`). A null `ratingAverage` means unrated, not zero.',
    inputSchema: {
      type: 'object',
      properties: {
        id: { type: 'string', description: 'Recipe id.' },
        variationId: {
          type: 'string',
          description:
            "Which way to cook it, from this recipe's `variations`. Omit for the recipe as written.",
        },
        ...localeProperty,
      },
      required: ['id'],
    },
    handler: ({ id, variationId, locale }) =>
      api.get(
        variationId
          ? `/recipes/${id}?variation=${encodeURIComponent(variationId)}`
          : `/recipes/${id}`,
        { locale },
      ),
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
        // A recipe may come back with `variations` — other ways to cook it,
        // each with a name and the reason it exists. Ask for one with
        // `variationId` and the whole recipe resolves to it: ingredients,
        // steps and times all reflect that choice, so nothing here has to
        // apply differences itself.
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
    name: 'recipes_like',
    description:
      "Like a recipe on the user's behalf, or take an existing like back. A like is a bookmark — \"cook this again\" — and is SEPARATE from the star rating: liking something does not score it, and un-liking does not clear a score. Ask before recording an opinion the user has not actually expressed.",
    inputSchema: {
      type: 'object',
      properties: {
        id: { type: 'string', description: 'Recipe id.' },
        liked: {
          type: 'boolean',
          description:
            'True to like it, false to take the like back. Sent as the target state rather than a toggle, so calling twice with the same value is harmless.',
        },
      },
      required: ['id', 'liked'],
    },
    handler: ({ id, liked }) => api.put(`/recipes/${id}/like`, { liked }),
  },

  {
    name: 'recipes_rate',
    description:
      "Score a recipe out of five on the user's behalf. SEPARATE from a like: rating does not like it. Pass 0 to clear a rating the user wants to withdraw — that leaves any like on the recipe untouched. The reply carries the recipe's new average and how many people it is drawn from. Ask before recording an opinion the user has not actually expressed.",
    inputSchema: {
      type: 'object',
      properties: {
        id: { type: 'string', description: 'Recipe id.' },
        stars: {
          type: 'number',
          description:
            'A whole number from 1 to 5, or 0 to clear the rating. Half stars are refused.',
        },
      },
      required: ['id', 'stars'],
    },
    handler: ({ id, stars }) => api.put(`/recipes/${id}/rating`, { stars }),
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
