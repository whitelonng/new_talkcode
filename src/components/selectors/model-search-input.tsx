// src/components/selectors/model-search-input.tsx
// Shared search input component for model selectors

import { Search, X } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { useLocale } from '@/hooks/use-locale';

interface ModelSearchInputProps {
  value: string;
  onChange: (value: string) => void;
  resultCount?: number;
  showResultCount?: boolean;
  autoFocus?: boolean;
}

export function ModelSearchInput({
  value,
  onChange,
  resultCount = 0,
  showResultCount = true,
  autoFocus = false,
}: ModelSearchInputProps) {
  const { t } = useLocale();
  const hasQuery = value.trim().length > 0;

  return (
    <div className="px-3 py-2 border-b">
      <div className="relative">
        <div className="absolute left-2 top-1/2 -translate-y-1/2 text-muted-foreground">
          <Search className="h-4 w-4" />
        </div>
        <Input
          placeholder={t.Settings.customModelsDialog.searchPlaceholder}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          className="h-8 pl-8 pr-8"
          autoFocus={autoFocus}
        />
        {hasQuery && (
          <button
            type="button"
            onClick={() => onChange('')}
            className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
            aria-label={t.Settings.customModelsDialog.clearSearchAria}
          >
            <X className="h-4 w-4" />
          </button>
        )}
      </div>
      {showResultCount && hasQuery && (
        <div className="mt-1 text-xs text-muted-foreground">
          {t.Settings.customModelsDialog.searchResults(resultCount)}
        </div>
      )}
    </div>
  );
}
