/**
 * Core Test Scenario Presets
 * Covers common TalkCody user interaction patterns
 */

import {
  outputScenario,
  type ScenarioBuilder,
  scenario,
  toolCallScenario,
} from '../scenario-builder';

// ============================================
// File Operation Scenarios
// ============================================

/**
 * Search TODO comments
 */
export function searchTodoComments(): ScenarioBuilder {
  return scenario('Search TODO comments')
    .withDescription('User requests searching for TODO comments in the project')
    .user('Find all files containing TODO')
    .agent()
    .assertToolCalled('grep', { pattern: 'TODO' })
    .assertOutputNotEmpty();
}

/**
 * Read package.json
 */
export function readPackageJson(): ScenarioBuilder {
  return toolCallScenario('Read the package.json file', 'readFile', {
    path: 'package.json',
  }).withName('Read package.json');
}

/**
 * Find specific type files
 */
export function findTypeScriptFiles(): ScenarioBuilder {
  return scenario('Find TypeScript files')
    .withDescription('User requests finding TypeScript files')
    .user('List all TypeScript files')
    .agent()
    .assertToolCalled('glob', { pattern: '**/*.ts' });
}

/**
 * Search function definition
 */
export function searchFunctionDefinition(functionName: string): ScenarioBuilder {
  return scenario(`Search function: ${functionName}`)
    .user(`Find the definition of ${functionName} function`)
    .agent()
    .assertToolCalled('grep');
}

// ============================================
// Code Understanding Scenarios
// ============================================

/**
 * Explain code
 */
export function explainCode(): ScenarioBuilder {
  return scenario('Explain code')
    .withDescription('User requests code explanation')
    .user('Explain what this code does')
    .agent()
    .assertOutputNotEmpty()
    .assertToolNotCalled('writeFile'); // Should not modify files
}

/**
 * Analyze project structure
 */
export function analyzeProjectStructure(): ScenarioBuilder {
  return scenario('Analyze project structure')
    .user('Analyze the directory structure of this project')
    .agent()
    .assertToolCalled('glob')
    .assertOutputNotEmpty();
}

// ============================================
// Q&A Scenarios (no tools needed)
// ============================================

/**
 * Simple Q&A - no tool calls needed
 */
export function simpleQuestion(): ScenarioBuilder {
  return scenario('Simple Q&A')
    .withDescription('Simple questions do not require tool calls')
    .user('What is TypeScript?')
    .agent()
    .assertOutputContains('TypeScript')
    .assertToolNotCalled('readFile')
    .assertToolNotCalled('writeFile');
}

/**
 * Concept explanation
 */
export function explainConcept(concept: string): ScenarioBuilder {
  return outputScenario(`Explain ${concept}`, concept).withName(`Explain: ${concept}`);
}

// ============================================
// Code Generation Scenarios
// ============================================

/**
 * Generate function
 */
export function generateFunction(): ScenarioBuilder {
  return scenario('Generate function')
    .user('Write a function to calculate factorial')
    .agent()
    .assertOutputContains('function')
    .assertOutputMatches(/factorial/i);
}

/**
 * Code refactoring
 */
export function refactorCode(): ScenarioBuilder {
  return scenario('Refactor code')
    .user('Refactor this code to improve readability')
    .agent()
    .assertOutputNotEmpty();
}

// ============================================
// Error Handling Scenarios
// ============================================

/**
 * Analyze error
 */
export function analyzeError(): ScenarioBuilder {
  return scenario('Analyze error')
    .user('Help me analyze this error: TypeError: Cannot read property of undefined')
    .agent()
    .assertOutputContains('undefined')
    .assertOutputNotEmpty();
}

/**
 * Fix Bug
 */
export function fixBug(): ScenarioBuilder {
  return scenario('Fix bug')
    .user('This function has a bug, help me fix it')
    .agent()
    .assertOutputNotEmpty();
}

// ============================================
// Multi-step Scenarios
// ============================================

/**
 * Read and analyze file
 */
export function readAndAnalyzeFile(filePath: string): ScenarioBuilder {
  return scenario(`Read and analyze: ${filePath}`)
    .user(`Read ${filePath} and analyze its content`)
    .agent()
    .assertToolCalled('readFile', { path: filePath })
    .assertOutputNotEmpty();
}

/**
 * Search and read
 */
export function searchAndRead(): ScenarioBuilder {
  return scenario('Search and read')
    .withDescription('Search first then read files')
    .user('Find all files containing "error", then read the first one')
    .agent()
    .assertToolCalled('grep')
    .assertToolOrder('grep', 'readFile');
}

// ============================================
// Edge Case Scenarios
// ============================================

/**
 * Empty input
 */
export function emptyInput(): ScenarioBuilder {
  return scenario('Empty input').user('').agent().assertOutputNotEmpty(); // Should have a friendly prompt
}

/**
 * Very long input
 */
export function veryLongInput(): ScenarioBuilder {
  const longText = 'A'.repeat(10000);
  return scenario('Very long input').user(longText).agent().assertOutputNotEmpty();
}

/**
 * Special character input
 */
export function specialCharacterInput(): ScenarioBuilder {
  return scenario('Special characters')
    .user('Search for code containing `${var}` and \\n')
    .agent()
    .assertOutputNotEmpty();
}

// ============================================
// Scenario Combinations
// ============================================

/**
 * Get core scenario list
 * For batch testing
 */
export function getCoreScenarios(): ScenarioBuilder[] {
  return [
    searchTodoComments(),
    readPackageJson(),
    findTypeScriptFiles(),
    simpleQuestion(),
    generateFunction(),
    analyzeError(),
  ];
}

/**
 * Get file operation scenario list
 */
export function getFileOperationScenarios(): ScenarioBuilder[] {
  return [
    searchTodoComments(),
    readPackageJson(),
    findTypeScriptFiles(),
    searchFunctionDefinition('main'),
  ];
}

/**
 * Get edge case scenario list
 */
export function getEdgeCaseScenarios(): ScenarioBuilder[] {
  return [emptyInput(), veryLongInput(), specialCharacterInput()];
}

/**
 * Get scenarios by tag
 */
export function getScenariosByTag(tag: string): ScenarioBuilder[] {
  const taggedScenarios: Record<string, () => ScenarioBuilder[]> = {
    'file-ops': getFileOperationScenarios,
    core: getCoreScenarios,
    edge: getEdgeCaseScenarios,
  };

  const getter = taggedScenarios[tag];
  return getter ? getter() : [];
}
