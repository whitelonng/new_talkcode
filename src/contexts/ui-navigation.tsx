import type React from 'react';
import { createContext, useCallback, useContext, useMemo, useState } from 'react';
import { NavigationView } from '@/types/navigation';

type UiNavigationContextValue = {
  activeView: NavigationView;
  setActiveView: (view: NavigationView) => void;
  agentListOpen: boolean;
  openAgentList: (onCreated?: (agentId: string) => void) => void;
  closeAgentList: () => void;
  setAgentListOpen: (open: boolean) => void;
  onAgentCreated?: (agentId: string) => void;
};

const UiNavigationContext = createContext<UiNavigationContextValue | undefined>(undefined);

export function UiNavigationProvider({ children }: { children: React.ReactNode }) {
  const [activeView, setActiveView] = useState<NavigationView>(NavigationView.EXPLORER);
  const [agentListOpen, setAgentListOpen] = useState(false);
  const [onAgentCreated, setOnAgentCreated] = useState<((agentId: string) => void) | undefined>(
    undefined
  );

  const openAgentList = useCallback((cb?: (agentId: string) => void) => {
    setOnAgentCreated(() => cb);
    setAgentListOpen(true);
  }, []);

  const closeAgentList = useCallback(() => {
    setAgentListOpen(false);
    setOnAgentCreated(undefined);
  }, []);

  const value = useMemo(
    () => ({
      activeView,
      setActiveView,
      agentListOpen,
      openAgentList,
      closeAgentList,
      setAgentListOpen,
      onAgentCreated,
    }),
    [activeView, agentListOpen, openAgentList, closeAgentList, onAgentCreated]
  );

  return <UiNavigationContext.Provider value={value}>{children}</UiNavigationContext.Provider>;
}

export function useUiNavigation() {
  const ctx = useContext(UiNavigationContext);
  if (!ctx) throw new Error('useUiNavigation must be used within UiNavigationProvider');
  return ctx;
}
