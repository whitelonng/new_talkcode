import remoteSkillsConfig from '@talkcody/shared/data/remote-skills-config.json';
import type {
  RemoteSkillConfig,
  RemoteSkillsConfiguration,
  RemoteSkillVersionResponse,
} from '@talkcody/shared/types/remote-skills';

/**
 * RemoteSkillsService handles remote skill configuration data on the API side
 */
export class RemoteSkillsService {
  /**
   * Get the current version timestamp
   */
  getVersion(): RemoteSkillVersionResponse {
    return {
      version: (remoteSkillsConfig as RemoteSkillsConfiguration).version,
    };
  }

  /**
   * Get the complete remote skills configuration
   */
  getConfigs(): RemoteSkillsConfiguration {
    return remoteSkillsConfig as RemoteSkillsConfiguration;
  }

  /**
   * Get a specific remote skill configuration by ID
   */
  getRemoteSkill(skillId: string): RemoteSkillConfig | null {
    const config = remoteSkillsConfig as RemoteSkillsConfiguration;
    return config.remoteSkills.find((skill) => skill.id === skillId) || null;
  }

  /**
   * Get all remote skill IDs
   */
  getRemoteSkillIds(): string[] {
    const config = remoteSkillsConfig as RemoteSkillsConfiguration;
    return config.remoteSkills.map((skill) => skill.id);
  }

  /**
   * Get remote skills count
   */
  getRemoteSkillsCount(): number {
    const config = remoteSkillsConfig as RemoteSkillsConfiguration;
    return config.remoteSkills.length;
  }

  /**
   * Get remote skills filtered by category
   */
  getRemoteSkillsByCategory(category: string): RemoteSkillConfig[] {
    const config = remoteSkillsConfig as RemoteSkillsConfiguration;
    return config.remoteSkills.filter((skill) => skill.category === category);
  }

  /**
   * Get all unique categories
   */
  getCategories(): string[] {
    const config = remoteSkillsConfig as RemoteSkillsConfiguration;
    const categories = new Set(config.remoteSkills.map((skill) => skill.category));
    return Array.from(categories).sort();
  }
}

// Export singleton instance
export const remoteSkillsService = new RemoteSkillsService();
