/**
 * Tests for FileAgentImporter
 */

import { beforeEach, describe, expect, it, vi } from 'vitest';
import { FileAgentImporter } from './file-agent-importer';

vi.mock('@tauri-apps/api/path', () => ({
	homeDir: vi.fn().mockResolvedValue('/mock/home'),
	join: vi.fn((...parts: string[]) => Promise.resolve(parts.join('/'))),
	normalize: vi.fn((path: string) => Promise.resolve(path)),
}));

vi.mock('@tauri-apps/plugin-fs', () => ({
	exists: vi.fn(),
	readDir: vi.fn(),
	readTextFile: vi.fn(),
}));

vi.mock('@/services/workspace-root-service', () => ({
	getEffectiveWorkspaceRoot: vi.fn().mockResolvedValue('/mock/workspace'),
}));

import { exists, readDir, readTextFile } from '@tauri-apps/plugin-fs';

describe('FileAgentImporter', () => {
	beforeEach(() => {
		vi.clearAllMocks();
	});

	it('discovers personal and project agent directories', async () => {
		vi.mocked(exists).mockResolvedValue(true);

		const dirs = await FileAgentImporter.getClaudeAgentDirs();

		expect(dirs).toEqual([
			{ path: '/mock/home/.claude/agents', type: 'personal' },
			{ path: '/mock/workspace/.claude/agents', type: 'project' },
			{ path: '/mock/workspace/.talkcody/agents', type: 'project' },
		]);
	});

	it('imports markdown agents from directories', async () => {
		vi.mocked(exists).mockResolvedValue(true);
		vi.mocked(readDir).mockImplementation(async (path: string) => {
			if (path.endsWith('.claude/agents')) {
				return [
					{ name: 'reviewer.md', isFile: true, isDirectory: false, isSymlink: false },
					{ name: 'notes.txt', isFile: true, isDirectory: false, isSymlink: false },
				];
			}
			return [];
		});
		vi.mocked(readTextFile).mockResolvedValue(`---
name: file-reviewer
description: From file
tools: Read
model: sonnet
---

You are a file-based agent.`);

		const result = await FileAgentImporter.importAgentsFromDirectories();

		expect(result.agents).toHaveLength(1);
		expect(result.agents[0]?.name).toBe('file-reviewer');
		expect(result.agents[0]?.category).toBe('local');
	});

	it('accepts file entries without boolean isFile flag', async () => {
		vi.mocked(exists).mockResolvedValue(true);
		vi.mocked(readDir).mockImplementation(async (path: string) => {
			if (path.endsWith('.talkcody/agents')) {
				return [
					{ name: 'buyer.md', isFile: () => true, isDirectory: () => false },
					{ name: 'ignored.txt', isFile: () => true, isDirectory: () => false },
				];
			}
			return [];
		});
		vi.mocked(readTextFile).mockResolvedValue(`---
name: china-options-buyer
description: From file
---

You are a file-based agent.`);

		const result = await FileAgentImporter.importAgentsFromDirectories();

		expect(result.agents).toHaveLength(1);
		expect(result.agents[0]?.id).toBe('china-options-buyer');
		expect(result.errors).toHaveLength(0);
	});
});
