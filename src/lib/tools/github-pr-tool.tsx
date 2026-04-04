import { z } from 'zod';
import { GenericToolDoing } from '@/components/tools/generic-tool-doing';
import { GenericToolResult } from '@/components/tools/generic-tool-result';
import { createTool } from '@/lib/create-tool';
import { fetchWithTimeout } from '../utils';

// GitHub API base URL
const GITHUB_API_BASE = 'https://api.github.com';

// Types for GitHub PR data
interface GitHubPRInfo {
  number: number;
  title: string;
  body: string | null;
  state: string;
  html_url: string;
  user: {
    login: string;
  };
  head: {
    ref: string;
    sha: string;
  };
  base: {
    ref: string;
    sha: string;
  };
  created_at: string;
  updated_at: string;
  merged_at: string | null;
  additions: number;
  deletions: number;
  changed_files: number;
}

interface GitHubPRFile {
  filename: string;
  status: string;
  additions: number;
  deletions: number;
  changes: number;
  patch?: string;
}

interface GitHubPRComment {
  id: number;
  user: {
    login: string;
  };
  body: string;
  created_at: string;
  path?: string;
  line?: number;
}

export interface GitHubPRResult {
  success: boolean;
  action: string;
  prUrl: string;
  data?: GitHubPRInfo | GitHubPRFile[] | string | GitHubPRComment[];
  rateLimitRemaining?: number;
  error?: string;
  pagination?: {
    page: number;
    perPage: number;
    hasMore: boolean;
    totalReturned: number;
  };
  filteredBy?: string;
}

// Parse GitHub PR URL to extract owner, repo, and PR number
function parseGitHubPRUrl(url: string): { owner: string; repo: string; prNumber: number } | null {
  // Match patterns like: https://github.com/owner/repo/pull/123
  const regex = /github\.com\/([^/]+)\/([^/]+)\/pull\/(\d+)/;
  const match = url.match(regex);

  if (!match || !match[1] || !match[2] || !match[3]) {
    return null;
  }

  return {
    owner: match[1],
    repo: match[2],
    prNumber: parseInt(match[3], 10),
  };
}

// Common headers for GitHub API requests
function getGitHubHeaders(acceptType?: string): Record<string, string> {
  return {
    Accept: acceptType || 'application/vnd.github+json',
    'User-Agent': 'TalkCody-GitHub-PR-Tool',
    'X-GitHub-Api-Version': '2022-11-28',
  };
}

// Match filename against a glob-like pattern
function matchFilename(filename: string, pattern: string): boolean {
  // Convert glob pattern to regex
  // *.ts -> matches any .ts file
  // src/** -> matches anything under src/
  // src/*.ts -> matches .ts files directly in src/
  const regexPattern = pattern
    .replace(/[.+^${}()|[\]\\]/g, '\\$&') // Escape special regex chars except * and ?
    .replace(/\*\*/g, '<<<GLOBSTAR>>>') // Temporarily replace **
    .replace(/\*/g, '[^/]*') // * matches anything except /
    .replace(/<<<GLOBSTAR>>>/g, '.*') // ** matches anything including /
    .replace(/\?/g, '[^/]'); // ? matches single char except /

  const regex = new RegExp(`^${regexPattern}$`);
  return regex.test(filename);
}

// Fetch PR basic information
async function fetchPRInfo(
  owner: string,
  repo: string,
  prNumber: number
): Promise<{ data?: GitHubPRInfo; rateLimitRemaining?: number; error?: string }> {
  try {
    const response = await fetchWithTimeout(
      `${GITHUB_API_BASE}/repos/${owner}/${repo}/pulls/${prNumber}`,
      {
        headers: getGitHubHeaders(),
        timeout: 30000,
      }
    );

    const rateLimitRemaining = parseInt(response.headers.get('X-RateLimit-Remaining') || '0', 10);

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      return {
        error: `GitHub API error: ${response.status} - ${(errorData as { message?: string }).message || response.statusText}`,
        rateLimitRemaining,
      };
    }

    const data = (await response.json()) as GitHubPRInfo;
    return { data, rateLimitRemaining };
  } catch (error) {
    return {
      error: `Failed to fetch PR info: ${error instanceof Error ? error.message : String(error)}`,
    };
  }
}

