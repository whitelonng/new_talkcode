import { Hono } from 'hono';
import { remoteSkillsService } from '../services/remote-skills-service';
import type { HonoContext } from '../types/context';

const remoteSkills = new Hono<HonoContext>();

/**
 * GET /api/remote-skills/version
 * Returns the current remote skills configuration version
 */
remoteSkills.get('/version', (c) => {
  const version = remoteSkillsService.getVersion();
  return c.json(version);
});

/**
 * GET /api/remote-skills/configs
 * Returns the complete remote skills configuration
 */
remoteSkills.get('/configs', (c) => {
  const configs = remoteSkillsService.getConfigs();
  return c.json(configs);
});

/**
 * GET /api/remote-skills/categories
 * Returns all unique categories
 */
remoteSkills.get('/categories', (c) => {
  const categories = remoteSkillsService.getCategories();
  return c.json({ categories });
});

/**
 * GET /api/remote-skills/:skillId
 * Returns a specific remote skill configuration
 */
remoteSkills.get('/:skillId', (c) => {
  const skillId = c.req.param('skillId');
  const skill = remoteSkillsService.getRemoteSkill(skillId);

  if (!skill) {
    return c.json({ error: 'Remote skill not found' }, 404);
  }

  return c.json(skill);
});

/**
 * GET /api/remote-skills
 * Returns a list of all remote skill IDs
 */
remoteSkills.get('/', (c) => {
  const ids = remoteSkillsService.getRemoteSkillIds();
  const count = remoteSkillsService.getRemoteSkillsCount();

  return c.json({
    count,
    skills: ids,
  });
});

export default remoteSkills;
