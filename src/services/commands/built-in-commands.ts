// src/services/commands/built-in-commands.ts

import { z } from 'zod';
import { compactTaskContext } from '@/services/context/manual-context-compaction';
import type { Command, CommandContext } from '@/types/command';
import { CommandCategory, CommandType } from '@/types/command';

export async function getBuiltInCommands(): Promise<Command[]> {
  const commands: Command[] = [
    // /new - Create new task
    {
      id: 'new-task',
      name: 'new',
      description: 'Create a new task',
      category: CommandCategory.TASK,
      type: CommandType.ACTION,
      executor: async (_args, context) => {
        try {
          if (context.createNewTask) {
            await context.createNewTask();
            return {
              success: true,
              message: 'New task created successfully',
            };
          }
          return {
            success: false,
            error: 'Unable to create new task - function not available',
          };
        } catch (error) {
          return {
            success: false,
            error: `Failed to create new task: ${error}`,
          };
        }
      },
      isBuiltIn: true,
      enabled: true,
      icon: 'Plus',
      examples: ['/new'],
      createdAt: new Date(),
      updatedAt: new Date(),
    },

    // /compact - Manually trigger context compaction for current task
    {
      id: 'compact-task',
      name: 'compact',
      description: 'Manually compact the current task context',
      category: CommandCategory.TASK,
      type: CommandType.ACTION,
      executor: async (_args, context) => executeCompactCommand(context),
      isBuiltIn: true,
      enabled: true,
      icon: 'Archive',
      aliases: ['compress'],
      requiresTask: true,
      examples: ['/compact'],
      createdAt: new Date(),
      updatedAt: new Date(),
    },

    // /init - Initialize project with AGENTS.md
    {
      id: 'init-project',
      name: 'init',
      description: 'Initialize project with AGENTS.md guide',
      category: CommandCategory.PROJECT,
      type: CommandType.AI_PROMPT,
      parameters: [
        {
          name: 'type',
          description: 'Project type (web, api, mobile, etc.)',
          required: false,
          type: 'string',
        },
      ],
      parametersSchema: z.object({
        type: z.string().optional(),
        _raw: z.string().optional(),
      }),
      executor: async (args, _context) => {
        const projectType = args.type || args._raw || '';

        let aiMessage =
          'Please help initialize this project by creating an AGENTS.md file that serves as a comprehensive guide for AI agents working on this project. ';

        if (projectType) {
          aiMessage += `The project type is: ${projectType}. `;
        }

        return {
          success: true,
          message: 'Project initialization started',
          continueProcessing: true,
          aiMessage,
        };
      },
      isBuiltIn: true,
      enabled: true,
      icon: 'FileText',
      preferredAgentId: 'init-project',
      aliases: ['initialize'],
      examples: ['/init', '/init web application'],
      createdAt: new Date(),
      updatedAt: new Date(),
    },

    // /create-tool - Create a custom tool
    {
      id: 'create-tool',
      name: 'create-tool',
      description: 'Create and install a custom tool',
      category: CommandCategory.PROJECT,
      type: CommandType.AI_PROMPT,
      parameters: [
        {
          name: 'name',
          description: 'Tool name or short description',
          required: false,
          type: 'string',
        },
      ],
      parametersSchema: z.object({
        name: z.string().optional(),
        _raw: z.string().optional(),
      }),
      executor: async (args, _context) => {
        const toolHint = args.name || args._raw || '';

        let aiMessage =
          'Please help create a custom TalkCody tool. Gather requirements (name, purpose, inputs, permissions, output) and produce a valid tool definition file using toolHelper from @/lib/custom-tool-sdk. ' +
          'The tool should be saved under .talkcody/tools as a .tsx file and include renderToolDoing/renderToolResult when useful. ' +
          'Use simpleFetch from @/lib/tauri-fetch for network calls. ' +
          'After creation, ensure the tool is installed by refreshing Custom Tools (Settings → Custom Tools → Refresh) or using Tool Playground Install. ';

        if (toolHint) {
          aiMessage += `The tool request is: ${toolHint}. `;
        }

        return {
          success: true,
          message: 'Custom tool creation started',
          continueProcessing: true,
          aiMessage,
        };
      },
      isBuiltIn: true,
      enabled: true,
      icon: 'Wrench',
      preferredAgentId: 'create-tool',
      aliases: ['new-tool', 'tool'],
      examples: ['/create-tool', '/create-tool weather fetcher'],
      createdAt: new Date(),
      updatedAt: new Date(),
    },

    // /create-agent - Create a custom agent
    {
      id: 'create-agent',
      name: 'create-agent',
      description: 'Create and register a custom local agent',
      category: CommandCategory.PROJECT,
      type: CommandType.AI_PROMPT,
      parameters: [
        {
          name: 'name',
          description: 'Agent name or short description',
          required: false,
          type: 'string',
        },
      ],
      parametersSchema: z.object({
        name: z.string().optional(),
        _raw: z.string().optional(),
      }),
      executor: async (args, _context) => {
        const agentHint = args.name || args._raw || '';

        let aiMessage =
          'Please help create a custom TalkCody agent. Gather requirements (name, purpose, tools, model type, rules, output format, dynamic context). ' +
          'Write a Markdown agent definition to .talkcody/agents/<kebab-id>.md using the writeFile tool (no code files, no registry edits). ' +
          'Ensure the agent is visible in the local agents list after refresh. ';

        if (agentHint) {
          aiMessage += `The agent request is: ${agentHint}. `;
        }

        return {
          success: true,
          message: 'Custom agent creation started',
          continueProcessing: true,
          aiMessage,
        };
      },
      isBuiltIn: true,
      enabled: true,
      icon: 'Bot',
      preferredAgentId: 'create-agent',
      aliases: ['new-agent', 'agent'],
      examples: ['/create-agent', '/create-agent code reviewer'],
      createdAt: new Date(),
      updatedAt: new Date(),
    },

    // /create-skill - Create a custom local skill
    {
      id: 'create-skill',
      name: 'create-skill',
      description: 'Create a custom local skill (SKILL.md)',
      category: CommandCategory.PROJECT,
      type: CommandType.AI_PROMPT,
      parameters: [
        {
          name: 'name',
          description: 'Skill name or short description',
          required: false,
          type: 'string',
        },
      ],
      parametersSchema: z.object({
        name: z.string().optional(),
        _raw: z.string().optional(),
      }),
      executor: async (args, _context) => {
        const skillHint = args.name || args._raw || '';

        let aiMessage =
          'Please help create a custom local TalkCody skill. Gather requirements (name, purpose, description, category/tags, system prompt fragment, workflow rules, documentation, compatibility/license) and generate a valid SKILL.md following the Agent Skills Specification. ' +
          'The skill should be saved under the local skills directory (use AgentSkillService.getSkillsDirPath()) as a new folder containing SKILL.md, and optional references/scripts/assets directories if needed. ' +
          'Ensure the skill name is kebab-case and matches the directory name. Do not overwrite existing skills without confirmation. ' +
          'Provide bilingual (EN/ZH) user-visible text when possible. ';

        if (skillHint) {
          aiMessage += `The skill request is: ${skillHint}. `;
        }

        return {
          success: true,
          message: 'Custom skill creation started',
          continueProcessing: true,
          aiMessage,
        };
      },
      isBuiltIn: true,
      enabled: true,
      icon: 'Sparkles',
      preferredAgentId: 'create-skill',
      aliases: ['new-skill', 'skill'],
      examples: ['/create-skill', '/create-skill design system coach'],
      createdAt: new Date(),
      updatedAt: new Date(),
    },
  ];

  return commands;
}

async function executeCompactCommand(context: CommandContext) {
  const { taskId } = context;

  if (!taskId) {
    return {
      success: false,
      message: 'No active task - cannot compact context',
      error: 'No active task - cannot compact context',
      continueProcessing: false,
      data: {
        type: 'compaction',
        stats: {
          originalMessageCount: null,
          compressedMessageCount: null,
          reductionPercent: null,
          compressionRatio: null,
        },
      },
    };
  }

  const result = await compactTaskContext(taskId);

  return {
    success: result.success,
    message: result.message,
    error: result.error,
    continueProcessing: false,
    data: {
      type: 'compaction',
      stats: {
        originalMessageCount: result.originalMessageCount,
        compressedMessageCount: result.compressedMessageCount,
        reductionPercent: result.reductionPercent,
        compressionRatio: result.compressionRatio,
      },
    },
  };
}
