/**
 * Utility functions for usage display formatting
 */

/**
 * Get reset time display for weekly usage
 * - If more than 24 hours away: show date and time (e.g., "01-09 10:00")
 * - If within 24 hours: show countdown (e.g., "23h 30m")
 *
 * @param resetAt ISO 8601 timestamp
 * @returns Formatted reset time string
 */
export function getWeeklyResetDisplay(resetAt: string): string {
  const resetTime = new Date(resetAt);
  const now = Date.now();
  const diffMs = resetTime.getTime() - now;

  if (diffMs <= 0) {
    return 'Resetting soon...';
  }

  const hours = Math.floor(diffMs / (1000 * 60 * 60));

  // If more than 24 hours, show date and time
  if (hours >= 24) {
    const month = String(resetTime.getMonth() + 1).padStart(2, '0');
    const day = String(resetTime.getDate()).padStart(2, '0');
    const hour = String(resetTime.getHours()).padStart(2, '0');
    const minute = String(resetTime.getMinutes()).padStart(2, '0');
    return `${month}-${day} ${hour}:${minute}`;
  }

  // If within 24 hours, show countdown
  const minutes = Math.floor((diffMs % (1000 * 60 * 60)) / (1000 * 60));
  if (hours > 0) {
    return `${hours}h ${minutes}m`;
  }
  return `${minutes}m`;
}

/**
 * Get usage level indicator
 *
 * @param utilizationPct Usage percentage (0-100)
 * @returns 'low' | 'medium' | 'high' | 'critical'
 */
export function getUsageLevel(utilizationPct: number): 'low' | 'medium' | 'high' | 'critical' {
  if (utilizationPct < 50) return 'low';
  if (utilizationPct < 75) return 'medium';
  if (utilizationPct < 90) return 'high';
  return 'critical';
}

/**
 * Calculate remaining percentage
 *
 * @param utilizationPct Usage percentage (0-100)
 * @returns Remaining percentage (0-100)
 */
export function getRemainingPercentage(utilizationPct: number): number {
  return Math.max(0, 100 - utilizationPct);
}

/**
 * Calculate time remaining until reset
 *
 * @param resetAt ISO 8601 timestamp
 * @returns Human-readable time remaining string (e.g., "5h 30m")
 */
export function getTimeUntilReset(resetAt: string): string {
  const resetTime = new Date(resetAt).getTime();
  const now = Date.now();
  const diffMs = resetTime - now;

  if (diffMs <= 0) {
    return 'Resetting soon...';
  }

  const hours = Math.floor(diffMs / (1000 * 60 * 60));
  const minutes = Math.floor((diffMs % (1000 * 60 * 60)) / (1000 * 60));

  if (hours > 0) {
    return `${hours}h ${minutes}m`;
  }
  return `${minutes}m`;
}
