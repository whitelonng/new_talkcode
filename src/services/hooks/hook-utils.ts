import type { HookCommand, HookRule } from '@/types/hooks';

export function filterEnabledRules(rules: HookRule[] | undefined): HookRule[] {
  if (!rules) return [];
  return rules.filter((rule) => rule.enabled !== false && rule.hooks.length > 0);
}

export function filterEnabledHooks(hooks: HookCommand[] | undefined): HookCommand[] {
  if (!hooks) return [];
  return hooks.filter((hook) => hook.enabled !== false && hook.command.trim().length > 0);
}
