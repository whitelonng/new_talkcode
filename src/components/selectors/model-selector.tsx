// src/components/selectors/model-selector.tsx

import { useMemo } from 'react';
import { useAppSettings } from '@/hooks/use-settings';
import { logger } from '@/lib/logger';
import { useProviderStore } from '@/providers/stores/provider-store';
import type { AvailableModel } from '@/types/api-keys';
import { BaseSelector } from './base-selector';

interface ModelSelectorProps {
  disabled?: boolean;
  value?: string; // optional controlled value
  onChange?: (value: string) => void; // optional controlled change handler
  filterFn?: (model: AvailableModel) => boolean; // optional filter function
  placeholder?: string; // optional placeholder text
}

export function ModelSelector({
  disabled = false,
  value,
  onChange,
  filterFn,
  placeholder,
}: ModelSelectorProps) {
  const { settings, setModel, loading: settingsLoading } = useAppSettings();
  // Use provider store directly - no event listeners needed, Zustand handles reactivity
  const availableModels = useProviderStore((state) => state.availableModels);
  const isLoading = useProviderStore((state) => state.isLoading);

  const modelItems = useMemo(() => {
    // Filter models based on filterFn
    const filtered = availableModels.filter((model) => !filterFn || filterFn(model));

    // Group by model key to get unique models
    const uniqueModels = new Map<string, AvailableModel>();
    for (const model of filtered) {
      if (!uniqueModels.has(model.key)) {
        uniqueModels.set(model.key, model);
      }
    }

    // Convert to selector items with just model name
    return Array.from(uniqueModels.values()).map((model) => ({
      value: model.key,
      label: model.name,
    }));
  }, [availableModels, filterFn]);

  const handleModelChange = async (next: string) => {
    try {
      if (onChange) {
        onChange(next);
      } else {
        await setModel(next);
      }
    } catch (error) {
      logger.error('Failed to update model:', error);
    }
  };

  // Show loading state while models or settings are loading
  if ((!value && settingsLoading) || isLoading) return null;

  // If no models are available, show a helpful message instead of a selector
  if (availableModels.length === 0) {
    return (
      <div className="flex items-center justify-between rounded-lg border px-3 py-2 text-sm text-muted-foreground">
        <span>No models available</span>
        <span className="text-xs">Configure API keys in settings</span>
      </div>
    );
  }

  return (
    <BaseSelector
      disabled={disabled}
      items={modelItems}
      onValueChange={handleModelChange}
      placeholder={placeholder ?? 'Select model'}
      value={value ?? settings.model}
    />
  );
}
