import { api, localeProperty, SUPPORTED_LOCALES } from '../lib/api-client.js';

const UNITS = ['g', 'kg', 'ml', 'l', 'tsp', 'tbsp', 'piece', 'pinch'];
const CATEGORIES = [
  'dairy', 'meat', 'produce', 'grains', 'spices', 'condiments',
  'baking', 'frozen', 'canned', 'beverages', 'snacks', 'other',
];

export const tools = [
  {
    name: 'pantry_list',
    description:
      'List what is in the pantry, optionally filtered by search text or category.',
    inputSchema: {
      type: 'object',
      properties: {
        query: { type: 'string', description: 'Free-text search across item names.' },
        category: { type: 'string', enum: CATEGORIES },
        ...localeProperty,
      },
    },
    handler: ({ query, category, locale }) =>
      api.get('/pantry', { locale, query: { q: query, category } }),
  },

  {
    name: 'pantry_expiring',
    description:
      'Items at or past their expiry date within a window (default 3 days). Use this for "what needs using up?" — it is cheaper and more accurate than listing everything and comparing dates.',
    inputSchema: {
      type: 'object',
      properties: {
        days: { type: 'number', description: 'Look-ahead window in days. Defaults to 3.' },
        ...localeProperty,
      },
    },
    handler: ({ days, locale }) => api.get('/pantry/expiring', { locale, query: { days } }),
  },

  {
    name: 'pantry_get',
    description:
      'Fetch a single pantry item by id, including its quantity, unit, category and expiry date. Use `pantry_list` when you only have a name to go on.',
    inputSchema: {
      type: 'object',
      properties: { id: { type: 'string' }, ...localeProperty },
      required: ['id'],
    },
    handler: ({ id, locale }) => api.get(`/pantry/${id}`, { locale }),
  },

  {
    name: 'pantry_add',
    description:
      'Add an item to the pantry. The name is stored in the AUTHORING language (`locale`); pass `translations` to give it a name in other languages too.',
    inputSchema: {
      type: 'object',
      properties: {
        name: { type: 'string' },
        quantity: { type: 'number' },
        unit: { type: 'string', enum: UNITS },
        category: { type: 'string', enum: CATEGORIES },
        barcode: { type: 'string' },
        expiryDate: { type: 'string', description: 'ISO date, e.g. 2026-08-14.' },
        translations: {
          type: 'array',
          items: {
            type: 'object',
            properties: {
              locale: { type: 'string', enum: SUPPORTED_LOCALES },
              name: { type: 'string' },
            },
            required: ['locale', 'name'],
          },
        },
        ...localeProperty,
      },
      required: ['name', 'quantity', 'unit', 'category'],
    },
    handler: ({ locale, ...body }) => api.post('/pantry', body, { locale }),
  },

  {
    name: 'pantry_update',
    description:
      'Update a pantry item — typically the quantity after cooking, or an expiry date. Only the fields you send change.\n\nAs with recipes, a `name` you send edits the language given by `locale`, so sending an English name with locale "da" overwrites the Danish one.',
    inputSchema: {
      type: 'object',
      properties: {
        id: { type: 'string' },
        name: { type: 'string' },
        quantity: { type: 'number' },
        unit: { type: 'string', enum: UNITS },
        category: { type: 'string', enum: CATEGORIES },
        barcode: { type: 'string' },
        expiryDate: { type: 'string' },
        translations: {
          type: 'array',
          items: {
            type: 'object',
            properties: {
              locale: { type: 'string', enum: SUPPORTED_LOCALES },
              name: { type: 'string' },
            },
            required: ['locale', 'name'],
          },
        },
        ...localeProperty,
      },
      required: ['id'],
    },
    handler: ({ id, locale, ...body }) => api.patch(`/pantry/${id}`, body, { locale }),
  },

  {
    name: 'pantry_delete',
    description: 'Remove an item from the pantry. Permanent — confirm with the user first.',
    inputSchema: {
      type: 'object',
      properties: { id: { type: 'string' } },
      required: ['id'],
    },
    handler: async ({ id }) => {
      await api.del(`/pantry/${id}`);
      return { deleted: id };
    },
  },

  {
    name: 'staples_get',
    description:
      'The staples list — items always assumed to be in the kitchen (salt, oil and so on), which shopping-list generation leaves out.',
    inputSchema: { type: 'object', properties: {} },
    handler: () => api.get('/staples'),
  },

  {
    name: 'staples_set',
    description:
      'Replace the staples list wholesale. This is a REPLACE, not an append — send the full list, including the existing entries you want to keep. Call `staples_get` first.',
    inputSchema: {
      type: 'object',
      properties: { items: { type: 'array', items: { type: 'string' } } },
      required: ['items'],
    },
    handler: ({ items }) => api.put('/staples', { items }),
  },
];

export const handlers = Object.fromEntries(tools.map((t) => [t.name, t.handler]));
export const definitions = tools.map(({ handler, ...rest }) => rest);
