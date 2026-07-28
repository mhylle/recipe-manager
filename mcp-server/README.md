# Recipe Manager MCP Server

Exposes **The Atelier Kitchen** to Claude Desktop — recipes, pantry, meal plans and
shopping lists — over the Model Context Protocol.

Talks to the deployed API at `https://mhylle.com/api/recipe-manager/api` by default.

## Install

```bash
cd mcp-server
npm install
```

Node 20+ is required. The only dependency is the MCP SDK; HTTP goes through the
built-in `fetch`.

## Connect it to Claude Desktop

Add this to your Claude Desktop config:

- **macOS** — `~/Library/Application Support/Claude/claude_desktop_config.json`
- **Windows** — `%APPDATA%\Claude\claude_desktop_config.json`
- **Linux** — `~/.config/Claude/claude_desktop_config.json`

```json
{
  "mcpServers": {
    "recipe-manager": {
      "command": "node",
      "args": ["/absolute/path/to/recipe-manager/mcp-server/index.js"],
      "env": {
        "RECIPE_MANAGER_LOCALE": "da"
      }
    }
  }
}
```

Use an **absolute** path — Claude Desktop does not resolve relative ones. Restart
Claude Desktop afterwards; the tools appear under the connector menu.

### Configuration

| Variable | Default | Purpose |
|---|---|---|
| `RECIPE_MANAGER_API_URL` | `https://mhylle.com/api/recipe-manager/api` | Point at a local backend, e.g. `http://localhost:3000/api` |
| `RECIPE_MANAGER_LOCALE` | `en` | Default content language, `en` or `da`. Any tool can override it per call. |

## What it can do

**Recipes** — `recipes_list`, `recipes_get`, `recipes_get_translations`,
`recipes_create`, `recipes_update`, `recipes_delete`, `recipes_what_can_i_cook`

**Pantry** — `pantry_list`, `pantry_expiring`, `pantry_get`, `pantry_add`,
`pantry_update`, `pantry_delete`, `staples_get`, `staples_set`

**Planning** — `mealplan_get_week`, `mealplan_add_entry`, `mealplan_remove_entry`,
`mealplan_mark_cooked`

**Shopping** — `shoppinglist_generate_from_mealplan`, `shoppinglist_from_recipe`,
`shoppinglist_get`, `shoppinglist_toggle_item`

Things to try once connected:

> What can I cook tonight with what's in the pantry?
>
> What's about to expire?
>
> Plan dinners for this week from my Danish recipes, then build me a shopping list.

## What it deliberately cannot do

**BilkaToGo is not exposed.** Those endpoints log into a real Salling Group account
and add groceries to a real basket. That is not something to hand a language model
without a human in the loop, so `bilkatogo_login` and `bilkatogo_send` have no tools
— and a test asserts they never gain any.

## Notes

- **Content is bilingual.** Every read tool takes a `locale`. A missing translation
  falls back to the recipe's source language rather than coming back blank.
- **Tags are not translated.** They are canonical English facets used for filtering
  (`Mexican`, `Chicken`, `Baking`), and stay English whatever the display language.
- **Writes edit the language you name.** Sending English text with `locale: "da"`
  overwrites the *Danish* copy. To add a language to an existing recipe, use the
  `translations` argument and leave the flat text fields alone.
- **`mealplan_mark_cooked` deducts from the pantry.** Only call it once a meal has
  actually been cooked, not while planning.

## Tests

```bash
npm test
```

Covers the tool catalogue (unique names, declared required properties, warnings on
destructive tools, BilkaToGo absence), API base resolution, response envelopes, and
week-start calculation. The week-start tests are timezone-sensitive by design —
run them under a few zones:

```bash
TZ=Europe/Copenhagen npm test && TZ=Pacific/Auckland npm test
```
