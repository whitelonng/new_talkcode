import { useCustomToolPermissionStore } from '@/stores/custom-tool-permission-store';
import type { CustomToolPermission } from '@/types/custom-tool';

export interface PermissionCheckResult {
  allowed: boolean;
  missing: CustomToolPermission[];
}

export function checkCustomToolPermissions(
  toolName: string,
  requested: CustomToolPermission[]
): PermissionCheckResult {
  if (requested.length === 0) {
    return { allowed: true, missing: [] };
  }

  const grant = useCustomToolPermissionStore.getState().getGrant(toolName);
  if (!grant) {
    return { allowed: false, missing: requested };
  }

  const missing = requested.filter((permission) => !grant.permissions.includes(permission));
  if (missing.length > 0) {
    return { allowed: false, missing };
  }

  return { allowed: true, missing: [] };
}

export function ensureCustomToolPermissions(toolName: string, permissions: CustomToolPermission[]) {
  useCustomToolPermissionStore.getState().grantPermission(toolName, permissions);
}

export function revokeCustomToolPermissions(toolName: string) {
  useCustomToolPermissionStore.getState().revokePermission(toolName);
}
