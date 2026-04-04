// Fork agent functionality

import { logger } from '@/lib/logger';
import { agentRegistry } from './agent-registry';

/**
 * Fork an existing agent to create a new one
 * @param sourceAgentId - ID of the agent to fork
 * @returns ID of the newly created agent
 */
export async function forkAgent(sourceAgentId: string): Promise<string | null> {
  try {
    const sourceAgent = await agentRegistry.get(sourceAgentId);

    if (!sourceAgent) {
      logger.error(`Cannot fork agent: source agent ${sourceAgentId} not found`);
      return null;
    }

    // Generate new ID based on source agent name
    const baseId = sourceAgent.name
      .toLowerCase()
      .trim()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/(^-|-$)/g, '');

    // Find a unique ID
    let newId = `${baseId}-fork`;
    let counter = 1;
    while (await agentRegistry.get(newId)) {
      newId = `${baseId}-fork-${counter++}`;
    }

    // Generate fork name
    let newName = `${sourceAgent.name} (Fork)`;
    if (counter > 1) {
      newName = `${sourceAgent.name} (Fork ${counter})`;
    }

    // Create forked agent definition
    const forkedAgent = {
      id: newId,
      name: newName,
      description: sourceAgent.description || '',
      // Default modelType to 'main_model' if not provided (fixes NOT NULL constraint)
      modelType: sourceAgent.modelType || 'main_model',
      systemPrompt: sourceAgent.systemPrompt,
      tools: sourceAgent.tools || {},
      hidden: false,
      rules: sourceAgent.rules,
      outputFormat: sourceAgent.outputFormat,
      isDefault: false, // Always false - forked agents are user agents
      version: undefined, // Clear version - user agents don't have versions
      dynamicPrompt: sourceAgent.dynamicPrompt,
      defaultSkills: sourceAgent.defaultSkills,
    };

    // Register the forked agent
    await agentRegistry.forceRegister(forkedAgent);

    logger.info(`Successfully forked agent ${sourceAgentId} to ${newId}`);
    return newId;
  } catch (error) {
    logger.error(`Failed to fork agent ${sourceAgentId}:`, error);
    return null;
  }
}
