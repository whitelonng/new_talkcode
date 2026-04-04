import { CheckCircle2, Circle, Clock, ListTodo } from 'lucide-react';
import type { TodoItem } from '@/lib/tools/todo-write-tool';
import { GenericToolResult } from './generic-tool-result';

interface TodoWriteToolResultProps {
  success: boolean;
  todos: TodoItem[];
  error?: string;
}

export function TodoWriteToolResult({ success, todos, error }: TodoWriteToolResultProps) {
  if (!success) {
    return <GenericToolResult success={false} message={error || 'Todo update failed'} />;
  }

  const totalTodos = todos.length;

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'completed':
        return <CheckCircle2 className="h-4 w-4" />;
      case 'in_progress':
        return <Clock className="h-4 w-4" />;
      default:
        return <Circle className="h-4 w-4" />;
    }
  };

  const getStatusStyles = (status: string) => {
    switch (status) {
      case 'completed':
        return {
          container: 'text-gray-400 dark:text-gray-600',
          text: 'line-through',
          icon: 'text-gray-400 dark:text-gray-600',
        };
      case 'in_progress':
        return {
          container: 'text-amber-600 dark:text-amber-400',
          text: '',
          icon: 'text-amber-600 dark:text-amber-400',
        };
      default:
        return {
          container: 'text-gray-700 dark:text-gray-300',
          text: '',
          icon: 'text-gray-400 dark:text-gray-600',
        };
    }
  };

  return (
    <div className="space-y-3">
      {/* Markdown formatted Todo list */}
      {totalTodos > 0 && (
        <div className="border rounded-lg overflow-hidden bg-white dark:bg-gray-900 dark:border-gray-700 w-full">
          {/* Header */}
          <div className="flex items-center gap-2 text-gray-700 border-b px-4 py-3 dark:text-gray-300 dark:border-gray-700 bg-gray-50 dark:bg-gray-800">
            <ListTodo className="h-4 w-4" />
            <span className="text-sm font-medium">Todo List</span>
          </div>

          {/* Todo items */}
          <div className="p-4 space-y-1">
            {todos.map((todo) => {
              const styles = getStatusStyles(todo.status);
              return (
                <div
                  key={todo.id}
                  className={`flex items-start gap-3 py-2 px-3 rounded transition-colors ${styles.container} hover:bg-gray-50 dark:hover:bg-gray-800`}
                >
                  {/* Checkbox Icon */}
                  <div className={`mt-0.5 flex-shrink-0 ${styles.icon}`}>
                    {getStatusIcon(todo.status)}
                  </div>

                  {/* Content */}
                  <span className={`text-sm leading-relaxed break-words ${styles.text}`}>
                    {todo.content}
                  </span>
                </div>
              );
            })}
          </div>

          <div className="border-t px-4 py-3 bg-gray-50 dark:bg-gray-800 dark:border-gray-700">
            <div className="flex flex-wrap gap-4 text-xs text-gray-600 dark:text-gray-400">
              <div className="flex items-center gap-1">
                <Circle className="h-3 w-3 text-gray-400 dark:text-gray-600" />
                <span>{todos.filter((t) => t.status === 'pending').length} pending</span>
              </div>
              <div className="flex items-center gap-1">
                <Clock className="h-3 w-3 text-amber-600 dark:text-amber-400" />
                <span>{todos.filter((t) => t.status === 'in_progress').length} in progress</span>
              </div>
              <div className="flex items-center gap-1">
                <CheckCircle2 className="h-3 w-3 text-gray-400 dark:text-gray-600" />
                <span>{todos.filter((t) => t.status === 'completed').length} completed</span>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
