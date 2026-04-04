import { describe, expect, it, vi, beforeEach } from 'vitest';
import { installSkill } from './install-skill-tool';

vi.mock('@/services/skills/agent-skill-service', () => ({
  getAgentSkillService: vi.fn().mockResolvedValue({
    ensureHomeSkillsDirExists: vi.fn().mockResolvedValue('/mock/home/.talkcody/skills'),
  }),
}));

vi.mock('@/services/skills/github-import-service', () => ({
  importSkillFromGitHub: vi.fn().mockResolvedValue(undefined),
}));

vi.mock('@tauri-apps/api/path', () => ({
  join: vi.fn((...parts: string[]) => Promise.resolve(parts.join('/'))),
}));

describe('installSkill tool', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('installs skill to home skills directory with derived skillId', async () => {
    const result = await installSkill.execute(
      { repository: 'talkcody/skills', path: 'skills/theme-factory' },
      { taskId: 'task-1', toolId: 'tool-1' }
    );

    const { importSkillFromGitHub } = await import('@/services/skills/github-import-service');
    expect(importSkillFromGitHub).toHaveBeenCalledWith({
      repository: 'talkcody/skills',
      path: 'skills/theme-factory',
      skillId: 'theme-factory',
      targetDir: '/mock/home/.talkcody/skills',
    });

    expect(result.success).toBe(true);
    expect(result.installedPath).toBe('/mock/home/.talkcody/skills/theme-factory');
  });

  it('returns error when path is missing', async () => {
    const result = await installSkill.execute(
      { repository: 'talkcody/skills', path: '  ' },
      { taskId: 'task-1', toolId: 'tool-1' }
    );

    expect(result.success).toBe(false);
    expect(result.message).toBe('Path is required.');
  });
});
