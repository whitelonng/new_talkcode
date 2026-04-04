/**
 * Skill Permission Store
 *
 * Manages permissions for skill script execution
 */

import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { logger } from '@/lib/logger';
import type {
  PermissionDecision,
  SkillPermissionGrant,
  SkillPermissionRequest,
  SkillScriptPermissionLevel,
} from '@/types/skill-permission';

interface SkillPermissionState {
  /** All granted permissions */
  grants: Map<string, SkillPermissionGrant>;

  /** Pending permission requests */
  pendingRequests: Map<string, SkillPermissionRequest>;

  /** Grant permission to a skill */
  grantPermission: (grant: SkillPermissionGrant) => void;

  /** Revoke permission from a skill */
  revokePermission: (skillId: string) => void;

  /** Get permission grant for a skill */
  getPermissionGrant: (skillId: string) => SkillPermissionGrant | undefined;

  /** Check if a skill has permission to execute a script */
  hasPermission: (
    skillId: string,
    scriptPath: string,
    requestedLevel: SkillScriptPermissionLevel
  ) => boolean;

  /** Request permission for a script */
  requestPermission: (request: SkillPermissionRequest) => void;

  /** Get pending request */
  getPendingRequest: (requestId: string) => SkillPermissionRequest | undefined;

  /** Decide on a permission request */
  decidePermission: (decision: PermissionDecision) => void;

  /** Clear all pending requests */
  clearPendingRequests: () => void;

  /** Get all grants as array */
  getAllGrants: () => SkillPermissionGrant[];
}

/**
 * Permission level hierarchy (for checking if granted level is sufficient)
 */
const PERMISSION_HIERARCHY: Record<SkillScriptPermissionLevel, number> = {
  'read-only': 1,
  'write-project': 2,
  'write-all': 3,
  network: 4,
  full: 5,
};

/**
 * Check if granted level satisfies requested level
 */
function hasRequiredPermissionLevel(
  granted: SkillScriptPermissionLevel,
  requested: SkillScriptPermissionLevel
): boolean {
  return PERMISSION_HIERARCHY[granted] >= PERMISSION_HIERARCHY[requested];
}

export const useSkillPermissionStore = create<SkillPermissionState>()(
  persist(
    (set, get) => ({
      grants: new Map(),
      pendingRequests: new Map(),

      grantPermission: (grant) => {
        set((state) => {
          const newGrants = new Map(state.grants);
          newGrants.set(grant.skillId, grant);
          logger.info('Permission granted:', {
            skillId: grant.skillId,
            level: grant.level,
            autoApprove: grant.autoApprove,
          });
          return { grants: newGrants };
        });
      },

      revokePermission: (skillId) => {
        set((state) => {
          const newGrants = new Map(state.grants);
          newGrants.delete(skillId);
          logger.info('Permission revoked:', { skillId });
          return { grants: newGrants };
        });
      },

      getPermissionGrant: (skillId) => {
        return get().grants.get(skillId);
      },

      hasPermission: (skillId, scriptPath, requestedLevel) => {
        const grant = get().grants.get(skillId);

        if (!grant) {
          return false;
        }

        // Check if permission level is sufficient
        if (!hasRequiredPermissionLevel(grant.level, requestedLevel)) {
          return false;
        }

        // If apply to all scripts, permission is granted
        if (grant.applyToAllScripts) {
          return true;
        }

        // Check if specific script is allowed
        if (grant.allowedScripts) {
          return grant.allowedScripts.includes(scriptPath);
        }

        return false;
      },

      requestPermission: (request) => {
        set((state) => {
          const newRequests = new Map(state.pendingRequests);
          newRequests.set(request.requestId, request);
          logger.info('Permission requested:', {
            requestId: request.requestId,
            skillId: request.skillId,
            scriptPath: request.scriptPath,
            level: request.requestedLevel,
          });
          return { pendingRequests: newRequests };
        });
      },

      getPendingRequest: (requestId) => {
        return get().pendingRequests.get(requestId);
      },

      decidePermission: (decision) => {
        const request = get().pendingRequests.get(decision.requestId);

        if (!request) {
          logger.warn('Permission request not found:', decision.requestId);
          return;
        }

        // Remove from pending
        set((state) => {
          const newRequests = new Map(state.pendingRequests);
          newRequests.delete(decision.requestId);
          return { pendingRequests: newRequests };
        });

        // If granted and remember is true, create a permission grant
        if (decision.granted && decision.remember && decision.level) {
          get().grantPermission({
            skillId: request.skillId,
            skillName: request.skillName,
            level: decision.level,
            grantedAt: decision.decidedAt,
            applyToAllScripts: true, // For now, apply to all scripts when remembered
            autoApprove: true,
          });
        }

        logger.info('Permission decided:', {
          requestId: decision.requestId,
          granted: decision.granted,
          remember: decision.remember,
        });
      },

      clearPendingRequests: () => {
        set({ pendingRequests: new Map() });
        logger.info('Cleared all pending permission requests');
      },

      getAllGrants: () => {
        return Array.from(get().grants.values());
      },
    }),
    {
      name: 'skill-permission-storage',
      // Custom serialization for Map
      partialize: (state) => ({
        grants: Array.from(state.grants.entries()),
      }),
      // Custom deserialization for Map
      merge: (persistedState, currentState) => {
        const persisted = persistedState as {
          grants?: Array<[string, SkillPermissionGrant]>;
        };
        return {
          ...currentState,
          grants: new Map(persisted.grants || []),
        };
      },
    }
  )
);
