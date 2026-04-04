import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { buildCommandString, getLoginShellWrapper } from './tauri-persistent-transport';

// Mock @tauri-apps/plugin-os
vi.mock('@tauri-apps/plugin-os', () => ({
  platform: vi.fn(),
}));

// Import the mocked module
import { platform } from '@tauri-apps/plugin-os';
const mockPlatform = vi.mocked(platform);

describe('buildCommandString', () => {
  it('should return command as-is when no args provided', () => {
    expect(buildCommandString('npx')).toBe('npx');
    expect(buildCommandString('npx', [])).toBe('npx');
    expect(buildCommandString('npx', undefined)).toBe('npx');
  });

  it('should properly join command and args', () => {
    expect(buildCommandString('npx', ['@anthropic-ai/claude-code'])).toBe(
      'npx @anthropic-ai/claude-code'
    );
    expect(buildCommandString('npx', ['-y', 'some-package'])).toBe('npx -y some-package');
  });

  it('should escape args with spaces', () => {
    expect(buildCommandString('npx', ['arg with space'])).toBe('npx "arg with space"');
    expect(buildCommandString('npx', ['normal', 'has space', 'alsonormal'])).toBe(
      'npx normal "has space" alsonormal'
    );
  });

  it('should escape args with double quotes', () => {
    expect(buildCommandString('npx', ['arg with "quote"'])).toBe('npx "arg with \\"quote\\""');
  });

  it('should escape args with single quotes', () => {
    expect(buildCommandString('npx', ["arg with 'quote'"])).toBe("npx \"arg with 'quote'\"");
  });

  it('should escape args with dollar signs (shell variables)', () => {
    expect(buildCommandString('npx', ['$HOME'])).toBe('npx "$HOME"');
    expect(buildCommandString('npx', ['path=$HOME/dir'])).toBe('npx "path=$HOME/dir"');
  });

  it('should handle complex args with multiple special characters', () => {
    expect(buildCommandString('npx', ['arg with "quotes" and $vars'])).toBe(
      'npx "arg with \\"quotes\\" and $vars"'
    );
  });

  it('should handle real MCP server command examples', () => {
    // Chrome DevTools MCP
    expect(buildCommandString('npx', ['chrome-devtools-mcp@latest', '--isolated'])).toBe(
      'npx chrome-devtools-mcp@latest --isolated'
    );

    // Sequential thinking MCP
    expect(
      buildCommandString('npx', ['-y', '@modelcontextprotocol/server-sequential-thinking'])
    ).toBe('npx -y @modelcontextprotocol/server-sequential-thinking');
  });
});

describe('getLoginShellWrapper', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.resetAllMocks();
  });

  it('should return login-shell-zsh config on macOS', async () => {
    mockPlatform.mockResolvedValue('macos');
    const result = await getLoginShellWrapper();
    expect(result).toEqual({
      name: 'login-shell-zsh',
      args: ['-l', '-c'],
    });
  });

  it('should return login-shell-bash config on Linux', async () => {
    mockPlatform.mockResolvedValue('linux');
    const result = await getLoginShellWrapper();
    expect(result).toEqual({
      name: 'login-shell-bash',
      args: ['-l', '-c'],
    });
  });

  it('should return login-shell-cmd config on Windows', async () => {
    mockPlatform.mockResolvedValue('windows');
    const result = await getLoginShellWrapper();
    expect(result).toEqual({
      name: 'login-shell-cmd',
      args: ['/C'],
    });
  });

  it('should return login-shell-bash config for unknown platforms (fallback)', async () => {
    mockPlatform.mockResolvedValue('freebsd' as ReturnType<typeof platform>);
    const result = await getLoginShellWrapper();
    expect(result).toEqual({
      name: 'login-shell-bash',
      args: ['-l', '-c'],
    });
  });
});
