// src/components/selectors/model-selector-with-search.tsx
// Reusable model selector with search functionality

import { useMemo, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { ScrollArea } from '@/components/ui/scroll-area';
import { useLocale } from '@/hooks/use-locale';
import { useModelSearch } from '@/hooks/use-model-search';
import { useProviderStore } from '@/providers/stores/provider-store';
import type { AvailableModel } from '@/types/api-keys';
import { ModelListItem } from './model-list-item';
import { ModelSearchInput } from './model-search-input';

interface ModelSelectorWithSearchProps {
  /** Current selected model key */
  value?: string;
  /** Callback when model is selected */
  onChange?: (modelKey: string) => void;
  /** Optional filter function to restrict available models */
  filterFn?: (model: AvailableModel) => boolean;
  /** Placeholder text when no model is selected */
  placeholder?: string;
  /** Whether the selector is disabled */
  disabled?: boolean;
}

export function ModelSelectorWithSearch({
  value,
  onChange,
  filterFn,
  placeholder,
  disabled = false,
}: ModelSelectorWithSearchProps) {
  const { t } = useLocale();
  const [open, setOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');

  // Get available models from store
  const availableModels = useProviderStore((state) => state.availableModels);
  const isLoading = useProviderStore((state) => state.isLoading);

  // Use shared search hook
  const { filteredModels, hasSearchQuery } = useModelSearch({
    models: availableModels,
    searchQuery,
    filterFn,
  });

  // Find current model info
  const currentModel = useMemo(() => {
    if (!value) return undefined;
    return (
      filteredModels.find((m) => m.key === value) || availableModels.find((m) => m.key === value)
    );
  }, [filteredModels, availableModels, value]);

  // Handle model selection
  const handleSelectModel = (model: AvailableModel) => {
    if (onChange) {
      onChange(model.key);
    }
    setOpen(false);
    setSearchQuery('');
  };

  // Reset search when popover closes
  const handleOpenChange = (newOpen: boolean) => {
    if (!newOpen) {
      setSearchQuery('');
    }
    setOpen(newOpen);
  };

  // Get display text for trigger button
  const triggerText = currentModel
    ? currentModel.name
    : (placeholder ?? t.Settings.models.selectModel);

  return (
    <Popover open={open} onOpenChange={handleOpenChange}>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          className="justify-start truncate"
          disabled={disabled || isLoading}
          aria-label={t.Settings.models.selectModel}
        >
          <span className="truncate">{triggerText}</span>
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-80 p-0" align="start">
        <div className="flex items-center justify-between px-3 py-2 border-b">
          <div className="font-semibold text-sm">{t.Settings.models.selectModel}</div>
          {currentModel && (
            <span className="text-xs text-muted-foreground truncate max-w-[150px]">
              {currentModel.name}
            </span>
          )}
        </div>

        <ModelSearchInput
          value={searchQuery}
          onChange={setSearchQuery}
          resultCount={filteredModels.length}
          autoFocus
        />

        <ScrollArea className="h-[400px]">
          {isLoading ? (
            <div className="p-4 text-center text-sm text-muted-foreground">{t.Common.loading}</div>
          ) : filteredModels.length === 0 ? (
            <div className="p-4 text-center text-sm text-muted-foreground">
              {hasSearchQuery
                ? t.Settings.customModelsDialog.noModelsMatch(searchQuery)
                : t.Chat.modelSelector.noModels}
            </div>
          ) : (
            <div className="p-2 space-y-1" key={`models-${searchQuery}`}>
              {filteredModels.map((model) => (
                <ModelListItem
                  key={`${model.key}-${model.provider}`}
                  model={model}
                  isSelected={model.key === value}
                  onSelect={handleSelectModel}
                  showAllBadges
                />
              ))}
            </div>
          )}
        </ScrollArea>
      </PopoverContent>
    </Popover>
  );
}
