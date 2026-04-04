import { create } from 'zustand';
import { logger } from '@/lib/logger';
import type { CustomToolPermission } from '@/types/custom-tool';

export interface CustomToolPermissionGrant {
  toolName: string;
  permissions: CustomToolPermission[];
  grantedAt: number;
}

interface CustomToolPermissionState {
  grants: Map<string, CustomToolPermissionGrant>;
}

interface CustomToolPermissionStore extends CustomToolPermissionState {
  grantPermission: (toolName: string, permissions: CustomToolPermission[]) => void;
  revokePermission: (toolName: string) => void;
  getGrant: (toolName: string) => CustomToolPermissionGrant | undefined;
  getAllGrants: () => CustomToolPermissionGrant[];
}

export const useCustomToolPermissionStore = create<CustomToolPermissionStore>((set, get) => ({
  grants: new Map(),

  grantPermission: (toolName: string, permissions: CustomToolPermission[]) => {
    set((state) => {
      const next = new Map(state.grants);
      next.set(toolName, { toolName, permissions, grantedAt: Date.now() });
      logger.info(`[CustomToolPermission] Granted permissions for ${toolName}`, permissions);
      return { grants: next };
    });
  },

  revokePermission: (toolName: string) => {
    set((state) => {
      const next = new Map(state.grants);
      next.delete(toolName);
      logger.info(`[CustomToolPermission] Revoked permissions for ${toolName}`);
      return { grants: next };
    });
  },

  getGrant: (toolName: string) => {
    return get().grants.get(toolName);
  },

  getAllGrants: () => {
    return Array.from(get().grants.values());
  },
}));
