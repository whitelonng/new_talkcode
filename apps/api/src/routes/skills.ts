// Skill management routes (CRUD operations)

import type { CreateSkillRequest, UpdateSkillRequest } from '@talkcody/shared';
import { Hono } from 'hono';
import { authMiddleware, getAuth } from '../middlewares/auth';
import { skillService } from '../services/skill-service';
import type { HonoContext } from '../types/context';

const skills = new Hono<HonoContext>();

/**
 * Create new skill (requires authentication)
 * POST /api/skills
 * Body: CreateSkillRequest
 */
skills.post('/', authMiddleware, async (c) => {
  try {
    const { userId } = getAuth(c);
    const data = await c.req.json<CreateSkillRequest>();

    // Validate required fields
    if (!data.name || !data.description || !data.documentation) {
      return c.json({ error: 'Missing required fields: name, description, documentation' }, 400);
    }

    const skill = await skillService.createSkill(userId, data);

    return c.json({ skill }, 201);
  } catch (error) {
    console.error('Create skill error:', error);
    const message = error instanceof Error ? error.message : 'Failed to create skill';
    return c.json({ error: message }, 500);
  }
});

/**
 * Update skill (requires authentication and ownership)
 * PATCH /api/skills/:skillId
 * Body: UpdateSkillRequest
 */
skills.patch('/:skillId', authMiddleware, async (c) => {
  try {
    const { userId } = getAuth(c);
    const skillId = c.req.param('skillId');
    const data = await c.req.json<UpdateSkillRequest>();

    const skill = await skillService.updateSkill(userId, skillId, data);

    return c.json({ skill });
  } catch (error) {
    console.error('Update skill error:', error);
    const message = error instanceof Error ? error.message : 'Failed to update skill';

    if (message.includes('not found') || message.includes('unauthorized')) {
      return c.json({ error: message }, 404);
    }

    return c.json({ error: message }, 500);
  }
});

/**
 * Publish skill (make it public)
 * POST /api/skills/:skillId/publish
 */
skills.post('/:skillId/publish', authMiddleware, async (c) => {
  try {
    const { userId } = getAuth(c);
    const skillId = c.req.param('skillId');

    const skill = await skillService.publishSkill(userId, skillId);

    return c.json({ skill });
  } catch (error) {
    console.error('Publish skill error:', error);
    const message = error instanceof Error ? error.message : 'Failed to publish skill';

    if (message.includes('not found') || message.includes('unauthorized')) {
      return c.json({ error: message }, 404);
    }

    return c.json({ error: message }, 500);
  }
});

/**
 * Unpublish skill
 * POST /api/skills/:skillId/unpublish
 */
skills.post('/:skillId/unpublish', authMiddleware, async (c) => {
  try {
    const { userId } = getAuth(c);
    const skillId = c.req.param('skillId');

    const skill = await skillService.unpublishSkill(userId, skillId);

    return c.json({ skill });
  } catch (error) {
    console.error('Unpublish skill error:', error);
    const message = error instanceof Error ? error.message : 'Failed to unpublish skill';

    if (message.includes('not found') || message.includes('unauthorized')) {
      return c.json({ error: message }, 404);
    }

    return c.json({ error: message }, 500);
  }
});

/**
 * Delete skill (requires authentication and ownership)
 * DELETE /api/skills/:skillId
 */
skills.delete('/:skillId', authMiddleware, async (c) => {
  try {
    const { userId } = getAuth(c);
    const skillId = c.req.param('skillId');

    await skillService.deleteSkill(userId, skillId);

    return c.json({ message: 'Skill deleted successfully' });
  } catch (error) {
    console.error('Delete skill error:', error);
    const message = error instanceof Error ? error.message : 'Failed to delete skill';

    if (message.includes('not found') || message.includes('unauthorized')) {
      return c.json({ error: message }, 404);
    }

    return c.json({ error: message }, 500);
  }
});

/**
 * Create new version for skill
 * POST /api/skills/:skillId/versions
 * Body: { version, systemPromptFragment?, workflowRules?, documentation?, changeLog }
 */
skills.post('/:skillId/versions', authMiddleware, async (c) => {
  try {
    const { userId } = getAuth(c);
    const skillId = c.req.param('skillId');
    const data = await c.req.json();

    // Validate required fields
    if (!data.version || !data.changeLog) {
      return c.json({ error: 'Missing required fields: version, changeLog' }, 400);
    }

    const version = await skillService.createVersion(userId, skillId, data);

    return c.json({ version }, 201);
  } catch (error) {
    console.error('Create version error:', error);
    const message = error instanceof Error ? error.message : 'Failed to create version';

    if (message.includes('not found') || message.includes('unauthorized')) {
      return c.json({ error: message }, 404);
    }

    if (message.includes('already exists')) {
      return c.json({ error: message }, 409);
    }

    return c.json({ error: message }, 500);
  }
});

export default skills;
