/**
 * Creates a throttled function that invokes func at most once per wait interval.
 * Includes a cancel method to clear any pending invocation.
 */
export function throttle<T extends (...args: unknown[]) => void>(
  func: T,
  wait: number
): { (...args: Parameters<T>): void; cancel: () => void } {
  let lastCall = 0;
  let timeoutId: ReturnType<typeof setTimeout> | null = null;
  let pendingArgs: Parameters<T> | null = null;

  const invoke = (args: Parameters<T>) => {
    lastCall = Date.now();
    func(...args);
  };

  const throttled = (...args: Parameters<T>) => {
    const now = Date.now();
    const remaining = wait - (now - lastCall);
    pendingArgs = args;

    if (remaining <= 0 || lastCall === 0) {
      if (timeoutId) {
        clearTimeout(timeoutId);
        timeoutId = null;
      }
      const callArgs = pendingArgs;
      pendingArgs = null;
      if (callArgs) {
        invoke(callArgs);
      }
      return;
    }

    if (!timeoutId) {
      timeoutId = setTimeout(() => {
        timeoutId = null;
        if (pendingArgs) {
          const callArgs = pendingArgs;
          pendingArgs = null;
          invoke(callArgs);
        }
      }, remaining);
    }
  };

  throttled.cancel = () => {
    if (timeoutId) {
      clearTimeout(timeoutId);
      timeoutId = null;
    }
    pendingArgs = null;
  };

  return throttled;
}
