import type { Request } from 'express';
import type { LocalUser } from './user.service.js';

/**
 * The authenticated caller, as a LOCAL row rather than raw token claims.
 *
 * The guard resolves claims to a persisted user so that anything downstream can
 * hold a foreign key to a person. A service-token caller resolves to the user
 * named by RECIPE_MANAGER_SERVICE_USER, so machine writes are attributed to a
 * real person rather than to nobody.
 */
export interface RequestWithUser extends Request {
  user?: LocalUser;
  /** True when authenticated by the machine-to-machine service token. */
  isServiceCaller?: boolean;
}
