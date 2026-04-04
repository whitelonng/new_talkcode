import { render } from '@testing-library/react';
import { describe, it, expect, vi, beforeAll, afterAll, afterEach } from 'vitest';
import InfiniteScroll from './infinite-scroll';

class MockIntersectionObserver {
  public callback: IntersectionObserverCallback;
  public options?: IntersectionObserverInit;
  public observe = vi.fn();
  public unobserve = vi.fn();
  public disconnect = vi.fn();
  public takeRecords = vi.fn(() => []);

  constructor(callback: IntersectionObserverCallback, options?: IntersectionObserverInit) {
    this.callback = callback;
    this.options = options;
    MockIntersectionObserver.lastInstance = this;
  }

  trigger(entries: IntersectionObserverEntry[] = []) {
    this.callback(entries, this as unknown as IntersectionObserver);
  }

  static lastInstance: MockIntersectionObserver | null = null;
}

const originalIntersectionObserver = globalThis.IntersectionObserver;

beforeAll(() => {
  (globalThis as Record<string, unknown>).IntersectionObserver =
    MockIntersectionObserver as unknown as typeof IntersectionObserver;
});

afterAll(() => {
  (globalThis as Record<string, unknown>).IntersectionObserver = originalIntersectionObserver;
});

afterEach(() => {
  MockIntersectionObserver.lastInstance = null;
  vi.clearAllMocks();
});

describe('InfiniteScroll', () => {
  it('invokes next when the observed element intersects', () => {
    const next = vi.fn();
    render(
      <InfiniteScroll isLoading={false} hasMore next={next}>
        <div>Item</div>
      </InfiniteScroll>
    );

    expect(MockIntersectionObserver.lastInstance).toBeTruthy();
    MockIntersectionObserver.lastInstance?.trigger([
      { isIntersecting: true } as IntersectionObserverEntry,
    ]);

    expect(next).toHaveBeenCalledTimes(1);
  });

  it('ignores callbacks that provide no entries', () => {
    const next = vi.fn();
    render(
      <InfiniteScroll isLoading={false} hasMore next={next}>
        <div>Item</div>
      </InfiniteScroll>
    );

    expect(MockIntersectionObserver.lastInstance).toBeTruthy();
    MockIntersectionObserver.lastInstance?.trigger([]);

    expect(next).not.toHaveBeenCalled();
  });
});
