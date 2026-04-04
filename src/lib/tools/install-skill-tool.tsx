import { join } from '@tauri-apps/api/path';
import { z } from 'zod';
import { GenericToolDoing } from '@/components/tools/generic-tool-doing';
import { GenericToolResult } from '@/components/tools/generic-tool-result';
import { createTool } from '@/lib/create-tool';
import { logger } from '@/lib/logger';
import { getAgentSkillService } from '@/services/skills/agent-skill-service';
import { importSkillFromGitHub } from '@/services/skills/github-import-service';

const inputSchema = z.object({
  repository: z.string().min(1).describe('GitHub repository in "owner/repo" format'),
  path: z.string().min(1).describe('Path to skill in repository, e.g. "skills/my-skill"'),
  skillId: z.string().optional().describe('Optional skill identifier (defaults to directory name)'),
});

export const installSkill = createTool({
  name: 'installSkill',
  description: 'Install a skill from a GitHub repository into ~/.talkcody/skills.',
  inputSchema,
  canConcurrent: false,
  execute: async ({ repository, path, skillId }, context) => {
    const taskId = context.taskId;
    if (!taskId) {
      throw new Error('taskId is required for installSkill tool');
    }

    const normalizedPath = path.trim();
    if (!normalizedPath) {
      return {
        success: false,
        message: 'Path is required.',
      };
    }

    const derivedSkillId = skillId?.trim() || normalizedPath.split('/').filter(Boolean).pop();
    if (!derivedSkillId) {
      return {
        success: false,
        message: 'Unable to determine skillId from path.',
      };
    }

    const agentSkillService = await getAgentSkillService();
    const targetDir = await agentSkillService.ensureHomeSkillsDirExists();

    try {
      await importSkillFromGitHub({
        repository: repository.trim(),
        path: normalizedPath,
        skillId: derivedSkillId,
        targetDir,
      });

      const installedPath = await join(targetDir, derivedSkillId);
      return {
        success: true,
        skillName: derivedSkillId,
        installedPath,
        message: `Installed skill "${derivedSkillId}" to ${installedPath}.`,
      };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      logger.error('installSkill failed', {
        error: errorMessage,
        repository,
        path: normalizedPath,
        taskId,
      });
      return {
        success: false,
        message: `Failed to install skill: ${errorMessage}`,
      };
    }
  },
  renderToolDoing: ({ repository, path }) => (
    <GenericToolDoing
      type="skill"
      operation="fetch"
      target={`${repository}/${path}`}
      details="Installing skill"
    />
  ),
  renderToolResult: (result) => (
    <GenericToolResult success={result?.success ?? false} message={result?.message} />
  ),
});
