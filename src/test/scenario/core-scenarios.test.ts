import { describe, it, expect, vi } from 'vitest';
import {
  searchTodoComments,
  readPackageJson,
  findTypeScriptFiles,
  searchFunctionDefinition,
  explainCode,
  analyzeProjectStructure,
  simpleQuestion,
  explainConcept,
  generateFunction,
  refactorCode,
  analyzeError,
  fixBug,
  readAndAnalyzeFile,
  searchAndRead,
  emptyInput,
  veryLongInput,
  specialCharacterInput,
  getCoreScenarios,
  getFileOperationScenarios,
  getEdgeCaseScenarios,
  getScenariosByTag,
} from './scenarios/core-scenarios';
import type { AgentConfig, AgentResponse } from './scenario-builder';

// ============================================
// Test Helpers
// ============================================

function createMockConfig(response: Partial<AgentResponse> = {}): AgentConfig {
  return {
    runAgent: vi.fn().mockResolvedValue({
      output: response.output ?? 'Mock output',
      toolCalls: response.toolCalls ?? [],
    }),
    timeout: 5000,
  };
}

function withToolCall(toolName: string, args: Record<string, unknown> = {}): Partial<AgentResponse> {
  return {
    output: `Using ${toolName}`,
    toolCalls: [{ toolCallId: 'tc-1', toolName, args }],
  };
}

// ============================================
// File Operation Scenarios
// ============================================

describe('File Operation Scenarios', () => {
  describe('searchTodoComments', () => {
    it('should pass when grep is called with TODO pattern', async () => {
      const config = createMockConfig(withToolCall('grep', { pattern: 'TODO' }));

      const result = await searchTodoComments().run(config);

      expect(result.success).toBe(true);
    });

    it('should fail when grep is not called', async () => {
      const config = createMockConfig({ output: 'No search performed' });

      const result = await searchTodoComments().run(config);

      expect(result.success).toBe(false);
    });

    it('should have correct name and description', () => {
      const info = searchTodoComments().getInfo();

      expect(info.name).toBe('Search TODO comments');
      expect(info.description).toContain('TODO');
    });
  });

  describe('readPackageJson', () => {
    it('should pass when readFile is called with package.json', async () => {
      const config = createMockConfig(withToolCall('readFile', { path: 'package.json' }));

      const result = await readPackageJson().run(config);

      expect(result.success).toBe(true);
    });
  });

  describe('findTypeScriptFiles', () => {
    it('should pass when glob is called with .ts pattern', async () => {
      const config = createMockConfig(withToolCall('glob', { pattern: '**/*.ts' }));

      const result = await findTypeScriptFiles().run(config);

      expect(result.success).toBe(true);
    });
  });

  describe('searchFunctionDefinition', () => {
    it('should pass when grep is called', async () => {
      const config = createMockConfig(withToolCall('grep', { pattern: 'function main' }));

      const result = await searchFunctionDefinition('main').run(config);

      expect(result.success).toBe(true);
    });

    it('should include function name in scenario name', () => {
      const info = searchFunctionDefinition('processData').getInfo();

      expect(info.name).toContain('processData');
    });
  });
});

// ============================================
// Code Understanding Scenarios
// ============================================

describe('Code Understanding Scenarios', () => {
  describe('explainCode', () => {
    it('should pass when output is not empty and no file is written', async () => {
      const config = createMockConfig({
        output: 'This code does X, Y, Z',
        toolCalls: [],
      });

      const result = await explainCode().run(config);

      expect(result.success).toBe(true);
    });

    it('should fail if writeFile is called', async () => {
      const config = createMockConfig({
        output: 'Explanation',
        toolCalls: [{ toolCallId: 'tc-1', toolName: 'writeFile', args: {} }],
      });

      const result = await explainCode().run(config);

      expect(result.success).toBe(false);
    });
  });

  describe('analyzeProjectStructure', () => {
    it('should pass when glob is called and output is not empty', async () => {
      const config = createMockConfig({
        output: 'Project structure: src/, tests/, etc.',
        toolCalls: [{ toolCallId: 'tc-1', toolName: 'glob', args: {} }],
      });

      const result = await analyzeProjectStructure().run(config);

      expect(result.success).toBe(true);
    });
  });
});

// ============================================
// Q&A Scenarios
// ============================================

describe('Q&A Scenarios', () => {
  describe('simpleQuestion', () => {
    it('should pass when TypeScript is mentioned without tools', async () => {
      const config = createMockConfig({
        output: 'TypeScript is a typed superset of JavaScript',
        toolCalls: [],
      });

      const result = await simpleQuestion().run(config);

      expect(result.success).toBe(true);
    });

    it('should fail if readFile is called', async () => {
      const config = createMockConfig({
        output: 'TypeScript info',
        toolCalls: [{ toolCallId: 'tc-1', toolName: 'readFile', args: {} }],
      });

      const result = await simpleQuestion().run(config);

      expect(result.success).toBe(false);
    });
  });

  describe('explainConcept', () => {
    it('should pass when concept is mentioned in output', async () => {
      const config = createMockConfig({
        output: 'React hooks are functions that let you use state',
      });

      const result = await explainConcept('React hooks').run(config);

      expect(result.success).toBe(true);
    });

    it('should include concept in scenario name', () => {
      const info = explainConcept('async/await').getInfo();

      expect(info.name).toContain('async/await');
    });
  });
});

// ============================================
// Code Generation Scenarios
// ============================================

