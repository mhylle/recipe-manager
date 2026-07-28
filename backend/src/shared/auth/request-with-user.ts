import type { Request } from 'express';

/** Who the guard decided is making the request. */
export interface AuthUser {
  /** `sub` from the SSO token. Absent for service callers. */
  id?: string;
  email?: string;
  name?: string;
  apps?: string[];
  /** True when authenticated by the machine-to-machine service token. */
  isService?: boolean;
}

export interface RequestWithUser extends Request {
  user?: AuthUser;
}