// Fetch PR changed files with pagination support
async function fetchPRFiles(
  owner: string,
  repo: string,
  prNumber: number,
  options?: { page?: number; perPage?: number; filenameFilter?: string }
): Promise<{
  data?: GitHubPRFile[];
  rateLimitRemaining?: number;
  error?: string;
  pagination?: { page: number; perPage: number; hasMore: boolean; totalReturned: number };
  filteredBy?: string;
}> {
  try {
    const page = options?.page || 1;
    const perPage = Math.min(options?.perPage || 30, 100); // Max 100 per GitHub API

    const url = new URL(`${GITHUB_API_BASE}/repos/${owner}/${repo}/pulls/${prNumber}/files`);
    url.searchParams.set('page', String(page));
    url.searchParams.set('per_page', String(perPage));

    const response = await fetchWithTimeout(url.toString(), {
      headers: getGitHubHeaders(),
      timeout: 30000,
    });

    const rateLimitRemaining = parseInt(response.headers.get('X-RateLimit-Remaining') || '0', 10);

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      return {
        error: `GitHub API error: ${response.status} - ${(errorData as { message?: string }).message || response.statusText}`,
        rateLimitRemaining,
      };
    }

    let data = (await response.json()) as GitHubPRFile[];

    // Apply filename filter if provided
    let filteredBy: string | undefined;
    if (options?.filenameFilter) {
      data = data.filter((file) => matchFilename(file.filename, options.filenameFilter!));
      filteredBy = options.filenameFilter;
    }

    // Check if there are more pages (GitHub returns Link header)
    const linkHeader = response.headers.get('Link');
    const hasMore = linkHeader ? linkHeader.includes('rel="next"') : false;

    return {
      data,
      rateLimitRemaining,
      pagination: {
        page,
        perPage,
        hasMore,
        totalReturned: data.length,
      },
      filteredBy,
    };
  } catch (error) {
    return {
      error: `Failed to fetch PR files: ${error instanceof Error ? error.message : String(error)}`,
    };
  }
}

// Fetch PR diff - supports filename filter by using files endpoint
async function fetchPRDiff(
  owner: string,
  repo: string,
  prNumber: number,
  options?: { filenameFilter?: string; page?: number; perPage?: number }
): Promise<{
  data?: string;
  rateLimitRemaining?: number;
  error?: string;
  pagination?: { page: number; perPage: number; hasMore: boolean; totalReturned: number };
  filteredBy?: string;
}> {
  try {
    // If filename filter is provided, use files endpoint and extract patches
    if (options?.filenameFilter) {
      const filesResult = await fetchPRFiles(owner, repo, prNumber, {
        page: options.page,
        perPage: options.perPage,
        filenameFilter: options.filenameFilter,
      });

      if (filesResult.error) {
        return { error: filesResult.error, rateLimitRemaining: filesResult.rateLimitRemaining };
      }

      // Combine patches from filtered files into a single diff string
      const diffParts: string[] = [];
      for (const file of filesResult.data || []) {
        if (file.patch) {
          diffParts.push(`diff --git a/${file.filename} b/${file.filename}`);
          diffParts.push(`--- a/${file.filename}`);
          diffParts.push(`+++ b/${file.filename}`);
          diffParts.push(file.patch);
          diffParts.push(''); // Empty line between files
        }
      }

      return {
        data: diffParts.join('\n'),
        rateLimitRemaining: filesResult.rateLimitRemaining,
        pagination: filesResult.pagination,
        filteredBy: filesResult.filteredBy,
      };
    }

    // No filter - fetch full diff
    const response = await fetchWithTimeout(
      `${GITHUB_API_BASE}/repos/${owner}/${repo}/pulls/${prNumber}`,
      {
        headers: getGitHubHeaders('application/vnd.github.diff'),
        timeout: 60000, // Longer timeout for potentially large diffs
      }
    );

    const rateLimitRemaining = parseInt(response.headers.get('X-RateLimit-Remaining') || '0', 10);

    if (!response.ok) {
      return {
        error: `GitHub API error: ${response.status} - ${response.statusText}`,
        rateLimitRemaining,
      };
    }

    const data = await response.text();
    return { data, rateLimitRemaining };
  } catch (error) {
    return {
      error: `Failed to fetch PR diff: ${error instanceof Error ? error.message : String(error)}`,
    };
  }
}

// Fetch PR review comments
async function fetchPRComments(
  owner: string,
  repo: string,
  prNumber: number
): Promise<{ data?: GitHubPRComment[]; rateLimitRemaining?: number; error?: string }> {
  try {
    const response = await fetchWithTimeout(
      `${GITHUB_API_BASE}/repos/${owner}/${repo}/pulls/${prNumber}/comments`,
      {
        headers: getGitHubHeaders(),
        timeout: 30000,
      }
    );

    const rateLimitRemaining = parseInt(response.headers.get('X-RateLimit-Remaining') || '0', 10);

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      return {
        error: `GitHub API error: ${response.status} - ${(errorData as { message?: string }).message || response.statusText}`,
        rateLimitRemaining,
      };
    }

    const data = (await response.json()) as GitHubPRComment[];
    return { data, rateLimitRemaining };
  } catch (error) {
    return {
      error: `Failed to fetch PR comments: ${error instanceof Error ? error.message : String(error)}`,
    };
  }
}

