// Shared constants

export const DEFAULT_CATEGORIES = [
  { slug: 'coding', name: 'Coding', icon: '💻' },
  { slug: 'writing', name: 'Writing', icon: '✍️' },
  { slug: 'data', name: 'Data Analysis', icon: '📊' },
  { slug: 'research', name: 'Research', icon: '🔬' },
  { slug: 'productivity', name: 'Productivity', icon: '⚡' },
  { slug: 'creative', name: 'Creative', icon: '🎨' },
  { slug: 'education', name: 'Education', icon: '📚' },
  { slug: 'business', name: 'Business', icon: '💼' },
  { slug: 'frontend', name: 'Frontend', icon: '🌐' }
] as const

export const DEFAULT_TAGS = [
  'typescript',
  'javascript',
  'python',
  'react',
  'vue',
  'angular',
  'nodejs',
  'rust',
  'go',
  'debugging',
  'code-review',
  'refactoring',
  'documentation',
  'testing',
  'api',
  'database',
  'frontend',
  'backend',
  'fullstack',
  'devops',
] as const

export const AGENT_SORT_OPTIONS = [
  { value: 'popular', label: 'Most Popular' },
  { value: 'recent', label: 'Recently Added' },
  { value: 'featured', label: 'Featured' },
] as const

export const ITEMS_PER_PAGE = 20
export const MAX_DESCRIPTION_LENGTH = 500
export const MAX_LONG_DESCRIPTION_LENGTH = 5000
export const MAX_CHANGELOG_LENGTH = 2000
export const MAX_TAGS_PER_AGENT = 10
export const MAX_CATEGORIES_PER_AGENT = 3
