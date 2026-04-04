// src/components/selectors/model-list-item.tsx
// Shared model list item component for model selectors

import { Check } from 'lucide-react';
import type { AvailableModel } from '@/types/api-keys';

interface ModelListItemProps {
  model: AvailableModel;
  isSelected: boolean;
  onSelect: (model: AvailableModel) => void;
  showAllBadges?: boolean;
}

export function ModelListItem({
  model,
  isSelected,
  onSelect,
  showAllBadges = false,
}: ModelListItemProps) {
  const handleClick = () => onSelect(model);

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      onSelect(model);
    }
  };

  return (
    // biome-ignore lint/a11y/useSemanticElements: Complex flex layout requires div, has proper keyboard handling
    <div
      className={`flex items-center gap-2 p-2 rounded-md cursor-pointer hover:bg-accent ${
        isSelected ? 'bg-accent/50' : ''
      }`}
      onClick={handleClick}
      onKeyDown={handleKeyDown}
      role="button"
      tabIndex={0}
    >
      <div
        className={`w-4 h-4 rounded-full border flex items-center justify-center flex-shrink-0 ${
          isSelected ? 'bg-primary border-primary' : 'border-input'
        }`}
      >
        {isSelected && <Check className="h-3 w-3 text-primary-foreground" />}
      </div>

      <div className="flex-1 min-w-0">
        <div className="font-medium text-sm truncate">{model.name}</div>
        <div className="text-xs text-muted-foreground truncate">{model.providerName}</div>
      </div>

      {/* Show capabilities badges */}
      <div className="flex gap-1 flex-shrink-0">
        {model.imageInput && (
          <span className="text-[10px] px-1 py-0.5 rounded bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400">
            IMG
          </span>
        )}
        {showAllBadges && model.imageOutput && (
          <span className="text-[10px] px-1 py-0.5 rounded bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400">
            IMG OUT
          </span>
        )}
        {showAllBadges && model.audioInput && (
          <span className="text-[10px] px-1 py-0.5 rounded bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-400">
            AUDIO
          </span>
        )}
        {showAllBadges && model.videoInput && (
          <span className="text-[10px] px-1 py-0.5 rounded bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-400">
            VID
          </span>
        )}
      </div>
    </div>
  );
}
