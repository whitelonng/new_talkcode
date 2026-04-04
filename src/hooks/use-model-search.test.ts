import { renderHook } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import type { AvailableModel } from '@/types/api-keys';
import { useModelSearch } from './use-model-search';

const models: AvailableModel[] = [
  {
    key: 'gpt-4o',
    name: 'GPT-4o',
    provider: 'openai',
    providerName: 'OpenAI',
    imageInput: true,
    imageOutput: true,
    audioInput: true,
    inputPricing: '5',
  },
  {
    key: 'claude-3-opus',
    name: 'Claude 3 Opus',
    provider: 'anthropic',
    providerName: 'Anthropic',
    imageInput: true,
    imageOutput: false,
    audioInput: false,
    inputPricing: '15',
  },
];

describe('useModelSearch', () => {
  it('matches by provider name', () => {
    const { result } = renderHook(() =>
      useModelSearch({
        models,
        searchQuery: 'openai',
      })
    );

    expect(result.current.filteredModels).toEqual([models[0]]);
  });

  it('matches by provider id', () => {
    const { result } = renderHook(() =>
      useModelSearch({
        models,
        searchQuery: 'anthropic',
      })
    );

    expect(result.current.filteredModels).toEqual([models[1]]);
  });

  it('keeps name and key matching behavior', () => {
    const { result } = renderHook(() =>
      useModelSearch({
        models,
        searchQuery: 'gpt 4o',
      })
    );

    expect(result.current.filteredModels).toEqual([models[0]]);
  });

  it('uses AND logic across terms', () => {
    const { result } = renderHook(() =>
      useModelSearch({
        models,
        searchQuery: 'openai gpt',
      })
    );

    expect(result.current.filteredModels).toEqual([models[0]]);
  });
});
