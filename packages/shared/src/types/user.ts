// User types for marketplace

export interface User {
  id: string
  name: string
  email?: string
  avatarUrl?: string
  displayName?: string
  oauthProvider: 'github' | 'google'
  oauthId: string
  createdAt: string
  updatedAt: string
}

export interface PublicUser {
  id: string
  name: string
  displayName?: string
  avatarUrl?: string
  bio?: string
  website?: string
  agentCount?: number
}
