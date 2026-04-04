// apps/api/src/routes/shares.ts
// API routes for task sharing

import { Hono } from 'hono';
import { getDb } from '../db/client';
import { ShareService } from '../services/share-service';
import type { HonoContext } from '../types/context';

const shares = new Hono<HonoContext>();

/**
 * POST /api/shares - Create a new share
 */
shares.post('/', async (c) => {
  try {
    const body = await c.req.json();

    // Validate request
    if (!body.snapshot || !body.snapshot.task || !body.snapshot.messages) {
      return c.json({ error: 'Invalid request: missing snapshot data' }, 400);
    }

    const { db } = getDb(c.env);
    const shareService = new ShareService(db);

    // Get optional user ID from auth (if authenticated)
    const userId = c.get('userId') as string | undefined;

    // Get device ID from header (for anonymous shares)
    const deviceId = c.req.header('X-Device-ID');

    // Verify device ID if no user authentication
    if (!userId && deviceId) {
      const isValidDevice = await shareService.verifyDeviceId(deviceId);
      if (!isValidDevice) {
        return c.json(
          { error: 'Invalid device ID. Please ensure your TalkCody app is up to date.' },
          401
        );
      }
    }

    const result = await shareService.createShare(body, userId, deviceId);

    return c.json(result, 201);
  } catch (error) {
    console.error('Failed to create share:', error);

    // Check for size limit error
    if (error instanceof Error && error.message.includes('exceeds maximum allowed size')) {
      return c.json({ error: error.message }, 413); // 413 Payload Too Large
    }

    return c.json({ error: 'Failed to create share' }, 500);
  }
});

/**
 * GET /api/shares/:shareId - Get share data
 */
shares.get('/:shareId', async (c) => {
  try {
    const shareId = c.req.param('shareId');
    const password = c.req.query('password');
    console.log(
      '[Shares] GET /api/shares/',
      shareId,
      'password:',
      password ? 'provided' : 'not provided'
    );

    const { db } = getDb(c.env);
    const shareService = new ShareService(db);

    // First check if share exists and requires password
    const access = await shareService.checkShareAccess(shareId);
    console.log('[Shares] access:', access);

    if (!access.exists) {
      return c.json({ error: 'Share not found' }, 404);
    }

    if (access.expired) {
      return c.json({ error: 'Share has expired' }, 410);
    }

    if (access.requiresPassword && !password) {
      return c.json({ requiresPassword: true, shareId }, 401);
    }

    // Get the full share data
    const snapshot = await shareService.getShare(shareId, password);

    if (!snapshot) {
      return c.json({ error: 'Share not found' }, 404);
    }

    return c.json(snapshot);
  } catch (error) {
    if (error instanceof Error) {
      if (error.message === 'PASSWORD_REQUIRED') {
        return c.json({ requiresPassword: true }, 401);
      }
      if (error.message === 'INVALID_PASSWORD') {
        return c.json({ error: 'Invalid password' }, 401);
      }
    }
    console.error('Failed to get share:', error);
    return c.json({ error: 'Failed to get share' }, 500);
  }
});

/**
 * POST /api/shares/:shareId/verify - Verify share password
 */
shares.post('/:shareId/verify', async (c) => {
  try {
    const shareId = c.req.param('shareId');
    const body = await c.req.json();
    const password = body.password;

    if (!password) {
      return c.json({ error: 'Password required' }, 400);
    }

    const { db } = getDb(c.env);
    const shareService = new ShareService(db);

    const snapshot = await shareService.getShare(shareId, password);

    if (!snapshot) {
      return c.json({ error: 'Share not found' }, 404);
    }

    return c.json(snapshot);
  } catch (error) {
    if (error instanceof Error && error.message === 'INVALID_PASSWORD') {
      return c.json({ error: 'Invalid password' }, 401);
    }
    console.error('Failed to verify share:', error);
    return c.json({ error: 'Failed to verify share' }, 500);
  }
});

/**
 * GET /api/shares/user/list - Get user's shares (requires auth)
 */
shares.get('/user/list', async (c) => {
  const userId = c.get('userId') as string | undefined;

  if (!userId) {
    return c.json({ error: 'Authentication required' }, 401);
  }

  try {
    const { db } = getDb(c.env);
    const shareService = new ShareService(db);
    const shares = await shareService.getUserShares(userId);

    return c.json({ shares });
  } catch (error) {
    console.error('Failed to get user shares:', error);
    return c.json({ error: 'Failed to get shares' }, 500);
  }
});

/**
 * DELETE /api/shares/:shareId - Delete a share
 */
shares.delete('/:shareId', async (c) => {
  const shareId = c.req.param('shareId');
  const userId = c.get('userId') as string | undefined;
  const deviceId = c.req.header('X-Device-ID');

  if (!userId && !deviceId) {
    return c.json({ error: 'Authentication required' }, 401);
  }

  try {
    const { db } = getDb(c.env);
    const shareService = new ShareService(db);

    // Verify device ID if no user authentication
    if (!userId && deviceId) {
      const isValidDevice = await shareService.verifyDeviceId(deviceId);
      if (!isValidDevice) {
        return c.json(
          { error: 'Invalid device ID. Please ensure your TalkCody app is up to date.' },
          401
        );
      }
    }

    let deleted = false;
    if (userId) {
      deleted = await shareService.deleteShare(shareId, userId);
    } else if (deviceId) {
      deleted = await shareService.deleteShareByDevice(shareId, deviceId);
    }

    if (!deleted) {
      return c.json({ error: 'Share not found or not authorized' }, 404);
    }

    return c.json({ success: true });
  } catch (error) {
    console.error('Failed to delete share:', error);
    return c.json({ error: 'Failed to delete share' }, 500);
  }
});

export default shares;
