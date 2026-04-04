// Agent types (extended from existing local agent types)

export type AgentSourceType = 'system' | 'local' | 'marketplace'

export type ModelType = 'main_model' | 'small_model' | 'image_generator_model' | 'transcription_model'

export interface LocalAgent {
  id: string
  name: string
  description: string
  model: string // DEPRECATED: Use modelType instead. Kept for backwards compatibility
  modelType?: ModelType // New: Model type category
  systemPrompt: string
  toolsConfig: Record<string, any>
  rules?: string
  outputFormat?: string
  isHidden: boolean
  isDefault: boolean
  isEnabled: boolean

  // Dynamic prompt config
  dynamicEnabled: boolean
  dynamicProviders: string[]
  dynamicVariables: Record<string, string>
  dynamicProviderSettings?: Record<string, any>

  // Marketplace metadata
  sourceType: AgentSourceType
  marketplaceId?: string
  marketplaceVersion?: string
  forkedFromId?: string
  forkedFromMarketplaceId?: string
  isShared: boolean
  lastSyncedAt?: number

  // Additional metadata
  iconUrl?: string
  authorName?: string
  authorId?: string
  categories: string[]
  tags: string[]

  createdAt: number
  updatedAt: number
  createdBy: string
  usageCount: number
}
