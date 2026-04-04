// src/lib/utils/path-security.ts
import { normalize } from '@tauri-apps/api/path';
import { logger } from '@/lib/logger';

/**
 * Check if a path is within the allowed project directory
 * @param targetPath - The path to check
 * @param allowedRootPath - The root path that is allowed
 * @returns true if the path is within the allowed directory, false otherwise
 */
export async function isPathWithinProjectDirectory(
  targetPath: string,
  allowedRootPath: string
): Promise<boolean> {
  try {
    // Normalize both paths to handle different separators and resolve '..'
    const normalizedTarget = await normalize(targetPath);
    const normalizedRoot = await normalize(allowedRootPath);

    // Convert to forward slashes for consistent comparison
    const normalizedTargetForward = normalizedTarget.replace(/\\/g, '/');
    const normalizedRootForward = normalizedRoot.replace(/\\/g, '/');

    // Ensure root path ends with a slash for proper prefix matching
    const rootWithSlash = normalizedRootForward.endsWith('/')
      ? normalizedRootForward
      : `${normalizedRootForward}/`;

    // Check if target path starts with the root path
    if (
      !normalizedTargetForward.startsWith(rootWithSlash) &&
      normalizedTargetForward !== normalizedRootForward
    ) {
      return false;
    }

    // Additional check: ensure path traversal attempts are caught
    // Split paths and verify no directory traversal
    const targetParts = normalizedTargetForward.split('/').filter((part) => part !== '');
    const rootParts = normalizedRootForward.split('/').filter((part) => part !== '');

    // Check for any relative path components that could escape
    for (const part of targetParts) {
      if (part === '..' || part === '.') {
        return false;
      }
    }

    // Verify the target path has the same root as the allowed path
    if (targetParts.length < rootParts.length) {
      return false;
    }

    // Check that the root path components match
    for (let i = 0; i < rootParts.length; i++) {
      if (targetParts[i] !== rootParts[i]) {
        return false;
      }
    }

    return true;
  } catch (error) {
    logger.error('Error checking path security:', error);
    return false;
  }
}

/**
 * Create a security error message for unauthorized path access
 * @param targetPath - The path that was attempted
 * @param allowedRootPath - The allowed root path
 * @returns A descriptive error message
 */
export function createPathSecurityError(targetPath: string, allowedRootPath: string): string {
  return `Security Error: File path "${targetPath}" is outside the allowed project directory "${allowedRootPath}". Files can only be written within the current project directory.`;
}
