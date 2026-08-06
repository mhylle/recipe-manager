/**
 * This app's identifier in the estate's shared `apps` claim.
 *
 * The auth-service already issues an app grant list on every token and already
 * assigns a default at registration — a brand-new account comes back with
 * `apps: ["games"]`. That list is the estate's existing answer to "who may use
 * what", so contribution rights are read from it rather than from a second
 * notion of membership kept in this database.
 */
export const APP_NAME = 'recipe-manager';

/**
 * Whether a token's claims carry a grant for this app.
 *
 * This gates writes to the SHARED recipe library only. Signing in, browsing
 * recipes and running your own kitchen — pantry, meal plans, shopping lists,
 * all already isolated per pantry — need no grant, which is what lets someone
 * register themselves and be useful immediately without an administrator.
 *
 * Absent or malformed claims deny. A token with no `apps` array is either from
 * an account that was granted nothing or from something not worth trusting, and
 * both should be read the same way.
 */
export function grantsAppAccess(apps: unknown): boolean {
  return Array.isArray(apps) && apps.includes(APP_NAME);
}
