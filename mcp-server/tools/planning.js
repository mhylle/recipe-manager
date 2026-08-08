import { api, localeProperty } from '../lib/api-client.js';

const DAYS = ['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday'];
const MEALS = ['breakfast', 'lunch', 'dinner', 'snack'];

export const tools = [
  {
    name: 'mealplan_get_week',
    description:
      "The meal plan for a given week, including its id and every scheduled entry. Weeks start on MONDAY and are identified by that Monday's date. Call this before adding or removing entries — the other tools need the plan id it returns.",
    inputSchema: {
      type: 'object',
      properties: {
        weekStartDate: {
          type: 'string',
          description:
            "The Monday of the week, as YYYY-MM-DD. Must actually be a Monday. Omit for the current week.",
        },
        ...localeProperty,
      },
    },
    handler: ({ weekStartDate, locale }) =>
      api.get('/meal-plans/week', {
        locale,
        query: { date: weekStartDate || mondayOf(new Date()) },
      }),
  },

  {
    name: 'mealplan_add_entry',
    description:
      'Schedule a recipe for a particular day and meal. Get the `mealPlanId` from `mealplan_get_week` first.',
    inputSchema: {
      type: 'object',
      properties: {
        mealPlanId: { type: 'string' },
        recipeId: { type: 'string' },
        day: { type: 'string', enum: DAYS },
        meal: { type: 'string', enum: MEALS },
        servings: { type: 'number', description: 'How many people this sitting is for.' },
        variationId: {
          type: 'string',
          description:
            'Which way to cook it, from the recipe\'s `variations`. Omit for the recipe as written. Recorded now, because the shopping list is generated days later and cannot ask — plan the ciabatta\'s 10 g option and the list must contain 10 g of yeast and its sugar.',
        },
        ...localeProperty,
      },
      required: ['mealPlanId', 'recipeId', 'day', 'meal', 'servings'],
    },
    handler: ({ mealPlanId, locale, ...body }) =>
      api.post(`/meal-plans/${mealPlanId}/entries`, body, { locale }),
  },

  {
    name: 'mealplan_remove_entry',
    description:
      'Remove a scheduled meal by its position in the plan\'s `entries` array. Re-read the week with `mealplan_get_week` before removing again — indices shift after every removal.',
    inputSchema: {
      type: 'object',
      properties: {
        mealPlanId: { type: 'string' },
        entryIndex: { type: 'number', description: 'Zero-based index into `entries`.' },
        ...localeProperty,
      },
      required: ['mealPlanId', 'entryIndex'],
    },
    handler: ({ mealPlanId, entryIndex, locale }) =>
      api.del(`/meal-plans/${mealPlanId}/entries/${entryIndex}`, { locale }),
  },

  {
    name: 'mealplan_mark_cooked',
    description:
      "Confirm a planned meal was actually cooked. This DEDUCTS its ingredients from the pantry, so only call it once the user says they have cooked it — not when planning.",
    inputSchema: {
      type: 'object',
      properties: {
        mealPlanId: { type: 'string' },
        entryIndex: { type: 'number', description: 'Zero-based index into `entries`.' },
      },
      required: ['mealPlanId', 'entryIndex'],
    },
    handler: async ({ mealPlanId, entryIndex }) => {
      await api.post(`/meal-plans/${mealPlanId}/entries/${entryIndex}/confirm`, {});
      return { confirmed: { mealPlanId, entryIndex }, note: 'Pantry quantities updated.' };
    },
  },

  {
    name: 'shoppinglist_generate_from_mealplan',
    description:
      'Build a shopping list for a whole week: everything the planned meals need, minus what is already in the pantry and minus the staples. Get the plan id from `mealplan_get_week`.',
    inputSchema: {
      type: 'object',
      properties: { mealPlanId: { type: 'string' }, ...localeProperty },
      required: ['mealPlanId'],
    },
    handler: ({ mealPlanId, locale }) =>
      api.post(`/shopping-lists/generate/${mealPlanId}`, {}, { locale }),
  },

  {
    name: 'shoppinglist_from_recipe',
    description: 'Build a shopping list for one recipe, again minus pantry stock and staples.',
    inputSchema: {
      type: 'object',
      properties: { recipeId: { type: 'string' }, ...localeProperty },
      required: ['recipeId'],
    },
    handler: ({ recipeId, locale }) =>
      api.post(`/shopping-lists/from-recipe/${recipeId}`, {}, { locale }),
  },

  {
    name: 'shoppinglist_get',
    description: 'Fetch a shopping list and its items, including which are already ticked off.',
    inputSchema: {
      type: 'object',
      properties: { id: { type: 'string' }, ...localeProperty },
      required: ['id'],
    },
    handler: ({ id, locale }) => api.get(`/shopping-lists/${id}`, { locale }),
  },

  {
    name: 'shoppinglist_toggle_item',
    description:
      'Tick an item off a shopping list, or un-tick it. Identified by its position in the list\'s `items` array.',
    inputSchema: {
      type: 'object',
      properties: {
        id: { type: 'string' },
        itemIndex: { type: 'number', description: 'Zero-based index into `items`.' },
        ...localeProperty,
      },
      required: ['id', 'itemIndex'],
    },
    handler: ({ id, itemIndex, locale }) =>
      api.patch(`/shopping-lists/${id}/items/${itemIndex}`, {}, { locale }),
  },
];

/**
 * The Monday on or before `date`, as YYYY-MM-DD.
 *
 * Formatted from LOCAL date parts, not `toISOString()`. Denmark runs at UTC+2 in
 * summer, so a local-midnight date converted to an ISO string lands on the
 * previous day — which would silently plan meals into the wrong week.
 */
export function mondayOf(date) {
  const d = new Date(date);
  const dayOfWeek = d.getDay(); // 0 = Sunday
  const back = dayOfWeek === 0 ? 6 : dayOfWeek - 1;
  d.setDate(d.getDate() - back);
  const pad = (n) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

export const handlers = Object.fromEntries(tools.map((t) => [t.name, t.handler]));
export const definitions = tools.map(({ handler, ...rest }) => rest);
