import type React from 'react';

export function useWindowContext() {
  return {
    windowLabel: 'main',
    isMainWindow: true,
  };
}

export function WindowProvider({ children }: { children: React.ReactNode }) {
  return children;
}
