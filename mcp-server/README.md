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

There are two ways to run it: **hosted** (recommended — always available, nothing
running locally) and **local stdio** (for development against a local backend).

## Hosted: connect to the deployed server

The server runs on mhylle.com at `https://mhylle.com/mcp/recipe-manager`, so it is
reachable whether or not this machine is on. It is protected by a bearer token —
the tools can delete recipes, and the endpoint is public.

Claude Desktop speaks stdio, so bridge to it with `mcp-remote`:

```json
{
  "mcpServers": {
    "recipe-manager": {
      "command": "npx",
      "args": [
        "-y", "mcp-remote",
        "https://mhylle.com/mcp/recipe-manager",
        "--header", "X-MCP-Token:YOUR_TOKEN_HERE"
      ]
    }
  }
}
```

**Why `X-MCP-Token` rather than `Authorization: Bearer`.** The server accepts both,
and a spec-compliant client should send the bearer header. But the bearer scheme
requires a space, and on Windows this bridge launches through `npx.cmd`, which
cmd.exe re-parses — an argument containing a space can arrive split in two, and the
header is then dropped with no error, leaving a confusing OAuth-discovery failure
in its place. `X-MCP-Token:<token>` has no space anywhere, so nothing can split it.
On macOS and Linux either form works.

The token lives in the `RECIPE_MANAGER_MCP_TOKEN` GitHub Secret on the
`mhylle/recipe-manager` repo. It is never committed. To rotate it:

```bash
gh secret set RECIPE_MANAGER_MCP_TOKEN --repo mhylle/recipe-manager
gh workflow run deploy.yml --repo mhylle/recipe-manager
```

Then update the header value in the Desktop config. Old tokens stop working the
moment the new container starts.

## Local: run over stdio

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

### Running Claude Desktop on Windows against WSL

If Claude Desktop is on Windows and the repo lives in WSL, it cannot execute a
Linux path directly — it has to go through `wsl.exe`:

```json
{
  "mcpServers": {
    "recipe-manager": {
      "command": "wsl.exe",
      "args": [
        "-d", "Ubuntu",
        "-e",
        "/usr/bin/env",
        "RECIPE_MANAGER_LOCALE=da",
        "/home/you/.local/bin/node",
        "/home/you/path/to/recipe-manager/mcp-server/index.js"
      ]
    }
  }
}
```

Two things that will otherwise waste an afternoon:

- **Use the absolute path to `node`.** `wsl.exe -e` execs directly without a login
  shell, so anything installed via nvm or into `~/.local/bin` is *not* on `PATH`.
  Plain `node` fails with "command not found". Find yours with `which node`.
- **Set env vars with `/usr/bin/env`, not a shell.** A wrapper like `bash -lc`
  loads your profile, and anything it prints to stdout corrupts the MCP protocol
  stream. `env` sets the variable without starting a shell.

Verify the whole chain from a Windows terminal before restarting Claude Desktop:

```
wsl.exe -d Ubuntu -e /usr/bin/env RECIPE_MANAGER_LOCALE=da /home/you/.local/bin/node --version
```

### Configuration

| Variable | Default | Purpose |
|---|---|---|
| `RECIPE_MANAGER_API_URL` | `https://mhylle.com/api/recipe-manager/api` | Point at a local backend, e.g. `http://localhost:3000/api` |
| `RECIPE_MANAGER_LOCALE` | `en` | Default content language, `en` or `da`. Any tool can override it per call. |
| `RECIPE_MANAGER_MCP_TOKEN` | — | HTTP transport only. Required, minimum 32 chars; the process exits rather than serving unauthenticated. Accepted as `Authorization: Bearer <token>` or `X-MCP-Token: <token>`. |
| `PORT` | `3100` | HTTP transport only. |
| `RECIPE_MANAGER_MCP_PATH` | `/mcp` | HTTP transport only. Path the MCP endpoint is served on. |

## Hosting it yourself

`http-server.js` is the HTTP entry point; `index.js` is the stdio one. Both build
their tool surface from `lib/server-factory.js`, so the remote server cannot drift
from the one you tested locally.

```bash
RECIPE_MANAGER_MCP_TOKEN=$(python3 -c 'import secrets;print(secrets.token_urlsafe(48))') \
  node http-server.js
```

`/health` is unauthenticated and reports nothing but liveness. Everything on `/mcp`
requires the bearer token, compared in constant time.

Behind a reverse proxy, two settings matter: `proxy_buffering off` (the session
holds an SSE stream open, and buffering would withhold every notification) and a
long `proxy_read_timeout` (the default 60s kills idle sessions mid-conversation).

## What it can do

**Recipes** — `recipes_list`, `recipes_get`, `recipes_get_translations`,
`recipes_create`, `recipes_update`, `recipes_delete`, `recipes_like`,
`recipes_rate`, `recipes_what_can_i_cook`

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
