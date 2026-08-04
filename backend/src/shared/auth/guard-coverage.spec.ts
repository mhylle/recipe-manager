import 'reflect-metadata';
import { RequestMethod } from '@nestjs/common';
import {
  PATH_METADATA,
  METHOD_METADATA,
  GUARDS_METADATA,
} from '@nestjs/common/constants.js';
import { SsoAuthGuard } from './sso-auth.guard.js';

import { AppController } from '../../app.controller.js';
import { BilkaToGoController } from '../../bilkatogo/bilkatogo.controller.js';
import { MatchingController } from '../../matching/matching.controller.js';
import { MealPlanController } from '../../meal-plan/meal-plan.controller.js';
import { PantryController } from '../../pantry/pantry.controller.js';
import { RecipeController } from '../../recipe/recipe.controller.js';
import { ShoppingListController } from '../../shopping-list/shopping-list.controller.js';
import { StaplesController } from '../../staples/staples.controller.js';

const CONTROLLERS = [
  AppController,
  BilkaToGoController,
  MatchingController,
  MealPlanController,
  PantryController,
  RecipeController,
  ShoppingListController,
  StaplesController,
];

const WRITE_METHODS = new Set([
  RequestMethod.POST,
  RequestMethod.PUT,
  RequestMethod.PATCH,
  RequestMethod.DELETE,
]);

interface Route {
  controller: string;
  handler: string;
  method: RequestMethod;
  path: string;
  guarded: boolean;
}

/**
 * Walk every controller and record what each route handler is, and whether the
 * SSO guard applies to it — either directly on the handler or on the controller.
 */
function collectRoutes(): Route[] {
  const routes: Route[] = [];

  for (const controller of CONTROLLERS) {
    const controllerGuards: unknown[] = Reflect.getMetadata(GUARDS_METADATA, controller) ?? [];
    const controllerGuarded = controllerGuards.includes(SsoAuthGuard);
    const basePath = Reflect.getMetadata(PATH_METADATA, controller) as string;
    const proto = controller.prototype as unknown as Record<string, unknown>;

    for (const name of Object.getOwnPropertyNames(proto)) {
      if (name === 'constructor') continue;
      const handler = proto[name];
      if (typeof handler !== 'function') continue;

      const method = Reflect.getMetadata(METHOD_METADATA, handler) as RequestMethod | undefined;
      if (method === undefined) continue;

      const handlerGuards: unknown[] = Reflect.getMetadata(GUARDS_METADATA, handler) ?? [];
      routes.push({
        controller: controller.name,
        handler: name,
        method,
        path: `${basePath}/${Reflect.getMetadata(PATH_METADATA, handler) as string}`,
        guarded: controllerGuarded || handlerGuards.includes(SsoAuthGuard),
      });
    }
  }

  return routes;
}

describe('guard coverage across the whole API surface', () => {
  const routes = collectRoutes();

  it('discovers every route (guards against the reflection silently finding nothing)', () => {
    // Without this, a broken collector would make every assertion below vacuous:
    // "all zero write routes are guarded" passes trivially.
    expect(routes.length).toBeGreaterThanOrEqual(22);
    expect(routes.filter((r) => WRITE_METHODS.has(r.method)).length).toBeGreaterThanOrEqual(13);
    expect(routes.filter((r) => r.method === RequestMethod.GET).length).toBeGreaterThanOrEqual(9);
  });

  it('guards EVERY write route', () => {
    const unguarded = routes
      .filter((r) => WRITE_METHODS.has(r.method) && !r.guarded)
      .map((r) => `${r.controller}.${r.handler} (${RequestMethod[r.method]} ${r.path})`);
    expect(unguarded).toEqual([]);
  });

  it('guards both BilkaToGo endpoints — they drive a real Salling Group account', () => {
    const bilka = routes.filter((r) => r.controller === 'BilkaToGoController');
    expect(bilka).toHaveLength(2);
    expect(bilka.every((r) => r.guarded)).toBe(true);
  });

  /**
   * The read policy changed when pantries arrived, and this test is where it is
   * stated. Recipes are one shared library, so their reads stay public. Kitchen
   * state belongs to a pantry, and there is no pantry without a user — so those
   * reads are guarded, and the app is read-only-ish rather than fully usable
   * when logged out.
   */
  it('keeps RECIPE reads public — the library is shared', () => {
    const publicReadControllers = ['RecipeController', 'AppController'];
    const wronglyGuarded = routes
      .filter(
        (r) =>
          r.method === RequestMethod.GET &&
          r.guarded &&
          publicReadControllers.includes(r.controller),
      )
      .map((r) => `${r.controller}.${r.handler}`);
    expect(wronglyGuarded).toEqual([]);
  });

  it('guards KITCHEN reads — pantry state cannot be resolved without a user', () => {
    const kitchenControllers = [
      'PantryController',
      'StaplesController',
      'MealPlanController',
      'ShoppingListController',
      'MatchingController',
    ];
    const unguardedKitchenReads = routes
      .filter(
        (r) =>
          r.method === RequestMethod.GET &&
          !r.guarded &&
          kitchenControllers.includes(r.controller),
      )
      .map((r) => `${r.controller}.${r.handler}`);
    expect(unguardedKitchenReads).toEqual([]);
  });

  it('keeps /health reachable without credentials', () => {
    const health = routes.find((r) => r.handler === 'getHealth');
    expect(health).toBeDefined();
    expect(health!.guarded).toBe(false);
  });
});
