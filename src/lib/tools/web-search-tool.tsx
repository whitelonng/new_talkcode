import { z } from 'zod';
import { SearchToolDoing } from '@/components/tools/search-tool-doing';
import { SearchToolResult } from '@/components/tools/search-tool-result';
import { createTool } from '@/lib/create-tool';
import { webSearch } from '../web-search';

export const webSearchTool = createTool({
  name: 'webSearch',
  description: `Search the web for comprehensive and up-to-date information.

Query Optimization Guidelines:
- Extract the core topic/entity from questions (e.g., "who is Elon Musk" → "Elon Musk", "what is React" → "React")
- For comparisons (e.g., "X vs Y"), search for both terms together to get comparison results
- Remove question words (who, what, when, where, why, how) but keep context words that add meaning
- Keep technical terms, version numbers, and specific qualifiers (e.g., "React 19 features" stays as-is)
- For "latest" or "recent" queries, include temporal keywords (e.g., "latest AI models 2025")
- Preserve programming language/framework context (e.g., "error handling in Rust" → "Rust error handling")
- For debugging queries, keep error messages and stack traces intact
- Use multiple searches only when topics are completely unrelated, not for comparisons`,
  inputSchema: z.object({
    query: z.string().min(1).max(100).describe('The search query'),
  }),
  canConcurrent: true,
  execute: async ({ query }) => {
    return await webSearch(query);
  },
  renderToolDoing: ({ query }) => <SearchToolDoing query={query} />,
  renderToolResult: (result, { query } = {}) => <SearchToolResult results={result} query={query} />,
});
