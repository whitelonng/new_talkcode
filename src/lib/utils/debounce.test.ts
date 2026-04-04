import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { debounce } from './debounce';

describe('debounce', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('should delay function execution', () => {
    const func = vi.fn();
    const debouncedFunc = debounce(func, 100);

    debouncedFunc();
    expect(func).not.toHaveBeenCalled();

    vi.advanceTimersByTime(100);
    expect(func).toHaveBeenCalledTimes(1);
  });

  it('should only call once for multiple rapid calls', () => {
    const func = vi.fn();
    const debouncedFunc = debounce(func, 100);

    debouncedFunc();
    debouncedFunc();
    debouncedFunc();
    debouncedFunc();
    debouncedFunc();

    vi.advanceTimersByTime(100);
    expect(func).toHaveBeenCalledTimes(1);
  });

  it('should reset timer on each call', () => {
    const func = vi.fn();
    const debouncedFunc = debounce(func, 100);

    debouncedFunc();
    vi.advanceTimersByTime(50);

    debouncedFunc();
    vi.advanceTimersByTime(50);

    // 100ms from first call, but only 50ms from second call
    expect(func).not.toHaveBeenCalled();

    vi.advanceTimersByTime(50);
    expect(func).toHaveBeenCalledTimes(1);
  });

  it('should pass arguments to the debounced function', () => {
    const func = vi.fn();
    const debouncedFunc = debounce(func, 100);

    debouncedFunc('arg1', 'arg2');
    vi.advanceTimersByTime(100);

    expect(func).toHaveBeenCalledWith('arg1', 'arg2');
  });

  it('should use latest arguments when called multiple times', () => {
    const func = vi.fn();
    const debouncedFunc = debounce(func, 100);

    debouncedFunc('first');
    debouncedFunc('second');
    debouncedFunc('third');

    vi.advanceTimersByTime(100);

    expect(func).toHaveBeenCalledTimes(1);
    expect(func).toHaveBeenCalledWith('third');
  });

  it('should allow cancellation', () => {
    const func = vi.fn();
    const debouncedFunc = debounce(func, 100);

    debouncedFunc();
    vi.advanceTimersByTime(50);

    debouncedFunc.cancel();

    vi.advanceTimersByTime(100);
    expect(func).not.toHaveBeenCalled();
  });

  it('should allow multiple independent debounced calls after delay', () => {
    const func = vi.fn();
    const debouncedFunc = debounce(func, 100);

    debouncedFunc('first batch');
    vi.advanceTimersByTime(100);
    expect(func).toHaveBeenCalledTimes(1);
    expect(func).toHaveBeenLastCalledWith('first batch');

    debouncedFunc('second batch');
    vi.advanceTimersByTime(100);
    expect(func).toHaveBeenCalledTimes(2);
    expect(func).toHaveBeenLastCalledWith('second batch');
  });

  it('should handle zero wait time', () => {
    const func = vi.fn();
    const debouncedFunc = debounce(func, 0);

    debouncedFunc();
    expect(func).not.toHaveBeenCalled();

    vi.advanceTimersByTime(0);
    expect(func).toHaveBeenCalledTimes(1);
  });

  it('should not throw when cancel is called without pending timeout', () => {
    const func = vi.fn();
    const debouncedFunc = debounce(func, 100);

    expect(() => debouncedFunc.cancel()).not.toThrow();
  });

  it('should handle cancel being called multiple times', () => {
    const func = vi.fn();
    const debouncedFunc = debounce(func, 100);

    debouncedFunc();
    debouncedFunc.cancel();
    debouncedFunc.cancel();
    debouncedFunc.cancel();

    vi.advanceTimersByTime(100);
    expect(func).not.toHaveBeenCalled();
  });
});
