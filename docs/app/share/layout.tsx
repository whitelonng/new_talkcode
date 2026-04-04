// docs/app/share/layout.tsx
// Minimal layout for share pages (not using fumadocs)

import type { ReactNode } from 'react';
import { ThemeProvider } from 'next-themes';
import './global.css';

export const metadata = {
  title: 'Shared Task | TalkCody',
  description: 'View a shared TalkCody task',
};

export default function ShareLayout({ children }: { children: ReactNode }) {
  return (
    <ThemeProvider
      attribute="class"
      forcedTheme="dark"
      storageKey="share-theme"
    >
      <div className="min-h-screen bg-gray-950 text-gray-100">
        {children}
      </div>
    </ThemeProvider>
  );
}
