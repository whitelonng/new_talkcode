import { GenericToolDoing } from './generic-tool-doing';

interface TodoWriteToolDoingProps {
  todos: Array<{
    content: string;
    status: 'pending' | 'in_progress' | 'completed';
    id: string;
  }>;
}

export function TodoWriteToolDoing({ todos }: TodoWriteToolDoingProps) {
  const totalTodos = todos.length;
  const completedTodos = todos.filter((todo) => todo.status === 'completed').length;
  const inProgressTodos = todos.filter((todo) => todo.status === 'in_progress').length;

  const details = `${totalTodos} todo(s) • ${completedTodos} completed • ${inProgressTodos} in progress`;

  return <GenericToolDoing type="todo" operation="update" details={details} />;
}
