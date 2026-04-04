// src/hooks/use-model-search.ts
// Shared hook for model search filtering logic

import { useMemo } from 'react';
import type { AvailableModel } from '@/types/api-keys';

interface UseModelSearchOptions {
  models: AvailableModel[];
  searchQuery: string;
  filterFn?: (model: AvailableModel) => boolean;
}

interface UseModelSearchResult {
  filteredModels: AvailableModel[];
  hasSearchQuery: boolean;
}

export function useModelSearch({
  models,
  searchQuery,
  filterFn,
}: UseModelSearchOptions): UseModelSearchResult {
  // Apply filterFn and deduplication (always deduplicate, not just during search)
  const filteredByType = useMemo(() => {
    const result = filterFn ? models.filter(filterFn) : models;

    // Always apply deduplication based on model key and provider combination
    const seen = new Set<string>();
    return result.filter((model) => {
      const key = `${model.key}-${model.provider}`;
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });
  }, [models, filterFn]);

  // Filter models based on search query
  const filteredModels = useMemo(() => {
    const query = searchQuery.trim();

    // If no search query, return all filtered models (already deduplicated)
    if (!query) {
      return filteredByType;
    }

    const searchTerms = query
      .toLowerCase()
      .split(/\s+/)
      .filter((term) => term.length > 0);

    // Filter models that match all search terms
    return filteredByType.filter((model) => {
      // Create searchable text from model properties
      const searchableFields = [
        model.name ?? '',
        model.key ?? '',
        model.providerName ?? '',
        model.provider ?? '',
      ];
      const searchableText = searchableFields.join(' ').toLowerCase();

      // All search terms must be present (AND logic)
      return searchTerms.every((term) => searchableText.includes(term));
    });
  }, [filteredByType, searchQuery]);

  return {
    filteredModels,
    hasSearchQuery: searchQuery.trim().length > 0,
  };
}
