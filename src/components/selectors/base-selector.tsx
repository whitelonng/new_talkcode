// src/components/chat/selectors/base-selector.tsx
import type { ReactNode } from 'react';
import {
  PromptInputModelSelect,
  PromptInputModelSelectContent,
  PromptInputModelSelectItem,
  PromptInputModelSelectTrigger,
  PromptInputModelSelectValue,
} from '@/components/ai-elements/prompt-input';

interface SelectorItem {
  value: string;
  label: string;
  content?: ReactNode;
}

interface BaseSelectorProps {
  value: string;
  onValueChange: (value: string) => void;
  items: SelectorItem[];
  placeholder?: string;
  disabled?: boolean;
}

export function BaseSelector({
  value,
  onValueChange,
  items,
  placeholder = 'Select...',
  disabled = false,
}: BaseSelectorProps) {
  return (
    <PromptInputModelSelect disabled={disabled} onValueChange={onValueChange} value={value}>
      <PromptInputModelSelectTrigger>
        <PromptInputModelSelectValue placeholder={placeholder} />
      </PromptInputModelSelectTrigger>
      <PromptInputModelSelectContent>
        {items.map((item) => (
          <PromptInputModelSelectItem key={item.value} value={item.value}>
            {item.content || item.label}
          </PromptInputModelSelectItem>
        ))}
      </PromptInputModelSelectContent>
    </PromptInputModelSelect>
  );
}
