import { readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

const projectRoot = process.cwd();

interface CapabilityEntry {
  identifier?: string;
  permissions?: Array<string | { identifier: string }>;
}

interface TauriConfig {
  app?: {
    security?: {
      capabilities?: Array<string | CapabilityEntry>;
    };
  };
}

const updatePermissionSet = new Set([
  'updater:default',
  'updater:allow-check',
  'updater:allow-download',
  'updater:allow-install',
]);

async function readJson<T>(relativePath: string): Promise<T> {
  const contents = await readFile(join(projectRoot, relativePath), 'utf8');
  return JSON.parse(contents) as T;
}

describe('Updater capabilities', () => {
  it('config enables default capability for desktop build', async () => {
    const config = await readJson<TauriConfig>('src-tauri/tauri.conf.json');

    expect(config.app?.security?.capabilities).toBeDefined();
    expect(config.app?.security?.capabilities).toContain('default');
  });

  it('desktop default capability includes updater permissions', async () => {
    const capability = await readJson<{ permissions?: Array<string | { identifier: string }> }>(
      'src-tauri/capabilities/default.json',
    );

    const permissions = capability.permissions ?? [];
    const permissionNames = permissions.map((permission) =>
      typeof permission === 'string' ? permission : permission.identifier,
    );

    for (const permission of updatePermissionSet) {
      expect(permissionNames).toContain(permission);
    }
  });
});
