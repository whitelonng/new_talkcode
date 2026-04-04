// Hono context type definitions

import type { User } from '@talkcody/shared';
import type { Env } from './env';

export type HonoContext = {
  Bindings: Env;
  Variables: {
    user?: User;
    userId?: string;
    deviceId?: string;
  };
};
