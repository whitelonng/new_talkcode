// Marketplace types

import type { PublicUser } from './user'

export interface MarketplaceAgent {
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
  categories: Category[]
  tags: Tag[]
  isFeatured: boolean
  isPublished: boolean
  createdAt: string
  updatedAt: string
  // Agent configuration fields (from latest version)
  model?: string
  systemPrompt?: string
  rules?: string
  outputFormat?: string
}

export interface AgentVersion {
  id: string
  agentId: string
  version: string
  model: string
  systemPrompt: string
  toolsConfig: Record<string, any>
  rules?: string
  outputFormat?: string
  dynamicEnabled: boolean
  dynamicProviders: string[]
  dynamicVariables: Record<string, string>
  dynamicProviderSettings: Record<string, any>
  changelog?: string
  isPrerelease: boolean
  createdAt: string
}

export interface Category {
  id: string
  name: string
  slug: string
  description?: string
  icon?: string
  displayOrder: number
}

export interface Tag {
  id: string
  name: string
  slug: string
  usageCount: number
}

export interface Collection {
  id: string
  name: string
  slug: string
  description?: string
  icon?: string
  isFeatured: boolean
  displayOrder: number
  agents: MarketplaceAgent[]
  createdAt: string
  updatedAt: string
}

export type AgentSortOption = 'popular' | 'recent' | 'featured'
