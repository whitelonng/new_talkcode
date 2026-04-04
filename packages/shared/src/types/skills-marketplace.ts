// Skills Marketplace types

import type { PublicUser } from './user'

export interface MarketplaceSkill {
  id: string
  slug: string
  name: string
  description: string
  longDescription?: string
  author: PublicUser
  iconUrl?: string
  bannerUrl?: string
  installCount: number
  usageCount: number
  rating: number
  ratingCount: number
  latestVersion: string
  categories: SkillCategory[]
  tags: SkillTag[]
  isFeatured: boolean
  isPublished: boolean
  createdAt: string
  updatedAt: string
  // Skill content fields (from latest version)
  systemPromptFragment?: string
  workflowRules?: string
  documentation?: DocumentationItem[]
  hasScripts?: boolean
  // Agent Skills Specification fields
  compatibility?: string
  metadata?: Record<string, string> | null
}

export interface SkillVersion {
  id: string
  skillId: string
  version: string
  systemPromptFragment?: string
  workflowRules?: string
  documentation?: DocumentationItem[]
  changelog?: string
  isPrerelease: boolean
  createdAt: string
}

export interface DocumentationItem {
  type: 'inline' | 'file' | 'url'
  title: string
  content?: string
  filePath?: string
  url?: string
}

export interface SkillCategory {
  id: string
  name: string
  slug: string
  description?: string
  icon?: string
  displayOrder: number
}

export interface SkillTag {
  id: string
  name: string
  slug: string
  usageCount: number
}

export type SkillSortOption = 'popular' | 'recent' | 'downloads' | 'installs' | 'name' | 'rating' | 'updated'
