// src/components/selectors/provider-selector.tsx

import { useMemo } from 'react';
import { useProviderStore } from '@/providers/stores/provider-store';
import { BaseSelector } from './base-selector';

interface ProviderSelectorProps {
  modelKey: string;
  value?: string; // optional controlled value
  onChange?: (value: string) => void; // optional controlled change handler
  placeholder?: string; // optional placeholder text
  disabled?: boolean;
}

export function ProviderSelector({
  modelKey,
  value,
  onChange,
  placeholder = 'Select provider',
  disabled = false,
}: ProviderSelectorProps) {
  const availableModels = useProviderStore((state) => state.availableModels);

  // Get available providers for the selected model
  const providerItems = useMemo(() => {
    if (!modelKey) return [];

    // Get all available providers for this model from the store
    const modelProviders = availableModels
      .filter((m) => m.key === modelKey)
      .map((m) => ({
        value: m.provider,
        label: m.providerName,
      }));

    // Remove duplicates
    const uniqueProviders = Array.from(new Map(modelProviders.map((p) => [p.value, p])).values());

    return uniqueProviders;
  }, [modelKey, availableModels]);

  // If no providers available or only one provider, don't render selector
  if (providerItems.length === 0) {
    return null;
  }

  const handleProviderChange = (providerId: string) => {
    if (onChange) {
      onChange(providerId);
    }
  };

  return (
    <BaseSelector
      disabled={disabled}
      items={providerItems}
      onValueChange={handleProviderChange}
      placeholder={placeholder}
      value={value || providerItems[0]?.value || ''}
    />
  );
}
