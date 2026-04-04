// API request and response types

import type { MarketplaceAgent, AgentVersion, Category, Tag, Collection, AgentSortOption } from './marketplace'
import type { MarketplaceSkill, SkillVersion, DocumentationItem, SkillSortOption } from './skills-marketplace'
import type { User } from './user'

// ==================== Authentication ====================

export interface LoginResponse {
  token: string
  user: User
}

export interface AuthMeResponse {
  user: User
}

// ==================== Marketplace Browse ====================

export interface ListAgentsRequest {
  page?: number
  limit?: number
  offset?: number
  sort?: AgentSortOption
  sortBy?: string
  category?: string
  categoryIds?: string[]
  tags?: string // comma-separated
  tagIds?: string[]
  search?: string
  minRating?: number
  isFeatured?: boolean
}

export interface ListAgentsResponse {
  agents: MarketplaceAgent[]
  total: number
  page: number
  limit: number
  hasMore: boolean
}

export interface GetAgentResponse {
  agent: MarketplaceAgent
}

export interface GetAgentVersionsResponse {
  versions: AgentVersion[]
}

export interface GetAgentVersionResponse {
  version: AgentVersion
}

export interface GetCategoriesResponse {
  categories: Category[]
}

export interface GetTagsResponse {
  tags: Tag[]
}

export interface GetCollectionsResponse {
  collections: Collection[]
}

export interface GetCollectionResponse {
  collection: Collection
}

export interface GetFeaturedAgentsResponse {
  agents: MarketplaceAgent[]
}

// ==================== Agent Publishing ====================

export interface CreateAgentRequest {
  name: string
  description: string
  longDescription?: string
  iconUrl?: string
  categories: string[] // category slugs
  tags: string[] // tag names

  // First version data
  version: string
  model: string
  systemPrompt: string
  toolsConfig: Record<string, any>
  rules?: string
  outputFormat?: string
  dynamicEnabled: boolean
  dynamicProviders: string[]
  dynamicVariables: Record<string, string>
  dynamicProviderSettings?: Record<string, any>
  changelog?: string
}

export interface CreateAgentResponse {
  agent: MarketplaceAgent
  version: AgentVersion
}

export interface UpdateAgentRequest {
  name?: string
  description?: string
  longDescription?: string
  iconUrl?: string
  bannerUrl?: string
  categories?: string[]
  tags?: string[]
  isPublished?: boolean
}

export interface UpdateAgentResponse {
  agent: MarketplaceAgent
}

export interface CreateVersionRequest {
  version: string
  model: string
  systemPrompt: string
  toolsConfig: Record<string, any>
  rules?: string
  outputFormat?: string
  dynamicEnabled: boolean
  dynamicProviders: string[]
  dynamicVariables: Record<string, string>
  dynamicProviderSettings?: Record<string, any>
  changelog?: string
  isPrerelease?: boolean
}

export interface CreateVersionResponse {
  version: AgentVersion
}

// ==================== User ====================

export interface GetUserAgentsResponse {
  agents: MarketplaceAgent[]
}

export interface UserStatsResponse {
  totalAgents: number
  totalDownloads: number
  totalInstalls: number
  totalUsage: number
}

// ==================== Statistics ====================

export interface TrackEventRequest {
  version?: string
}

export interface TrackEventResponse {
  message: string
}

// ==================== Skills Publishing ====================

export interface CreateSkillRequest {
  name: string
  description: string
  longDescription?: string
  iconUrl?: string
  categories: string[] // category slugs
  tags: string[] // tag names

  // Skill content
  systemPromptFragment?: string
  workflowRules?: string
  documentation: DocumentationItem[]

  // R2 storage fields (optional, used when publishing local skills)
  storageUrl?: string
  packageSize?: number
  checksum?: string
  hasScripts?: boolean

  // Agent Skills Specification fields
  compatibility?: string
  metadata?: Record<string, string> | null
}

export interface CreateSkillResponse {
  skill: MarketplaceSkill
  version: SkillVersion
}

export interface UpdateSkillRequest {
  name?: string
  description?: string
  longDescription?: string
  iconUrl?: string
  bannerUrl?: string
  categories?: string[]
  tags?: string[]
  systemPromptFragment?: string
  workflowRules?: string
  documentation?: DocumentationItem[]
  isPublished?: boolean

  // Agent Skills Specification fields
  compatibility?: string
  metadata?: Record<string, string> | null
}

export interface UpdateSkillResponse {
  skill: MarketplaceSkill
}

export interface CreateSkillVersionRequest {
  version: string
  systemPromptFragment?: string
  workflowRules?: string
  documentation: DocumentationItem[]
  changelog?: string
  isPrerelease?: boolean
}

export interface CreateSkillVersionResponse {
  version: SkillVersion
}

export interface ListSkillsRequest {
  page?: number
  limit?: number
  offset?: number
  sort?: SkillSortOption
  category?: string
  categoryIds?: string[]
  tags?: string // comma-separated
  tagIds?: string[]
  search?: string
  minRating?: number
  isFeatured?: boolean
}

export interface ListSkillsResponse {
  skills: MarketplaceSkill[]
  total: number
  page: number
  limit: number
  hasMore: boolean
}

export interface GetSkillResponse {
  skill: MarketplaceSkill
}

export interface GetSkillVersionsResponse {
  versions: SkillVersion[]
}

export interface GetSkillVersionResponse {
  version: SkillVersion
}

export interface GetUserSkillsResponse {
  skills: MarketplaceSkill[]
}

// ==================== Error Response ====================

export interface ErrorResponse {
  error: string
  details?: any
}
