// src/services/file-todo-service.ts
import { join } from '@tauri-apps/api/path';
import { exists, mkdir, readDir, readTextFile, remove, writeTextFile } from '@tauri-apps/plugin-fs';
import { logger } from '@/lib/logger';
import { timedMethod } from '@/lib/timer';
import type { CreateTodoItem, TodoItem } from '@/types';

export interface FileTodoData {
  taskId: string;
  todos: TodoItem[];
  lastUpdated: number;
  version: string;
}

export class FileTodoService {
  private todosDir: string | null = null;
  private initPromise: Promise<void> | null = null;

  private async ensureTodosDirectory(): Promise<string> {
    if (this.todosDir) return this.todosDir;

    if (!this.initPromise) {
      this.initPromise = this.initializeDirectory();
    }
    await this.initPromise;
    if (!this.todosDir) {
      throw new Error('Todos directory not initialized');
    }
    return this.todosDir;
  }

  private async initializeDirectory(): Promise<void> {
    try {
      // Get app data directory and create todos subdirectory
      const { appDataDir } = await import('@tauri-apps/api/path');
      const appDir = await appDataDir();
      this.todosDir = await join(appDir, 'todos');

      // Create directory if it doesn't exist
      if (!(await exists(this.todosDir))) {
        await mkdir(this.todosDir, { recursive: true });
        logger.info(`Created todos directory: ${this.todosDir}`);
      }
    } catch (error) {
      logger.error('Failed to initialize todos directory:', error);
      throw error;
    }
  }

  private async getTodoFilePath(taskId: string): Promise<string> {
    const todosDir = await this.ensureTodosDirectory();
    return join(todosDir, `${taskId}.json`);
  }

  @timedMethod('getTodosByTask')
  async getTodosByTask(taskId: string): Promise<TodoItem[]> {
    try {
      const filePath = await this.getTodoFilePath(taskId);

      if (!(await exists(filePath))) {
        logger.info(`No todos file found for task ${taskId}`);
        return [];
      }

      const content = await readTextFile(filePath);
      const data: FileTodoData = JSON.parse(content);

      logger.info(`Retrieved ${data.todos.length} todos for task ${taskId}`);
      return data.todos;
    } catch (error) {
      logger.error(`Error reading todos for task ${taskId}:`, error);
      // Return empty array instead of throwing to maintain compatibility
      return [];
    }
  }

  @timedMethod('saveTodos')
  async saveTodos(taskId: string, todos: CreateTodoItem[]): Promise<void> {
    try {
      const filePath = await this.getTodoFilePath(taskId);
      const now = Date.now();

      // Convert CreateTodoItem to TodoItem by adding required fields
      const todoItems: TodoItem[] = todos.map((todo, index) => ({
        id: (todo as any).id || `todo-${now}-${index}`, // Use existing ID or generate new one
        conversation_id: taskId,
        content: todo.content,
        status: todo.status,
        created_at: (todo as any).created_at || now,
        updated_at: now,
      }));

      const data: FileTodoData = {
        taskId,
        todos: todoItems,
        lastUpdated: now,
        version: '1.0',
      };

      await writeTextFile(filePath, JSON.stringify(data, null, 2));

      logger.info(`Saved ${todos.length} todos for task ${taskId}`);
    } catch (error) {
      logger.error(`Error saving todos for task ${taskId}:`, error);
      throw error;
    }
  }

  @timedMethod('deleteTodosByTask')
  async deleteTodosByTask(taskId: string): Promise<void> {
    try {
      const filePath = await this.getTodoFilePath(taskId);

      if (await exists(filePath)) {
        await remove(filePath);
        logger.info(`Deleted todos for task ${taskId}`);
      } else {
        logger.info(`No todos file to delete for task ${taskId}`);
      }
    } catch (error) {
      logger.error(`Error deleting todos for task ${taskId}:`, error);
      throw error;
    }
  }

  @timedMethod('updateTodo')
  async updateTodo(
    taskId: string,
    todoId: string,
    updates: Partial<Pick<TodoItem, 'content' | 'status'>>
  ): Promise<void> {
    try {
      const todos = await this.getTodosByTask(taskId);
      const todoIndex = todos.findIndex((todo) => todo.id === todoId);

      if (todoIndex === -1) {
        throw new Error(`Todo with ID ${todoId} not found`);
      }

      // Update the todo
      const currentTodo = todos[todoIndex];
      if (!currentTodo) {
        throw new Error(`Todo with ID ${todoId} not found`);
      }
      todos[todoIndex] = {
        ...currentTodo,
        ...updates,
        updated_at: Date.now(),
      };

      // Convert back to CreateTodoItem format for saving
      const createTodos: CreateTodoItem[] = todos.map((todo) => ({
        id: todo.id,
        content: todo.content,
        status: todo.status,
      }));

      await this.saveTodos(taskId, createTodos);
      logger.info(`Updated todo ${todoId} in task ${taskId}`);
    } catch (error) {
      logger.error(`Error updating todo ${todoId}:`, error);
      throw error;
    }
  }

  @timedMethod('getTodoById')
  async getTodoById(taskId: string, todoId: string): Promise<TodoItem | null> {
    try {
      const todos = await this.getTodosByTask(taskId);
      return todos.find((todo) => todo.id === todoId) || null;
    } catch (error) {
      logger.error(`Error getting todo ${todoId}:`, error);
      return null;
    }
  }

  @timedMethod('getTodoStats')
  async getTodoStats(taskId: string): Promise<{
    total: number;
    pending: number;
    inProgress: number;
    completed: number;
  }> {
    try {
      const todos = await this.getTodosByTask(taskId);

      return {
        total: todos.length,
        pending: todos.filter((t) => t.status === 'pending').length,
        inProgress: todos.filter((t) => t.status === 'in_progress').length,
        completed: todos.filter((t) => t.status === 'completed').length,
      };
    } catch (error) {
      logger.error(`Error getting todo stats for task ${taskId}:`, error);
      return { total: 0, pending: 0, inProgress: 0, completed: 0 };
    }
  }

  // Additional utility method to get all task IDs that have todos
  async getAllTodoTasks(): Promise<string[]> {
    try {
      const todosDir = await this.ensureTodosDirectory();
      const entries = await readDir(todosDir);
      return entries
        .filter((entry: any) => entry.name?.endsWith('.json'))
        .map((entry: any) => entry.name?.replace('.json', ''));
    } catch (error) {
      logger.error('Error getting all todo tasks:', error);
      return [];
    }
  }
}

// Export singleton instance
export const fileTodoService = new FileTodoService();
