import 'reflect-metadata';
import { RequestMethod } from '@nestjs/common';
import {
  PATH_METADATA,
  METHOD_METADATA,
  GUARDS_METADATA,
} from '@nestjs/common/constants.js';
import { SsoAuthGuard } from './sso-auth.guard.js';
import { ContributorGuard } from './contributor.guard.js';

import { AppController } from '../../app.controller.js';
import { BilkaToGoController } from '../../bilkatogo/bilkatogo.controller.js';
import { MatchingController } from '../../matching/matching.controller.js';
import { MealPlanController } from '../../meal-plan/meal-plan.controller.js';
import { PantryController } from '../../pantry/pantry.controller.js';
import { RecipeController } from '../../recipe/recipe.controller.js';
import { ShoppingListController } from '../../shopping-list/shopping-list.controller.js';
import { StaplesController } from '../../staples/staples.controller.js';
import { MeController } from './me.controller.js';
import { PushController } from '../../push/push.controller.js';
import { TimerController } from '../../push/timer.controller.js';
import { ProfileController } from '../../profile/profile.controller.js';
import { AdminController } from '../../admin/admin.controller.js';
import { ReportsController } from '../../reports/reports.controller.js';

const CONTROLLERS = [
  AppController,
  BilkaToGoController,
  MatchingController,
  MealPlanController,
  PantryController,
  RecipeController,
  ShoppingListController,
  StaplesController,
  MeController,
  PushController,
  TimerController,
  ProfileController,
  AdminController,
  ReportsController,
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
  /** Whether the route also demands an `apps` grant for this app. */
  contributorGated: boolean;
}

/**
 * Walk every controller and record what each route handler is, and whether the
 * SSO guard applies to it — either directly on the handler or on the controller.
 */
