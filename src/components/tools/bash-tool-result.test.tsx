import { describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import React from 'react';
import { BashToolResult } from './bash-tool-result';

vi.mock('@/hooks/use-locale', () => ({
  useTranslation: () => ({
    ToolMessages: {
      Bash: {
        outputSaved: (path: string) => `Full stdout saved to: ${path}`,
        errorSaved: (path: string) => `Full stderr saved to: ${path}`,
      },
    },
  }),
}));

describe('BashToolResult', () => {
  describe('basic rendering', () => {
    it('should display output when provided', () => {
      const { container } = render(
        <BashToolResult
          output="Command completed"
          success={true}
        />
      );

      // When output is provided, it should be displayed
      const preElement = container.querySelector('pre');
      expect(preElement?.textContent).toContain('Command completed');
    });

    it('should display error when provided', () => {
      const { container } = render(
        <BashToolResult
          error="Error occurred"
          success={false}
        />
      );

      const preElement = container.querySelector('pre');
      expect(preElement?.textContent).toContain('Error occurred');
    });

    it('should display output content on multiple lines', () => {
      render(
        <BashToolResult
          output="Line 1\nLine 2\nLine 3"
          success={true}
        />
      );

      expect(screen.getByText((content) => content.includes('Line 1'))).toBeInTheDocument();
      expect(screen.getByText((content) => content.includes('Line 2'))).toBeInTheDocument();
      expect(screen.getByText((content) => content.includes('Line 3'))).toBeInTheDocument();
    });

    it('should prefer output over error for display', () => {
      render(
        <BashToolResult
          output="Standard output"
          error="Error output"
          success={true}
        />
      );

      const preElement = document.querySelector('pre');
      expect(preElement?.textContent).toContain('Standard output');
    });

    it('should show default message when no output or error', () => {
      const { container } = render(
        <BashToolResult
          success={true}
        />
      );

      const preElement = container.querySelector('pre');
      expect(preElement?.textContent).toContain('Command executed successfully');
    });

    it('should show failure message when no output or error on failure', () => {
      const { container } = render(
        <BashToolResult
          success={false}
        />
      );

      const preElement = container.querySelector('pre');
      expect(preElement?.textContent).toContain('Command execution failed');
    });
  });

  describe('idle timeout handling', () => {
    it('should show running in background message when idle timed out', () => {
      const { container } = render(
        <BashToolResult
          output="Server started on port 3000"
          success={true}
          idleTimedOut={true}
          pid={12345}
        />
      );

      expect(container.textContent).toContain('Process running in background');
      expect(container.textContent).toContain('12345');
    });
  });

  describe('max timeout handling', () => {
    it('should show timed out message', () => {
      const { container } = render(
        <BashToolResult
          output="Partial output"
          success={true}
          timedOut={true}
          pid={67890}
        />
      );

      expect(container.textContent).toContain('Command timed out');
      expect(container.textContent).toContain('67890');
    });
  });

  describe('exit code display', () => {
    it('should not show exit code in output (exit code is metadata)', () => {
      const { container } = render(
        <BashToolResult
          success={false}
        />
      );

      // Exit code is not displayed in the output, only as metadata
      const preElement = container.querySelector('pre');
      expect(preElement?.textContent).not.toContain('Exit code:');
    });
  });

  describe('output display styling', () => {
    it('should display output in a pre element', () => {
      const { container } = render(
        <BashToolResult
          output="Line 1\nLine 2\nLine 3"
          success={true}
        />
      );

      const preElement = container.querySelector('pre');
      expect(preElement).toBeInTheDocument();
    });

    it('should preserve whitespace in output', () => {
      const { container } = render(
        <BashToolResult
          output="  indented line\n    double indented"
          success={true}
        />
      );

      const preElement = container.querySelector('pre');
      expect(preElement?.textContent).toContain('indented line');
      expect(preElement?.textContent).toContain('double indented');
    });
  });

  describe('edge cases', () => {
    it('should handle undefined output gracefully', () => {
      const { container } = render(
        <BashToolResult
          success={true}
        />
      );

      // Should show default success message
      const preElement = container.querySelector('pre');
      expect(preElement?.textContent).toContain('Command executed successfully');
    });

    it('should handle empty output string', () => {
      const { container } = render(
        <BashToolResult
          output=""
          success={true}
        />
      );

      // Empty string is falsy, should show default message
      const preElement = container.querySelector('pre');
      expect(preElement?.textContent).toContain('Command executed successfully');
    });

  });

  describe('large output message', () => {
    it('should display truncated message in output', () => {
      const { container } = render(
        <BashToolResult
          output="... (500 lines truncated)\nLast line of output"
          success={true}
        />
      );

      const preElement = container.querySelector('pre');
      expect(preElement?.textContent).toContain('500 lines truncated');
      expect(preElement?.textContent).toContain('Last line of output');
    });
  });

  describe('output file path message', () => {
    it('should render output file path when provided', () => {
      render(
        <BashToolResult
          output="short output"
          outputFilePath="/test/root/.talkcody/output/task-123/tool-456_stdout.log"
          success={true}
        />
      );

      expect(screen.getByText((content) => content.includes('Full stdout saved to'))).toBeInTheDocument();
    });
  });

  describe('output notification styling', () => {
    it('should have terminal icon in output section', () => {
      const { container } = render(
        <BashToolResult
          output="test"
          success={true}
        />
      );

      const terminalIcon = container.querySelector('.lucide-terminal');
      expect(terminalIcon).toBeInTheDocument();
    });

    it('should have labeled output section', () => {
      const { container } = render(
        <BashToolResult
          output="test"
          success={true}
        />
      );

      expect(container.textContent).toContain('Output:');
    });
  });
});
