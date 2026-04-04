/**
 * Skills Services Exports
 *
 * This module exports all skills-related services and types
 */
import { getSkillService, SkillService } from './skill-service';

// Agent Skills Specification types
export type {
  AgentSkill,
  AgentSkillDirectory,
  AgentSkillFrontmatter,
  CreateSkillParams,
  DisclosureLevel,
  SkillDiscoveryInfo,
  UpdateSkillParams,
} from '@/types/agent-skills-spec';

// Skill types from @/types/skill
export type {
  DocumentationItem,
  MarketplaceSkill,
  Skill,
  SkillCategory,
  SkillContent,
  SkillFilter,
  SkillSortOption,
  SkillTag,
  TaskSkill,
} from '@/types/skill';

// Agent Skills Specification services
export { AgentSkillService, getAgentSkillService } from './agent-skill-service';
export type { ValidationError, ValidationResult, ValidationWarning } from './agent-skill-validator';
export { AgentSkillValidator } from './agent-skill-validator';
export type { ParsedSkillMd, ParseOptions } from './skill-md-parser';

// Legacy skill service
export { SkillService, getSkillService };
