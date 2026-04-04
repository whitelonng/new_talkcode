// src/hooks/use-settings.ts
import { useSettingsStore } from '@/stores/settings-store';

export type SettingKey =
  | 'model'
  | 'assistantId'
  | 'project'
  | 'is_think'
  | 'language'
  | 'mode'
  | 'apiKey';

export type SettingValue<T extends SettingKey> = T extends 'is_think'
  ? boolean
  : T extends 'model' | 'assistantId' | 'project' | 'language' | 'apiKey' | 'mode'
    ? string
    : never;

export type SettingsState<T extends SettingKey> = {
  [K in T]: SettingValue<K>;
};

// Helper type to convert snake_case to camelCase
type ToCamelCase<S extends string> = S extends `${infer P1}_${infer P2}${infer P3}`
  ? `${P1}${Capitalize<ToCamelCase<`${P2}${P3}`>>}`
  : S;

// Helper type to generate setter function names
type SetterName<K extends SettingKey> = `set${Capitalize<ToCamelCase<K>>}`;

export type SettingsUpdaters<T extends SettingKey> = {
  [K in T as SetterName<K>]: (value: SettingValue<K>) => Promise<void>;
} & {
  updateSettings: (partial: Partial<SettingsState<T>>) => Promise<void>;
};

export type UseSettingsReturn<T extends SettingKey> = {
  settings: SettingsState<T>;
  loading: boolean;
  error: Error | null;
} & SettingsUpdaters<T>;

/**
 * Hook to use settings with Zustand store
 * Now uses the global Zustand store instead of React useState
 * This eliminates closure issues and ensures all components share the same state
 */
export function useSettings<T extends SettingKey>(keys: readonly T[]): UseSettingsReturn<T> {
  // Subscribe to individual state pieces for efficiency
  const model = useSettingsStore((state) => state.model);
  const assistantId = useSettingsStore((state) => state.assistantId);
  const project = useSettingsStore((state) => state.project);
  const is_think = useSettingsStore((state) => state.is_think);
  const language = useSettingsStore((state) => state.language);
  const loading = useSettingsStore((state) => state.loading);
  const error = useSettingsStore((state) => state.error);

  // Subscribe to store actions (stable references, no closures)
  const setModel = useSettingsStore((state) => state.setModel);
  const setAssistantId = useSettingsStore((state) => state.setAssistantId);
  const setProject = useSettingsStore((state) => state.setProject);
  const setIsThink = useSettingsStore((state) => state.setIsThink);
  const setLanguage = useSettingsStore((state) => state.setLanguage);

  // Build full settings object
  const fullSettings = {
    model,
    assistantId,
    project,
    is_think,
    language,
    mode: '', // mode is deprecated but kept for compatibility
    apiKey: '', // apiKey is deprecated but kept for compatibility
  };

  // Extract only the requested keys from full settings
  const settings = {} as SettingsState<T>;
  for (const key of keys) {
    (settings as Record<string, unknown>)[key] = fullSettings[key];
  }

  // Batch update function for compatibility
  const updateSettings = async (partial: Partial<SettingsState<T>>) => {
    const updates: Record<string, string> = {};
    for (const [key, value] of Object.entries(partial)) {
      if (key === 'is_think') {
        updates[key] = String(value);
      } else {
        updates[key] = value as string;
      }
    }

    // Update individual values through their setters
    for (const [key, value] of Object.entries(partial)) {
      if (key === 'model') await setModel(value as string);
      else if (key === 'assistantId') await setAssistantId(value as string);
      else if (key === 'project') await setProject(value as string);
      else if (key === 'is_think') await setIsThink(value as boolean);
      else if (key === 'language') await setLanguage(value as string);
    }
  };

  // Map store actions to setter names (for backward compatibility)
  const setters: Record<string, unknown> = {
    setModel,
    setAssistantId,
    setProject,
    setIsThink,
    setLanguage,
    setMode: async () => {}, // deprecated
    setApiKey: async () => {}, // deprecated
    updateSettings,
  };

  return {
    settings,
    loading,
    error,
    ...setters,
  } as UseSettingsReturn<T>;
}

/**
 * Hook for app-level settings
 * Uses the new Zustand-based implementation
 */
export function useAppSettings() {
  return useSettings(['model', 'assistantId', 'is_think', 'project'] as const);
}
