// Global error handler middleware

import type { Context } from 'hono';
import { HTTPException } from 'hono/http-exception';
import type { HonoContext } from '../types/context';

export function errorHandler(err: Error, c: Context<HonoContext>) {
  console.error('Unhandled error:', err);

  if (err instanceof HTTPException) {
    return c.json(
      {
        error: err.message || 'Request failed',
      },
      err.status
    );
  }

  // Check if it's a known error type
  if (err.name === 'ZodError') {
    return c.json(
      {
        error: 'Validation error',
        details: err.message,
      },
      400
    );
  }

  // Default error response
  return c.json(
    {
      error: 'Internal server error',
      message: process.env.NODE_ENV === 'development' ? err.message : undefined,
    },
    500
  );
}
