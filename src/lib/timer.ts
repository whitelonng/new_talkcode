// utils/timer-decorator.ts
import { logger } from '@/lib/logger';

const IS_DEV = import.meta.env.DEV;

export function timedMethod(name?: string) {
  return <T extends (...args: any[]) => any>(
    target: any,
    propertyName: string | symbol,
    descriptor: TypedPropertyDescriptor<T>
  ): TypedPropertyDescriptor<T> | undefined => {
    if (!IS_DEV) {
      return descriptor;
    }

    if (!descriptor.value) {
      throw new Error('Method descriptor value is undefined');
    }
    const method = descriptor.value;
    const timerName = name || `${target.constructor.name}.${String(propertyName)}`;

    descriptor.value = function (this: any, ...args: any[]) {
      const uniqueName = `${timerName}_${Date.now()}_${Math.random().toString(36).substr(2, 5)}`;
      const startTime = performance.now();

      try {
        const result = method.apply(this, args);

        if (result instanceof Promise) {
          let timed = false;
          const endTiming = () => {
            if (!timed) {
              timed = true;
              const endTime = performance.now();
              logger.info(`[Timer] ${uniqueName}: ${(endTime - startTime).toFixed(3)}ms`);
            }
          };

          return result.finally(() => {
            endTiming();
          });
        }
        const endTime = performance.now();
        logger.info(`[Timer] ${uniqueName}: ${(endTime - startTime).toFixed(3)}ms`);
        return result;
      } catch (error) {
        const endTime = performance.now();
        logger.info(`[Timer] ${uniqueName}: ${(endTime - startTime).toFixed(3)}ms (error)`);
        throw error;
      }
    } as T;
  };
}