function collectRoutes(): Route[] {
  const routes: Route[] = [];

  for (const controller of CONTROLLERS) {
    const controllerGuards =
      (Reflect.getMetadata(GUARDS_METADATA, controller) as
        | unknown[]
        | undefined) ?? [];
    const controllerGuarded = controllerGuards.includes(SsoAuthGuard);
    const basePath = Reflect.getMetadata(PATH_METADATA, controller) as string;
    const proto = controller.prototype as unknown as Record<string, unknown>;

    for (const name of Object.getOwnPropertyNames(proto)) {
      if (name === 'constructor') continue;
      const handler = proto[name];
      if (typeof handler !== 'function') continue;

      const method = Reflect.getMetadata(METHOD_METADATA, handler) as
        | RequestMethod
        | undefined;
      if (method === undefined) continue;

      const handlerGuards =
        (Reflect.getMetadata(GUARDS_METADATA, handler) as
          | unknown[]
          | undefined) ?? [];
      routes.push({
        controller: controller.name,
        handler: name,
        method,
        path: `${basePath}/${Reflect.getMetadata(PATH_METADATA, handler) as string}`,
        guarded: controllerGuarded || handlerGuards.includes(SsoAuthGuard),
        contributorGated:
          controllerGuards.includes(ContributorGuard) ||
          handlerGuards.includes(ContributorGuard),
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
    expect(
      routes.filter((r) => WRITE_METHODS.has(r.method)).length,
    ).toBeGreaterThanOrEqual(13);
    expect(
      routes.filter((r) => r.method === RequestMethod.GET).length,
    ).toBeGreaterThanOrEqual(9);
  });

  it('guards EVERY write route', () => {
    const unguarded = routes
      .filter((r) => WRITE_METHODS.has(r.method) && !r.guarded)
      .map(
        (r) =>
          `${r.controller}.${r.handler} (${RequestMethod[r.method]} ${r.path})`,
      );
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

  it('keeps the VAPID public key reachable without credentials', () => {
    // It is a public key, the client needs it before it can subscribe, and its
    // absence is how the UI knows to hide the notification offer entirely.
    const key = routes.find(
      (r) => r.controller === 'PushController' && r.handler === 'key',
    );
    expect(key).toBeDefined();
    expect(key!.guarded).toBe(false);
  });

  /**
   * The access model that makes open self-registration safe, stated as a test.
   *
   * Anyone with a valid mhylle.com account may sign in, read every recipe and
   * run their own kitchen. Writing to the SHARED recipe library additionally
   * needs an `apps` grant for this app. If either half of that drifts, the
   * failure is silent — a stranger quietly gaining write access to the family
   * cookbook, or every family member losing it — so both halves are asserted.
   */
  describe('shared-library contribution gate', () => {
    it('gates the image UPLOAD too, not just generation', () => {
      // Uploading replaces a picture in the shared library, so it is the same
      // class of write as creating or regenerating.
      const upload = routes.find(
        (r) =>
          r.controller === 'RecipeController' && r.handler === 'uploadImage',
      );
      expect(upload).toBeDefined();
      expect(upload!.guarded).toBe(true);
      expect(upload!.contributorGated).toBe(true);
    });

    it('gates EVERY recipe mutation on the app grant', () => {
      const ungated = routes
        .filter(
          (r) =>
            r.controller === 'RecipeController' &&
            WRITE_METHODS.has(r.method) &&
            !r.contributorGated,
        )
        .map((r) => `${r.handler} (${RequestMethod[r.method]} ${r.path})`);
      expect(ungated).toEqual([]);
    });

    it('lets anyone report a fault without a contribution grant', () => {
      // Gating this would mean the people most likely to hit a wall — the ones
      // who cannot contribute yet — are the ones who cannot report it.
      const reports = routes.filter(
        (r) => r.controller === 'ReportsController',
      );
      expect(reports.length).toBeGreaterThanOrEqual(4);
      expect(reports.every((r) => r.guarded)).toBe(true);
      expect(reports.some((r) => r.contributorGated)).toBe(false);
    });

    it('leaves the admin routes to OwnerGuard, not the contribution gate', () => {
      // Administering access is not contributing to the library; it is a
      // different question with a different guard.
      const admin = routes.filter((r) => r.controller === 'AdminController');
      expect(admin.length).toBeGreaterThanOrEqual(2);
      expect(admin.every((r) => r.guarded)).toBe(true);
      expect(admin.some((r) => r.contributorGated)).toBe(false);
    });

    it('gates nothing else — a self-registered cook keeps their own kitchen', () => {
      // Pantries, meal plans, shopping lists and staples are already isolated
      // per kitchen, so they need authentication but not a grant. Gating them
      // would make a newly registered account useless rather than merely
      // read-only on the shared library.
      const overGated = routes
        .filter(
          (r) => r.contributorGated && r.controller !== 'RecipeController',
        )
        .map((r) => `${r.controller}.${r.handler}`);
      expect(overGated).toEqual([]);
    });

    it('leaves recipe READS open to everyone, grant or not', () => {
      const gatedReads = routes
        .filter(
          (r) =>
            r.controller === 'RecipeController' &&
            r.method === RequestMethod.GET &&
            (r.guarded || r.contributorGated),
        )
        .map((r) => r.handler);
      expect(gatedReads).toEqual([]);
    });

    it('lets a signed-in cook manage their own API key without a grant', () => {
      // Storing your own Gemini key is not writing to the shared library, and
      // someone who cannot yet contribute may well want it ready for when
      // they can.
      const profile = routes.filter(
        (r) => r.controller === 'ProfileController',
      );
      expect(profile.length).toBeGreaterThanOrEqual(3);
      expect(profile.every((r) => r.guarded)).toBe(true);
      expect(profile.some((r) => r.contributorGated)).toBe(false);
    });

    it('lets a signed-in cook set their own timers without a grant', () => {
      const gatedTimers = routes
        .filter((r) => r.controller === 'TimerController' && r.contributorGated)
        .map((r) => r.handler);
      expect(gatedTimers).toEqual([]);
      // Still authenticated, though — a timer is addressed to a person's devices.
      const timerWrites = routes.filter(
        (r) =>
          r.controller === 'TimerController' && WRITE_METHODS.has(r.method),
      );
      expect(timerWrites.length).toBeGreaterThanOrEqual(2);
      expect(timerWrites.every((r) => r.guarded)).toBe(true);
    });
  });
});