describe('Code Generation Scenarios', () => {
  describe('generateFunction', () => {
    it('should pass when output contains function keyword', async () => {
      const config = createMockConfig({
        output: 'function factorial(n) { return n <= 1 ? 1 : n * factorial(n-1); }',
      });

      const result = await generateFunction().run(config);

      expect(result.success).toBe(true);
    });

  });

  describe('refactorCode', () => {
    it('should pass when output is not empty', async () => {
      const config = createMockConfig({
        output: 'Refactored version: ...',
      });

      const result = await refactorCode().run(config);

      expect(result.success).toBe(true);
    });
  });
});

// ============================================
// Error Handling Scenarios
// ============================================

describe('Error Handling Scenarios', () => {
  describe('analyzeError', () => {
    it('should pass when undefined is mentioned', async () => {
      const config = createMockConfig({
        output: 'The error occurs because a property is accessed on undefined',
      });

      const result = await analyzeError().run(config);

      expect(result.success).toBe(true);
    });
  });

  describe('fixBug', () => {
    it('should pass when output is not empty', async () => {
      const config = createMockConfig({
        output: 'Here is the fixed code: ...',
      });

      const result = await fixBug().run(config);

      expect(result.success).toBe(true);
    });
  });
});

// ============================================
// Multi-step Scenarios
// ============================================

describe('Multi-step Scenarios', () => {
  describe('readAndAnalyzeFile', () => {
    it('should pass when file is read and output is not empty', async () => {
      const config = createMockConfig({
        output: 'The file contains configuration for...',
        toolCalls: [{ toolCallId: 'tc-1', toolName: 'readFile', args: { path: 'config.json' } }],
      });

      const result = await readAndAnalyzeFile('config.json').run(config);

      expect(result.success).toBe(true);
    });

    it('should include file path in scenario name', () => {
      const info = readAndAnalyzeFile('src/index.ts').getInfo();

      expect(info.name).toContain('src/index.ts');
    });
  });

  describe('searchAndRead', () => {
    it('should pass when grep then readFile in order', async () => {
      const config = createMockConfig({
        output: 'Found errors in file1.ts',
        toolCalls: [
          { toolCallId: 'tc-1', toolName: 'grep', args: { pattern: 'error' } },
          { toolCallId: 'tc-2', toolName: 'readFile', args: { path: 'file1.ts' } },
        ],
      });

      const result = await searchAndRead().run(config);

      expect(result.success).toBe(true);
    });

    it('should fail when order is wrong', async () => {
      const config = createMockConfig({
        output: 'Results',
        toolCalls: [
          { toolCallId: 'tc-1', toolName: 'readFile', args: {} },
          { toolCallId: 'tc-2', toolName: 'grep', args: {} },
        ],
      });

      const result = await searchAndRead().run(config);

      expect(result.success).toBe(false);
    });
  });
});

// ============================================
// Edge Case Scenarios
// ============================================

describe('Edge Case Scenarios', () => {
  describe('emptyInput', () => {
    it('should pass when agent provides guidance for empty input', async () => {
      const config = createMockConfig({
        output: 'Please provide a question or command',
      });

      const result = await emptyInput().run(config);

      expect(result.success).toBe(true);
    });
  });

  describe('veryLongInput', () => {
    it('should handle very long input', async () => {
      const config = createMockConfig({
        output: 'Processed long input',
      });

      const result = await veryLongInput().run(config);

      expect(result.success).toBe(true);
      expect(config.runAgent).toHaveBeenCalled();
      const callArg = (config.runAgent as ReturnType<typeof vi.fn>).mock.calls[0][0];
      expect(callArg.length).toBe(10000);
    });
  });

  describe('specialCharacterInput', () => {
    it('should handle special characters', async () => {
      const config = createMockConfig({
        output: 'Found code with special patterns',
      });

      const result = await specialCharacterInput().run(config);

      expect(result.success).toBe(true);
    });
  });
});

// ============================================
// Scenario Collections
// ============================================

describe('Scenario Collections', () => {
  describe('getCoreScenarios', () => {
    it('should return array of scenarios', () => {
      const scenarios = getCoreScenarios();

      expect(Array.isArray(scenarios)).toBe(true);
      expect(scenarios.length).toBeGreaterThan(0);
    });

    it('should contain expected scenarios', () => {
      const scenarios = getCoreScenarios();
      const names = scenarios.map((s) => s.getInfo().name);

      expect(names).toContain('Search TODO comments');
      expect(names).toContain('Read package.json');
    });
  });

  describe('getFileOperationScenarios', () => {
    it('should return file operation scenarios', () => {
      const scenarios = getFileOperationScenarios();

      expect(scenarios.length).toBe(4);
    });
  });

  describe('getEdgeCaseScenarios', () => {
    it('should return edge case scenarios', () => {
      const scenarios = getEdgeCaseScenarios();

      expect(scenarios.length).toBe(3);
    });
  });

  describe('getScenariosByTag', () => {
    it('should return scenarios by tag', () => {
      const coreScenarios = getScenariosByTag('core');
      const fileOpsScenarios = getScenariosByTag('file-ops');
      const edgeScenarios = getScenariosByTag('edge');

      expect(coreScenarios.length).toBeGreaterThan(0);
      expect(fileOpsScenarios.length).toBeGreaterThan(0);
      expect(edgeScenarios.length).toBeGreaterThan(0);
    });

    it('should return empty array for unknown tag', () => {
      const scenarios = getScenariosByTag('nonexistent');

      expect(scenarios).toEqual([]);
    });
  });
});
