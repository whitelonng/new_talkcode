import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

// Mock the repository store
vi.mock('@/stores/window-scoped-repository-store', () => ({
  useRepositoryStore: vi.fn(() => null),
}));

import { UnifiedToolResult } from '../components/tools/unified-tool-result';

describe('UnifiedToolResult', () => {
  describe('isError detection', () => {
    it('should show success icon for bash result with success=true', () => {
      const output = {
        success: true,
        command: 'ls -l',
        message: 'Command executed successfully',
        output: 'file1.txt\nfile2.txt',
        error: '', // Empty stderr
        exit_code: 0,
      };

      render(
        <UnifiedToolResult toolName="bashTool" input={{ command: 'ls -l' }} output={output}>
          <div>Result content</div>
        </UnifiedToolResult>
      );

      // Should have the green check icon (success)
      const checkIcon = document.querySelector('.text-green-500');
      expect(checkIcon).toBeTruthy();

      // Should NOT have the red X icon (error)
      const xIcon = document.querySelector('.text-red-500');
      expect(xIcon).toBeFalsy();
    });

    it('should show success icon for idle timeout result (dev server)', () => {
      const output = {
        success: true,
        command: 'bun run dev',
        message: 'Command running in background (idle timeout after 5s). PID: 12345',
        output: 'Next.js running on http://localhost:3000',
        error: '', // No error
        exit_code: -1, // Process still running
        timed_out: false,
        idle_timed_out: true,
        pid: 12345,
      };

      render(
        <UnifiedToolResult toolName="bashTool" input={{ command: 'bun run dev' }} output={output}>
          <div>Result content</div>
        </UnifiedToolResult>
      );

      // Should have the green check icon (success)
      const checkIcon = document.querySelector('.text-green-500');
      expect(checkIcon).toBeTruthy();

      // Should NOT have the red X icon
      const xIcon = document.querySelector('.text-red-500');
      expect(xIcon).toBeFalsy();
    });

    it('should show success icon even when stderr has warnings but success=true', () => {
      const output = {
        success: true,
        command: 'npm run build',
        message: 'Command executed successfully',
        output: 'Build complete',
        error: 'Warning: some deprecation warning', // Has stderr but not an error
        exit_code: 0,
      };

      render(
        <UnifiedToolResult toolName="bashTool" input={{ command: 'npm run build' }} output={output}>
          <div>Result content</div>
        </UnifiedToolResult>
      );

      // Should have the green check icon (success) - stderr warnings don't mean failure
      const checkIcon = document.querySelector('.text-green-500');
      expect(checkIcon).toBeTruthy();
    });

    it('should show error icon for bash result with success=false', () => {
      const output = {
        success: false,
        command: 'cat nonexistent.txt',
        message: 'Command failed with exit code 1',
        output: '',
        error: 'No such file or directory',
        exit_code: 1,
      };

      render(
        <UnifiedToolResult
          toolName="bashTool"
          input={{ command: 'cat nonexistent.txt' }}
          output={output}
        >
          <div>Result content</div>
        </UnifiedToolResult>
      );

      // Should have the red X icon (error)
      const xIcon = document.querySelector('.text-red-500');
      expect(xIcon).toBeTruthy();

      // Should NOT have the green check icon
      const checkIcon = document.querySelector('.text-green-500');
      expect(checkIcon).toBeFalsy();
    });

    it('should show error icon for generic tool with error field', () => {
      const output = {
        error: 'Something went wrong',
      };

      render(
        <UnifiedToolResult toolName="someTool" input={{ param: 'value' }} output={output}>
          <div>Result content</div>
        </UnifiedToolResult>
      );

      // Should have the red X icon (error)
      const xIcon = document.querySelector('.text-red-500');
      expect(xIcon).toBeTruthy();
    });

    it('should show error icon for tool with status=error', () => {
      const output = {
        status: 'error',
        message: 'Operation failed',
      };

      render(
        <UnifiedToolResult toolName="someTool" input={{ param: 'value' }} output={output}>
          <div>Result content</div>
        </UnifiedToolResult>
      );

      // Should have the red X icon (error)
      const xIcon = document.querySelector('.text-red-500');
      expect(xIcon).toBeTruthy();
    });

    it('should use explicit isError prop when provided', () => {
      const output = {
        success: true, // This would normally be success
      };

      render(
        <UnifiedToolResult
          toolName="bashTool"
          input={{ command: 'test' }}
          output={output}
          isError={true} // But we explicitly say it's an error
        >
          <div>Result content</div>
        </UnifiedToolResult>
      );

      // Should use the explicit isError prop
      const xIcon = document.querySelector('.text-red-500');
      expect(xIcon).toBeTruthy();
    });

    it('should show success icon when output has no error indicators', () => {
      const output = {
        result: 'some data',
        count: 5,
      };

      render(
        <UnifiedToolResult toolName="someTool" input={{ param: 'value' }} output={output}>
          <div>Result content</div>
        </UnifiedToolResult>
      );

      // Should have the green check icon (success) - no error indicators
      const checkIcon = document.querySelector('.text-green-500');
      expect(checkIcon).toBeTruthy();
    });
  });
});
