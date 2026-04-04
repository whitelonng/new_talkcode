import { describe, expect, it } from 'vitest';

describe('Marketplace Agent Editor - Tools Parsing', () => {
  it('should parse tools_config JSON string correctly', () => {
    const mockAgent = {
      id: 'test-agent',
      name: 'Test Agent',
      tools_config: '{"bashTool":{},"readFile":{},"codeSearch":{}}',
    };

    // Simulate the parsing logic used in marketplace-page.tsx
    const parsedTools = mockAgent.tools_config
      ? (() => {
          try {
            return JSON.parse(mockAgent.tools_config);
          } catch (e) {
            console.error('Failed to parse tools_config:', e);
            return {};
          }
        })()
      : {};

    expect(parsedTools).toEqual({
      bashTool: {},
      readFile: {},
      codeSearch: {},
    });
    expect(Object.keys(parsedTools)).toHaveLength(3);
    expect(Object.keys(parsedTools)).toContain('bashTool');
    expect(Object.keys(parsedTools)).toContain('readFile');
    expect(Object.keys(parsedTools)).toContain('codeSearch');
  });

  it('should return empty object when tools_config is null', () => {
    const mockAgent = {
      id: 'test-agent',
      name: 'Test Agent',
      tools_config: null,
    };

    const parsedTools = mockAgent.tools_config
      ? (() => {
          try {
            return JSON.parse(mockAgent.tools_config);
          } catch (_e) {
            return {};
          }
        })()
      : {};

    expect(parsedTools).toEqual({});
    expect(Object.keys(parsedTools)).toHaveLength(0);
  });

  it('should return empty object when tools_config is empty string', () => {
    const mockAgent = {
      id: 'test-agent',
      name: 'Test Agent',
      tools_config: '',
    };

    const parsedTools = mockAgent.tools_config
      ? (() => {
          try {
            return JSON.parse(mockAgent.tools_config);
          } catch (_e) {
            return {};
          }
        })()
      : {};

    expect(parsedTools).toEqual({});
  });

  it('should handle invalid JSON gracefully', () => {
    const mockAgent = {
      id: 'test-agent',
      name: 'Test Agent',
      tools_config: 'invalid json {',
    };

    const parsedTools = mockAgent.tools_config
      ? (() => {
          try {
            return JSON.parse(mockAgent.tools_config);
          } catch (_e) {
            return {};
          }
        })()
      : {};

    expect(parsedTools).toEqual({});
    expect(Object.keys(parsedTools)).toHaveLength(0);
  });

  it('should correctly extract tool IDs from parsed tools', () => {
    const mockAgent = {
      id: 'test-agent',
      name: 'Test Agent',
      tools_config:
        '{"bashTool":{"description":"Run bash commands"},"readFile":{"description":"Read files"},"writeFile":{}}',
    };

    const parsedTools = mockAgent.tools_config
      ? (() => {
          try {
            return JSON.parse(mockAgent.tools_config);
          } catch (_e) {
            return {};
          }
        })()
      : {};

    // This simulates what agent-editor-dialog.tsx does: Object.keys(agent.tools ?? {})
    const selectedTools = Object.keys(parsedTools);

    expect(selectedTools).toHaveLength(3);
    expect(selectedTools).toEqual(['bashTool', 'readFile', 'writeFile']);
  });
});

describe('Agent Marketplace - Local Search Filtering', () => {
  const mockAgents = [
    {
      id: 'mysql-agent',
      name: 'MySQL Expert',
      description: 'Expert in MySQL database queries',
      created_at: '2024-01-01T00:00:00Z',
    },
    {
      id: 'postgres-agent',
      name: 'PostgreSQL Expert',
      description: 'Expert in PostgreSQL database',
      created_at: '2024-01-02T00:00:00Z',
    },
    {
      id: 'coding-agent',
      name: 'Code Assistant',
      description: 'General coding helper',
      created_at: '2024-01-03T00:00:00Z',
    },
  ];

  // Simulate the filtering logic from agent-marketplace-page.tsx
  function filterAgents(
    agents: typeof mockAgents,
    searchQuery: string,
    sortBy: string
  ): typeof mockAgents {
    let result = [...agents];

    // Apply search filter
    if (searchQuery) {
      const searchLower = searchQuery.toLowerCase();
      result = result.filter(
        (agent) =>
          agent.name.toLowerCase().includes(searchLower) ||
          agent.description?.toLowerCase().includes(searchLower) ||
          agent.id.toLowerCase().includes(searchLower)
      );
    }

    // Apply sorting
    switch (sortBy) {
      case 'name':
        result.sort((a, b) => a.name.localeCompare(b.name));
        break;
      case 'recent':
        result.sort((a, b) => {
          const aTime = a.created_at ? new Date(a.created_at).getTime() : 0;
          const bTime = b.created_at ? new Date(b.created_at).getTime() : 0;
          return bTime - aTime;
        });
        break;
      default:
        break;
    }

    return result;
  }

  describe('Search filtering', () => {
    it('should filter agents by name', () => {
      const result = filterAgents(mockAgents, 'mysql', 'popular');
      expect(result).toHaveLength(1);
      expect(result[0].id).toBe('mysql-agent');
    });

    it('should filter agents by description', () => {
      const result = filterAgents(mockAgents, 'database', 'popular');
      expect(result).toHaveLength(2);
      expect(result.map((a) => a.id)).toEqual(['mysql-agent', 'postgres-agent']);
    });

    it('should filter agents by id', () => {
      const result = filterAgents(mockAgents, 'coding-agent', 'popular');
      expect(result).toHaveLength(1);
      expect(result[0].id).toBe('coding-agent');
    });

    it('should return empty array when no agents match', () => {
      const result = filterAgents(mockAgents, 'nonexistent', 'popular');
      expect(result).toHaveLength(0);
    });

    it('should be case insensitive', () => {
      const result = filterAgents(mockAgents, 'MYSQL', 'popular');
      expect(result).toHaveLength(1);
      expect(result[0].id).toBe('mysql-agent');
    });

    it('should return all agents when search query is empty', () => {
      const result = filterAgents(mockAgents, '', 'popular');
      expect(result).toHaveLength(3);
    });
  });

  describe('Sorting', () => {
    it('should sort by name alphabetically', () => {
      const result = filterAgents(mockAgents, '', 'name');
      expect(result[0].name).toBe('Code Assistant');
      expect(result[1].name).toBe('MySQL Expert');
      expect(result[2].name).toBe('PostgreSQL Expert');
    });

    it('should sort by recent (newest first)', () => {
      const result = filterAgents(mockAgents, '', 'recent');
      expect(result[0].id).toBe('coding-agent'); // 2024-01-03
      expect(result[1].id).toBe('postgres-agent'); // 2024-01-02
      expect(result[2].id).toBe('mysql-agent'); // 2024-01-01
    });

    it('should maintain original order for popular/downloads/installs', () => {
      const result = filterAgents(mockAgents, '', 'popular');
      expect(result).toEqual(mockAgents);
    });
  });

  describe('Combined search and sort', () => {
    it('should filter then sort results', () => {
      const result = filterAgents(mockAgents, 'expert', 'name');
      expect(result).toHaveLength(2);
      // Should be sorted by name after filtering
      expect(result[0].name).toBe('MySQL Expert');
      expect(result[1].name).toBe('PostgreSQL Expert');
    });
  });
});
