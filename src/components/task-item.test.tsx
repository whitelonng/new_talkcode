import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import mockSettingsStore from '@/test/mocks/settings-store';
import { TaskItem } from './task-item';
import type { Task } from '@/services/database-service';

vi.mock('@/stores/settings-store', () => mockSettingsStore);

// Mock the utilities
vi.mock('@/lib/utils', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/lib/utils')>();
  return {
    ...actual,
    formatDate: (date: string) => date,
  };
});

describe('TaskItem - No Nested Buttons Regression Test', () => {
  const mockTask: Task = {
    id: 'test-id-1',
    title: 'Test Task',
    updated_at: '2024-01-01T00:00:00.000Z',
    created_at: '2024-01-01T00:00:00.000Z',
    message_count: 5,
    request_count: 0,
    cost: 0.05,
    system_prompt: '',
    agent_type: 'general',
    user_id: 'test-user',
  };

  const mockCallbacks = {
    onSelect: vi.fn(),
    onDelete: vi.fn(),
    onStartEditing: vi.fn(),
    onSaveEdit: vi.fn(),
    onCancelEdit: vi.fn(),
    onTitleChange: vi.fn(),
    onMultiSelectEnabledChange: vi.fn(),
    onMultiSelectToggle: vi.fn(),
    onDeleteSelected: vi.fn(),
    onClearSelection: vi.fn(),
    onSelectAll: vi.fn(),
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should not have nested button elements in normal state', () => {
    const { container } = render(
      <TaskItem
        task={mockTask}
        isSelected={false}
        isEditing={false}
        editingTitle=""
        {...mockCallbacks}
      />
    );

    // Check that there are no nested button elements
    const buttons = container.querySelectorAll('button');
    buttons.forEach((button) => {
      const nestedButtons = button.querySelectorAll('button');
      expect(nestedButtons.length).toBe(0);
    });
  });

  it('should use div for the main container with title attribute', () => {
    const { container } = render(
      <TaskItem
        task={mockTask}
        isSelected={false}
        isEditing={false}
        editingTitle=""
        {...mockCallbacks}
      />
    );

    // The main container should be a div with title attribute
    const mainContainer = container.querySelector('[title="Test Task"]');
    expect(mainContainer?.tagName).toBe('DIV');
  });

  it('should render dropdown menu trigger as a button without nesting', () => {
    const { container } = render(
      <TaskItem
        task={mockTask}
        isSelected={false}
        isEditing={false}
        editingTitle=""
        {...mockCallbacks}
      />
    );

    // Verify dropdown menu trigger exists
    const dropdownTrigger = container.querySelector('[data-slot="dropdown-menu-trigger"]');
    expect(dropdownTrigger).toBeDefined();
    expect(dropdownTrigger?.tagName).toBe('BUTTON');
  });

  it('should call onSelect when task is clicked', () => {
    const { container } = render(
      <TaskItem
        task={mockTask}
        isSelected={false}
        isEditing={false}
        editingTitle=""
        {...mockCallbacks}
      />
    );

    const mainContainer = container.querySelector('[title="Test Task"]');
    if (mainContainer) {
      fireEvent.click(mainContainer);
    }

    expect(mockCallbacks.onSelect).toHaveBeenCalledWith(mockTask.id);
  });

  it('should handle keyboard navigation with Enter key', () => {
    const { container } = render(
      <TaskItem
        task={mockTask}
        isSelected={false}
        isEditing={false}
        editingTitle=""
        {...mockCallbacks}
      />
    );

    const mainContainer = container.querySelector('[title="Test Task"]');
    if (mainContainer) {
      fireEvent.keyDown(mainContainer, { key: 'Enter' });
    }

    expect(mockCallbacks.onSelect).toHaveBeenCalledWith(mockTask.id);
  });

  it('should handle keyboard navigation with Space key', () => {
    const { container } = render(
      <TaskItem
        task={mockTask}
        isSelected={false}
        isEditing={false}
        editingTitle=""
        {...mockCallbacks}
      />
    );

    const mainContainer = container.querySelector('[title="Test Task"]');
    if (mainContainer) {
      fireEvent.keyDown(mainContainer, { key: ' ' });
    }

    expect(mockCallbacks.onSelect).toHaveBeenCalledWith(mockTask.id);
  });

  it('should have proper accessibility attributes', () => {
    const { container } = render(
      <TaskItem
        task={mockTask}
        isSelected={false}
        isEditing={false}
        editingTitle=""
        {...mockCallbacks}
      />
    );

    const mainContainer = container.querySelector('[title="Test Task"]');
    expect(mainContainer).toBeTruthy();
    expect(mainContainer?.getAttribute('title')).toBe(mockTask.title);
  });

  it('should display task information correctly', () => {
    render(
      <TaskItem
        task={mockTask}
        isSelected={false}
        isEditing={false}
        editingTitle=""
        {...mockCallbacks}
      />
    );

    expect(screen.getByText(mockTask.title)).toBeDefined();
    expect(screen.getByText(mockTask.message_count.toString())).toBeDefined();
  });

  it('should apply selected styles when isSelected is true', () => {
    const { container } = render(
      <TaskItem
        task={mockTask}
        isSelected={true}
        isEditing={false}
        editingTitle=""
        {...mockCallbacks}
      />
    );

    const mainContainer = container.querySelector('[title="Test Task"]');
    expect(mainContainer?.className).toContain('border-blue-200');
  });

  it('should not have nested buttons in editing state', () => {
    const { container } = render(
      <TaskItem
        task={mockTask}
        isSelected={false}
        isEditing={true}
        editingTitle="Editing title"
        {...mockCallbacks}
      />
    );

    // The editing container should be a div
    const divs = container.querySelectorAll('div');
    expect(divs.length).toBeGreaterThan(0);

    // Check that there are no nested button elements
    const buttons = container.querySelectorAll('button');
    buttons.forEach((button) => {
      const nestedButtons = button.querySelectorAll('button');
      expect(nestedButtons.length).toBe(0);
    });
  });

  it('should render Save and Cancel buttons in editing state', () => {
    render(
      <TaskItem
        task={mockTask}
        isSelected={false}
        isEditing={true}
        editingTitle="Editing title"
        {...mockCallbacks}
      />
    );

    expect(screen.getByText('Save')).toBeDefined();
    expect(screen.getByText('Cancel')).toBeDefined();
  });

  it('should call onSaveEdit when Save button is clicked', () => {
    render(
      <TaskItem
        task={mockTask}
        isSelected={false}
        isEditing={true}
        editingTitle="Editing title"
        {...mockCallbacks}
      />
    );

    const saveButton = screen.getByText('Save');
    fireEvent.click(saveButton);

    expect(mockCallbacks.onSaveEdit).toHaveBeenCalledWith(mockTask.id);
  });

  it('should call onDelete when context menu delete is clicked', async () => {
    render(
      <TaskItem
        task={mockTask}
        isSelected={false}
        isEditing={false}
        editingTitle=""
        {...mockCallbacks}
      />
    );

    const trigger = screen.getByText('Test Task');
    fireEvent.contextMenu(trigger);

    const deleteItem = await screen.findByText('Delete');
    fireEvent.click(deleteItem);

    expect(mockCallbacks.onDelete).toHaveBeenCalledWith(mockTask.id);
  });

  it('should show checkbox in multi-select mode and toggle selection', () => {
    render(
      <TaskItem
        task={mockTask}
        isSelected={false}
        isEditing={false}
        editingTitle=""
        isMultiSelectEnabled={true}
        isMultiSelected={false}
        selectedCount={0}
        {...mockCallbacks}
      />
    );

    // Checkbox should be present
    const checkbox = screen.getByLabelText('Select task');
    fireEvent.click(checkbox);

    expect(mockCallbacks.onMultiSelectToggle).toHaveBeenCalledWith(mockTask.id, true);
  });

  it('should show cancel multi-select in context menu when multi-select is enabled', async () => {
    render(
      <TaskItem
        task={mockTask}
        isSelected={false}
        isEditing={false}
        editingTitle=""
        isMultiSelectEnabled={true}
        {...mockCallbacks}
      />
    );

    const mainContainer = document.querySelector('[title="Test Task"]');
    if (mainContainer) {
      fireEvent.contextMenu(mainContainer);
    }

    expect(await screen.findByText('Cancel multi-select')).toBeDefined();
  });

  it('should call clear selection and disable multi-select when cancel multi-select is clicked', async () => {
    render(
      <TaskItem
        task={mockTask}
        isSelected={false}
        isEditing={false}
        editingTitle=""
        isMultiSelectEnabled={true}
        {...mockCallbacks}
      />
    );

    const mainContainer = document.querySelector('[title="Test Task"]');
    if (mainContainer) {
      fireEvent.contextMenu(mainContainer);
    }

    const cancelMultiSelect = await screen.findByText('Cancel multi-select');
    fireEvent.click(cancelMultiSelect);

    expect(mockCallbacks.onClearSelection).toHaveBeenCalled();
    expect(mockCallbacks.onMultiSelectEnabledChange).toHaveBeenCalledWith(false);
  });

  it('should display default title when title is empty', () => {
    const taskWithEmptyTitle: Conversation = {
      ...mockTask,
      title: '',
    };

    render(
      <TaskItem
        task={taskWithEmptyTitle}
        isSelected={false}
        isEditing={false}
        editingTitle=""
        {...mockCallbacks}
      />
    );

    expect(screen.getByText('New Task')).toBeDefined();
  });

  it('should display default title when title is only whitespace', () => {
    const taskWithWhitespaceTitle: Conversation = {
      ...mockTask,
      title: '   ',
    };

    render(
      <TaskItem
        task={taskWithWhitespaceTitle}
        isSelected={false}
        isEditing={false}
        editingTitle=""
        {...mockCallbacks}
      />
    );

    expect(screen.getByText('New Task')).toBeDefined();
  });

  it('should render without causing React hydration errors', () => {
    const consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

    render(
      <TaskItem
        task={mockTask}
        isSelected={false}
        isEditing={false}
        editingTitle=""
        {...mockCallbacks}
      />
    );

    // Verify no nested button errors
    expect(consoleErrorSpy).not.toHaveBeenCalledWith(
      expect.stringContaining('cannot be a descendant of')
    );
    expect(consoleErrorSpy).not.toHaveBeenCalledWith(
      expect.stringContaining('cannot contain a nested')
    );

    consoleErrorSpy.mockRestore();
  });

  it('should prevent event propagation on dropdown menu click', () => {
    const { container } = render(
      <TaskItem
        task={mockTask}
        isSelected={false}
        isEditing={false}
        editingTitle=""
        {...mockCallbacks}
      />
    );

    const dropdownTrigger = container.querySelector('[data-slot="dropdown-menu-trigger"]');
    if (dropdownTrigger) {
      fireEvent.click(dropdownTrigger);
    }

    // The onSelect should not be called because event propagation should be stopped
    expect(mockCallbacks.onSelect).not.toHaveBeenCalled();
  });
});
