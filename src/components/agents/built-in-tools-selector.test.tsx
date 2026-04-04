import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { BuiltInToolsSelector } from './built-in-tools-selector';

// Mock the tool registry
vi.mock('@/services/agents/tool-registry', () => ({
  areToolsLoaded: vi.fn(() => true),
  getAvailableToolsForUI: vi.fn(() => [
    { id: 'bashTool', label: 'Bash', ref: {} },
    { id: 'codeSearch', label: 'Code Search', ref: {} },
    { id: 'editFile', label: 'Edit File', ref: {} },
    { id: 'readFile', label: 'Read File', ref: {} },
    { id: 'writeFile', label: 'Write File', ref: {} },
  ]),
  getAvailableToolsForUISync: vi.fn(() => [
    { id: 'bashTool', label: 'Bash', ref: {} },
    { id: 'codeSearch', label: 'Code Search', ref: {} },
    { id: 'editFile', label: 'Edit File', ref: {} },
    { id: 'readFile', label: 'Read File', ref: {} },
    { id: 'writeFile', label: 'Write File', ref: {} },
  ]),
}));

// Mock agent tool access - allow all tools by default
vi.mock('@/services/agents/agent-tool-access', () => ({
  isToolAllowedForAgent: vi.fn(() => true),
}));

describe('BuiltInToolsSelector Component', () => {
  const mockOnToolsChange = vi.fn();

  beforeEach(() => {
    mockOnToolsChange.mockClear();
  });

  it('should render all built-in tools', async () => {
    render(<BuiltInToolsSelector selectedTools={[]} onToolsChange={mockOnToolsChange} />);

    expect(screen.getByText('Built-in Tools')).toBeInTheDocument();
    await waitFor(() => {
      expect(screen.getByText('Bash')).toBeInTheDocument();
      expect(screen.getByText('Code Search')).toBeInTheDocument();
      expect(screen.getByText('Edit File')).toBeInTheDocument();
      expect(screen.getByText('Read File')).toBeInTheDocument();
      expect(screen.getByText('Write File')).toBeInTheDocument();
    });
  });

  it('should display correct selected count when no tools selected', async () => {
    render(<BuiltInToolsSelector selectedTools={[]} onToolsChange={mockOnToolsChange} />);

    await waitFor(() => {
      expect(screen.getByText('0/5 selected')).toBeInTheDocument();
    });
  });

  it('should display correct selected count when some tools selected', async () => {
    render(
      <BuiltInToolsSelector
        selectedTools={['bashTool', 'readFile', 'writeFile']}
        onToolsChange={mockOnToolsChange}
      />
    );

    await waitFor(() => {
      expect(screen.getByText('3/5 selected')).toBeInTheDocument();
    });
  });

  it('should show tools as checked when they are in selectedTools', async () => {
    render(
      <BuiltInToolsSelector
        selectedTools={['bashTool', 'readFile']}
        onToolsChange={mockOnToolsChange}
      />
    );

    await waitFor(() => {
      const checkboxes = screen.getAllByRole('checkbox');
      const bashCheckbox = checkboxes.find((cb) => cb.parentElement?.textContent?.includes('Bash'));
      const readFileCheckbox = checkboxes.find((cb) =>
        cb.parentElement?.textContent?.includes('Read File')
      );
      const editFileCheckbox = checkboxes.find((cb) =>
        cb.parentElement?.textContent?.includes('Edit File')
      );

      expect(bashCheckbox).toBeChecked();
      expect(readFileCheckbox).toBeChecked();
      expect(editFileCheckbox).not.toBeChecked();
    });
  });

  it('should call onToolsChange with added tool when checkbox is checked', async () => {
    render(<BuiltInToolsSelector selectedTools={['bashTool']} onToolsChange={mockOnToolsChange} />);

    await waitFor(() => {
      expect(screen.getByText('Bash')).toBeInTheDocument();
    });

    const checkboxes = screen.getAllByRole('checkbox');
    const readFileCheckbox = checkboxes.find((cb) =>
      cb.parentElement?.textContent?.includes('Read File')
    );

    if (readFileCheckbox) {
      fireEvent.click(readFileCheckbox);
    }

    expect(mockOnToolsChange).toHaveBeenCalledTimes(1);
    expect(mockOnToolsChange).toHaveBeenCalledWith(['bashTool', 'readFile']);
  });

  it('should call onToolsChange with removed tool when checkbox is unchecked', async () => {
    render(
      <BuiltInToolsSelector
        selectedTools={['bashTool', 'readFile', 'writeFile']}
        onToolsChange={mockOnToolsChange}
      />
    );

    await waitFor(() => {
      expect(screen.getByText('Bash')).toBeInTheDocument();
    });

    const checkboxes = screen.getAllByRole('checkbox');
    const readFileCheckbox = checkboxes.find((cb) =>
      cb.parentElement?.textContent?.includes('Read File')
    );

    if (readFileCheckbox) {
      fireEvent.click(readFileCheckbox);
    }

    expect(mockOnToolsChange).toHaveBeenCalledTimes(1);
    expect(mockOnToolsChange).toHaveBeenCalledWith(['bashTool', 'writeFile']);
  });

  it('should display tool IDs', async () => {
    render(<BuiltInToolsSelector selectedTools={[]} onToolsChange={mockOnToolsChange} />);

    await waitFor(() => {
      expect(screen.getByText('ID: bashTool')).toBeInTheDocument();
      expect(screen.getByText('ID: codeSearch')).toBeInTheDocument();
      expect(screen.getByText('ID: editFile')).toBeInTheDocument();
    });
  });

  it('should handle selecting all tools', async () => {
    render(<BuiltInToolsSelector selectedTools={[]} onToolsChange={mockOnToolsChange} />);

    await waitFor(() => {
      expect(screen.getByText('Bash')).toBeInTheDocument();
    });

    const checkboxes = screen.getAllByRole('checkbox');

    // Click first checkbox
    fireEvent.click(checkboxes[0]);

    expect(mockOnToolsChange).toHaveBeenCalledTimes(1);

    // First call should have one tool selected
    const firstCall = mockOnToolsChange.mock.calls[0][0];
    expect(firstCall).toHaveLength(1);
  });

  it('should handle deselecting a tool', async () => {
    render(
      <BuiltInToolsSelector
        selectedTools={['bashTool', 'codeSearch', 'editFile', 'readFile', 'writeFile']}
        onToolsChange={mockOnToolsChange}
      />
    );

    await waitFor(() => {
      expect(screen.getByText('Bash')).toBeInTheDocument();
    });

    const checkboxes = screen.getAllByRole('checkbox');

    // Click first checkbox to uncheck it
    fireEvent.click(checkboxes[0]);

    expect(mockOnToolsChange).toHaveBeenCalledTimes(1);

    // First call should have 4 tools selected (one removed)
    const firstCall = mockOnToolsChange.mock.calls[0][0];
    expect(firstCall).toHaveLength(4);
  });
});
