import { appDataDir, dirname, homeDir, join, normalize } from '@tauri-apps/api/path';
import { exists, mkdir, readTextFile, writeTextFile } from '@tauri-apps/plugin-fs';
import { logger } from '@/lib/logger';
import { DEFAULT_HOOKS_CONFIG } from '@/services/hooks/hook-config-default';
import { getValidatedWorkspaceRoot } from '@/services/workspace-root-service';
import type { HookConfigScope, HookEventName, HookRule, HooksConfigFile } from '@/types/hooks';

const HOOKS_SETTINGS_FILE = 'settings.json';
const TALKCODY_DIR = '.talkcody';

export interface ResolvedHooksConfig {
  source: HookConfigScope;
  path: string;
  config: HooksConfigFile;
}

export interface MergedHooksConfig {
  hooks: HooksConfigFile['hooks'];
  sources: ResolvedHooksConfig[];
}

function normalizePath(p: string): Promise<string> {
  return normalize(p);
}

async function ensureFileExists(path: string): Promise<void> {
  const fileExists = await exists(path);
  if (fileExists) return;
  const dirPath = await dirname(path);
  try {
    await mkdir(dirPath, { recursive: true });
  } catch (error) {
    logger.error('[HookConfig] Failed to create hooks config directory', error);
    throw error;
  }
  await writeTextFile(path, JSON.stringify(DEFAULT_HOOKS_CONFIG, null, 2));
}

async function readConfig(path: string, scope: HookConfigScope): Promise<ResolvedHooksConfig> {
  try {
    await ensureFileExists(path);
    const raw = await readTextFile(path);
    const parsed = JSON.parse(raw) as HooksConfigFile;
    return { source: scope, path, config: parsed };
  } catch (error) {
    logger.error('[HookConfig] Failed to read config', { path, scope, error });
    return { source: scope, path, config: { hooks: {} } };
  }
}

type HookMap = NonNullable<HooksConfigFile['hooks']>;

function mergeRules(base: HookMap | undefined, next: HookMap | undefined): HookMap {
  const merged: HookMap = { ...(base ?? {}) };
  if (!next) return merged;
  for (const [eventName, rules] of Object.entries(next) as [HookEventName, HookRule[]][]) {
    const existing = merged[eventName] ?? [];
    const safeRules = Array.isArray(rules) ? rules : [];
    merged[eventName] = [...existing, ...safeRules];
  }
  return merged;
}

export class HookConfigService {
  private cached: MergedHooksConfig | null = null;

  async loadConfigs(): Promise<MergedHooksConfig> {
    const workspaceRoot = await getValidatedWorkspaceRoot();
    const userHome = await homeDir();
    const fallbackHome = userHome || (await appDataDir());

    const userPath = await normalizePath(
      await join(fallbackHome, TALKCODY_DIR, HOOKS_SETTINGS_FILE)
    );
    const projectPath = await normalizePath(
      await join(workspaceRoot, TALKCODY_DIR, HOOKS_SETTINGS_FILE)
    );

    const configs = await Promise.all([
      readConfig(userPath, 'user'),
      readConfig(projectPath, 'project'),
    ]);

    const mergedHooks = configs.reduce<HooksConfigFile['hooks']>((acc, cfg) => {
      return mergeRules(acc, cfg.config.hooks);
    }, {});

    const merged: MergedHooksConfig = {
      hooks: mergedHooks,
      sources: configs,
    };

    this.cached = merged;
    return merged;
  }

  getCachedConfig(): MergedHooksConfig | null {
    return this.cached;
  }

  clearCache(): void {
    this.cached = null;
  }

  async updateConfig(scope: HookConfigScope, config: HooksConfigFile): Promise<void> {
    const workspaceRoot = await getValidatedWorkspaceRoot();
    const userHome = await homeDir();
    const fallbackHome = userHome || (await appDataDir());

    let targetPath: string;
    if (scope === 'user') {
      targetPath = await normalizePath(await join(fallbackHome, TALKCODY_DIR, HOOKS_SETTINGS_FILE));
    } else {
      targetPath = await normalizePath(
        await join(workspaceRoot, TALKCODY_DIR, HOOKS_SETTINGS_FILE)
      );
    }

    await ensureFileExists(targetPath);
    await writeTextFile(targetPath, JSON.stringify(config, null, 2));
    this.cached = null;
  }

  async getConfigByScope(scope: HookConfigScope): Promise<ResolvedHooksConfig> {
    const workspaceRoot = await getValidatedWorkspaceRoot();
    const userHome = await homeDir();
    const fallbackHome = userHome || (await appDataDir());

    if (scope === 'user') {
      const userPath = await normalizePath(
        await join(fallbackHome, TALKCODY_DIR, HOOKS_SETTINGS_FILE)
      );
      return readConfig(userPath, 'user');
    }
    const projectPath = await normalizePath(
      await join(workspaceRoot, TALKCODY_DIR, HOOKS_SETTINGS_FILE)
    );
    return readConfig(projectPath, 'project');
  }

  mergeRulesForEvent(rules: HookRule[]): HookRule[] {
    return rules.filter((rule) => rule.hooks && rule.hooks.length > 0);
  }
}

export const hookConfigService = new HookConfigService();