export const githubPRTool = createTool({
  name: 'githubPR',
  description: `Fetch GitHub Pull Request information using GitHub REST API.
This tool works cross-platform without requiring the gh CLI.

Actions:
- info: Get PR metadata (title, author, state, branch info, stats)
- files: Get list of changed files with patch content (supports pagination and filename filter)
- diff: Get the diff for the PR (supports filename filter to get specific files only)
- comments: Get review comments on the PR

Pagination (for files/diff actions):
- page: Page number (starts from 1)
- perPage: Items per page (max 100, default 30)

Filename filter (for files/diff actions):
- filenameFilter: Glob pattern to filter files (e.g., "*.ts", "src/**", "src/*.tsx")

Examples:
- Get first 30 files: { action: "files", page: 1 }
- Get only .ts files: { action: "files", filenameFilter: "*.ts" }
- Get diff for src folder only: { action: "diff", filenameFilter: "src/**" }

Note: For public repositories only. Rate limited to 60 requests/hour without authentication.`,
  inputSchema: z.object({
    url: z.string().describe('Full GitHub PR URL (e.g., https://github.com/owner/repo/pull/123)'),
    action: z.enum(['info', 'files', 'diff', 'comments']).describe('The type of PR data to fetch'),
    page: z
      .number()
      .optional()
      .describe('Page number for pagination (starts from 1). Only for files/diff actions.'),
    perPage: z
      .number()
      .max(100)
      .optional()
      .describe('Items per page (max 100, default 30). Only for files/diff actions.'),
    filenameFilter: z
      .string()
      .optional()
      .describe(
        'Glob pattern to filter files (e.g., "*.ts", "src/**"). Only for files/diff actions.'
      ),
  }),
  canConcurrent: true,
  hidden: true,
  execute: async ({ url, action, page, perPage, filenameFilter }): Promise<GitHubPRResult> => {
    const parsed = parseGitHubPRUrl(url);

    if (!parsed) {
      return {
        success: false,
        action,
        prUrl: url,
        error: 'Invalid GitHub PR URL. Expected format: https://github.com/owner/repo/pull/123',
      };
    }

    const { owner, repo, prNumber } = parsed;

    switch (action) {
      case 'info': {
        const result = await fetchPRInfo(owner, repo, prNumber);
        return {
          success: !result.error,
          action,
          prUrl: url,
          data: result.data,
          rateLimitRemaining: result.rateLimitRemaining,
          error: result.error,
        };
      }

      case 'files': {
        const result = await fetchPRFiles(owner, repo, prNumber, { page, perPage, filenameFilter });
        return {
          success: !result.error,
          action,
          prUrl: url,
          data: result.data,
          rateLimitRemaining: result.rateLimitRemaining,
          error: result.error,
          pagination: result.pagination,
          filteredBy: result.filteredBy,
        };
      }

      case 'diff': {
        const result = await fetchPRDiff(owner, repo, prNumber, { filenameFilter, page, perPage });
        return {
          success: !result.error,
          action,
          prUrl: url,
          data: result.data,
          rateLimitRemaining: result.rateLimitRemaining,
          error: result.error,
          pagination: result.pagination,
          filteredBy: result.filteredBy,
        };
      }

      case 'comments': {
        const result = await fetchPRComments(owner, repo, prNumber);
        return {
          success: !result.error,
          action,
          prUrl: url,
          data: result.data,
          rateLimitRemaining: result.rateLimitRemaining,
          error: result.error,
        };
      }

      default:
        return {
          success: false,
          action,
          prUrl: url,
          error: `Unknown action: ${action}`,
        };
    }
  },
  renderToolDoing: ({ url, action }) => (
    <GenericToolDoing operation="fetch" target={url} details={`Fetching PR ${action}`} />
  ),
  renderToolResult: (result, params = {}) => {
    if (!result.success) {
      return (
        <GenericToolResult success={false} message={result.error || 'Failed to fetch PR data'} />
      );
    }

    let message: string;
    if (
      result.action === 'info' &&
      result.data &&
      typeof result.data === 'object' &&
      'title' in result.data
    ) {
      const info = result.data as GitHubPRInfo;
      message = `PR #${info.number}: ${info.title} (${info.state})`;
    } else if (result.action === 'files' && Array.isArray(result.data)) {
      message = `${result.data.length} files changed`;
    } else if (result.action === 'diff' && typeof result.data === 'string') {
      message = `Diff: ${result.data.length} characters`;
    } else if (result.action === 'comments' && Array.isArray(result.data)) {
      message = `${result.data.length} review comments`;
    } else {
      message = 'PR data fetched successfully';
    }

    return <GenericToolResult success={true} message={message} />;
  },
});
