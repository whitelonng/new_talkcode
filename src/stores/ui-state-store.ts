// src/stores/ui-state-store.ts
/**
 * UIStateStore - UI interaction state management
 *
 * This store manages UI-specific state that doesn't belong to
 * domain entities (Task, Message):
 * - Task title editing state
 * - UI preferences (collapse states, etc.)
 *
 * Note: User question prompts are handled by user-question-store.ts
 * which is kept separate for askUserQuestionsTool.
 */

import { create } from 'zustand';
import type { Task } from '@/types';

interface UIState {
  // Task editing state
  editingTaskId: string | null;
  editingTitle: string;

  // ============================================
  // Task Editing Actions
  // ============================================

  /**
   * Start editing a task's title
   */
  startEditing: (task: Task, e?: React.MouseEvent) => void;

  /**
   * Update the editing title
   */
  setEditingTitle: (title: string) => void;

  /**
   * Cancel editing
   */
  cancelEditing: () => void;

  /**
   * Finish editing (returns the new title, or null if cancelled)
   */
  finishEditing: () => { taskId: string; title: string } | null;

  // ============================================
  // Selectors
  // ============================================

  /**
   * Check if a specific task is being edited
   */
  isEditing: (taskId: string) => boolean;
}

export const useUIStateStore = create<UIState>()((set, get) => ({
  editingTaskId: null,
  editingTitle: '',

  // ============================================
  // Task Editing Actions
  // ============================================

  startEditing: (task, e) => {
    // Prevent event propagation if event is provided
    if (e) {
      e.stopPropagation();
    }

    set({
      editingTaskId: task.id,
      editingTitle: task.title,
    });
  },

  setEditingTitle: (title) => {
    set({ editingTitle: title });
  },

  cancelEditing: () => {
    set({
      editingTaskId: null,
      editingTitle: '',
    });
  },

  finishEditing: () => {
    const state = get();
    if (!state.editingTaskId || !state.editingTitle.trim()) {
      // Cancel if no valid data
      set({
        editingTaskId: null,
        editingTitle: '',
      });
      return null;
    }

    const result = {
      taskId: state.editingTaskId,
      title: state.editingTitle.trim(),
    };

    set({
      editingTaskId: null,
      editingTitle: '',
    });

    return result;
  },

  // ============================================
  // Selectors
  // ============================================

  isEditing: (taskId) => {
    return get().editingTaskId === taskId;
  },
}));

// Export store instance for direct access in non-React contexts
export const uiStateStore = useUIStateStore;
