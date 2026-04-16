import { open } from '@tauri-apps/plugin-shell';
import {
  AppWindowMac,
  BookOpen,
  Bot,
  Code,
  FileCode,
  FileText,
  GitBranch,
  Github,
  Info,
  Key,
  Keyboard,
  Radar,
  Settings,
  Terminal,
  Type,
  User,
  Wrench,
  Zap,
} from 'lucide-react';
import { useEffect, useState } from 'react';
import { AboutSettings } from '@/components/settings/about-settings';
import { AccountSettings } from '@/components/settings/account-settings';
import { ApiKeysSettings } from '@/components/settings/api-keys-settings';
import { CustomToolsSettings } from '@/components/settings/custom-tools-settings';
import { FontSettings } from '@/components/settings/font-settings';
import { GeneralSettings } from '@/components/settings/general-settings';
import { HooksSettings } from '@/components/settings/hooks-settings';
import { LintSettings } from '@/components/settings/lint-settings';
import { LspSettings } from '@/components/settings/lsp-settings';
import { MemorySettings } from '@/components/settings/memory-settings';
import { ModelTypeSettings } from '@/components/settings/model-type-settings';
import { RemoteControlSettings } from '@/components/settings/remote-control-settings';
import { TerminalSettings } from '@/components/settings/terminal-settings';
import { TraySettings } from '@/components/settings/tray-settings';
import { WorktreeSettings } from '@/components/settings/worktree-settings';
import { ShortcutSettingsPanel } from '@/components/shortcuts/shortcut-settings';
import { Button } from '@/components/ui/button';
import { Separator } from '@/components/ui/separator';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useLocale } from '@/hooks/use-locale';
import { useTheme } from '@/hooks/use-theme';
import { cn } from '@/lib/utils';
import { LLMTracingPage } from '@/pages/llm-tracing-page';
import { LogsPage } from '@/pages/logs-page';
import ToolPlayground from '@/pages/tool-playground-page';

export function SettingsPage() {
  const [activeTab, setActiveTab] = useState('api-keys');
  const { t } = useLocale();
  const { themeVariant } = useTheme();

  useEffect(() => {
    const handleOpenModelSettings = () => {
      setActiveTab('models');
    };

    window.addEventListener('openModelSettingsTab', handleOpenModelSettings);
    return () => {
      window.removeEventListener('openModelSettingsTab', handleOpenModelSettings);
    };
  }, []);

  return (
    <div
      className={cn(
        'flex h-full',
        themeVariant === 'retroma' ? 'retroma-settings-shell' : 'bg-white dark:bg-gray-950'
      )}
    >
      <Tabs
        value={activeTab}
        onValueChange={setActiveTab}
        orientation="vertical"
        className={cn(
          'flex h-full w-full flex-row',
          themeVariant === 'retroma' && 'retroma-settings-layout'
        )}
      >
        <aside
          className={cn(
            'shrink-0 overflow-y-auto p-4',
            themeVariant === 'retroma'
              ? 'retroma-settings-sidebar w-64 border-r border-border'
              : 'w-56 border-r'
          )}
        >
          <TabsList
            className={cn(
              'flex h-auto w-full flex-col gap-1 bg-transparent',
              themeVariant === 'retroma' && 'retroma-settings-nav'
            )}
          >
            <TabsTrigger
              value="account"
              className={cn(
                'w-full justify-start gap-2 rounded-md px-3 py-2',
                themeVariant === 'retroma' && 'retroma-settings-nav-item'
              )}
            >
              <User className="size-4" />
              {t.Settings.tabs.account}
            </TabsTrigger>
            <TabsTrigger
              value="api-keys"
              className={cn(
                'w-full justify-start gap-2 rounded-md px-3 py-2',
                themeVariant === 'retroma' && 'retroma-settings-nav-item'
              )}
            >
              <Key className="size-4" />
              {t.Settings.tabs.apiKeys}
            </TabsTrigger>
            <TabsTrigger
              value="models"
              className={cn(
                'w-full justify-start gap-2 rounded-md px-3 py-2',
                themeVariant === 'retroma' && 'retroma-settings-nav-item'
              )}
            >
              <Bot className="size-4" />
              {t.Settings.tabs.models}
            </TabsTrigger>
            <TabsTrigger
              value="memory"
              className={cn(
                'w-full justify-start gap-2 rounded-md px-3 py-2',
                themeVariant === 'retroma' && 'retroma-settings-nav-item'
              )}
            >
              <BookOpen className="size-4" />
              {t.Settings.tabs.memory}
            </TabsTrigger>

            <Separator className="my-2" />

            <TabsTrigger
              value="general"
              className={cn(
                'w-full justify-start gap-2 rounded-md px-3 py-2',
                themeVariant === 'retroma' && 'retroma-settings-nav-item'
              )}
            >
              <Settings className="size-4" />
              {t.Settings.tabs.general || 'General'}
            </TabsTrigger>
            <TabsTrigger
              value="shortcuts"
              className={cn(
                'w-full justify-start gap-2 rounded-md px-3 py-2',
                themeVariant === 'retroma' && 'retroma-settings-nav-item'
              )}
            >
              <Keyboard className="size-4" />
              {t.Settings.tabs.shortcuts}
            </TabsTrigger>

            <Separator className="my-2" />

            <TabsTrigger
              value="terminal"
              className={cn(
                'w-full justify-start gap-2 rounded-md px-3 py-2',
                themeVariant === 'retroma' && 'retroma-settings-nav-item'
              )}
            >
              <Terminal className="size-4" />
              {t.Settings.tabs.terminal || 'Terminal'}
            </TabsTrigger>
            <TabsTrigger
              value="font"
              className={cn(
                'w-full justify-start gap-2 rounded-md px-3 py-2',
                themeVariant === 'retroma' && 'retroma-settings-nav-item'
              )}
            >
              <Type className="size-4" />
              {t.Settings.tabs.font || 'Font Size'}
            </TabsTrigger>
            <TabsTrigger
              value="lint"
              className={cn(
                'w-full justify-start gap-2 rounded-md px-3 py-2',
                themeVariant === 'retroma' && 'retroma-settings-nav-item'
              )}
            >
              <FileCode className="size-4" />
              {t.Settings.tabs.lint || 'Lint'}
            </TabsTrigger>
            <TabsTrigger
              value="lsp"
              className={cn(
                'w-full justify-start gap-2 rounded-md px-3 py-2',
                themeVariant === 'retroma' && 'retroma-settings-nav-item'
              )}
            >
              <Code className="size-4" />
              {t.Settings.tabs.lsp || 'LSP'}
            </TabsTrigger>
            <TabsTrigger
              value="worktree"
              className={cn(
                'w-full justify-start gap-2 rounded-md px-3 py-2',
                themeVariant === 'retroma' && 'retroma-settings-nav-item'
              )}
            >
              <GitBranch className="size-4" />
              {t.Settings.tabs.worktree || 'Worktree'}
            </TabsTrigger>
            <TabsTrigger
              value="tray"
              className={cn(
                'w-full justify-start gap-2 rounded-md px-3 py-2',
                themeVariant === 'retroma' && 'retroma-settings-nav-item'
              )}
            >
              <AppWindowMac className="size-4" />
              {t.Settings.tabs.tray || 'System Tray'}
            </TabsTrigger>
            <TabsTrigger
              value="custom-tools"
              className={cn(
                'w-full justify-start gap-2 rounded-md px-3 py-2',
                themeVariant === 'retroma' && 'retroma-settings-nav-item'
              )}
            >
              <Wrench className="size-4" />
              {t.Settings.tabs.customTools}
            </TabsTrigger>
            <TabsTrigger
              value="hooks"
              className={cn(
                'w-full justify-start gap-2 rounded-md px-3 py-2',
                themeVariant === 'retroma' && 'retroma-settings-nav-item'
              )}
            >
              <Zap className="size-4" />
              {t.Settings.tabs.hooks}
            </TabsTrigger>

            <Separator className="my-2" />

            <TabsTrigger
              value="remote-control"
              className={cn(
                'w-full justify-start gap-2 rounded-md px-3 py-2',
                themeVariant === 'retroma' && 'retroma-settings-nav-item'
              )}
            >
              <Bot className="size-4" />
              {t.Settings.tabs.remoteControl || 'Remote Control'}
            </TabsTrigger>
            <TabsTrigger
              value="logs"
              className={cn(
                'w-full justify-start gap-2 rounded-md px-3 py-2',
                themeVariant === 'retroma' && 'retroma-settings-nav-item'
              )}
            >
              <FileText className="size-4" />
              {t.Settings.tabs.logs}
            </TabsTrigger>
            <TabsTrigger
              value="tools-playground"
              className={cn(
                'w-full justify-start gap-2 rounded-md px-3 py-2',
                themeVariant === 'retroma' && 'retroma-settings-nav-item'
              )}
            >
              <Wrench className="size-4" />
              {t.Settings.tabs.toolsPlayground}
            </TabsTrigger>
            <TabsTrigger
              value="tracing"
              className={cn(
                'w-full justify-start gap-2 rounded-md px-3 py-2',
                themeVariant === 'retroma' && 'retroma-settings-nav-item'
              )}
            >
              <Radar className="size-4" />
              {t.Settings.tabs.tracing}
            </TabsTrigger>
            <TabsTrigger
              value="github"
              className={cn(
                'w-full justify-start gap-2 rounded-md px-3 py-2',
                themeVariant === 'retroma' && 'retroma-settings-nav-item'
              )}
            >
              <Github className="size-4" />
              {t.Settings.tabs.github}
            </TabsTrigger>
            <TabsTrigger
              value="about"
              className={cn(
                'w-full justify-start gap-2 rounded-md px-3 py-2',
                themeVariant === 'retroma' && 'retroma-settings-nav-item'
              )}
            >
              <Info className="size-4" />
              {t.Settings.tabs.about}
            </TabsTrigger>
          </TabsList>
        </aside>

        <main
          className={cn(
            'flex-1 overflow-y-auto',
            themeVariant === 'retroma' ? 'retroma-settings-main' : 'p-6'
          )}
        >
          <div className={cn(themeVariant === 'retroma' ? 'mx-auto max-w-[1040px]' : 'max-w-5xl')}>
            <TabsContent value="account" className="mt-0 flex-none space-y-6">
              <AccountSettings />
            </TabsContent>
            <TabsContent value="api-keys" className="mt-0 flex-none space-y-6">
              <ApiKeysSettings />
            </TabsContent>
            <TabsContent value="models" className="mt-0 flex-none space-y-6">
              <ModelTypeSettings />
            </TabsContent>
            <TabsContent value="memory" className="mt-0 flex-none space-y-6">
              <MemorySettings />
            </TabsContent>
            <TabsContent value="terminal" className="mt-0 flex-none space-y-6">
              <TerminalSettings />
            </TabsContent>
            <TabsContent value="font" className="mt-0 flex-none space-y-6">
              <FontSettings />
            </TabsContent>
            <TabsContent value="lint" className="mt-0 flex-none space-y-6">
              <LintSettings />
            </TabsContent>
            <TabsContent value="lsp" className="mt-0 flex-none space-y-6">
              <LspSettings />
            </TabsContent>
            <TabsContent value="worktree" className="mt-0 flex-none space-y-6">
              <WorktreeSettings />
            </TabsContent>
            <TabsContent value="tray" className="mt-0 flex-none space-y-6">
              <TraySettings />
            </TabsContent>
            <TabsContent value="custom-tools" className="mt-0 flex-none space-y-6">
              <CustomToolsSettings />
            </TabsContent>
            <TabsContent value="hooks" className="mt-0 flex-none space-y-6">
              <HooksSettings />
            </TabsContent>
            <TabsContent value="shortcuts" className="mt-0 flex-none space-y-6">
              <ShortcutSettingsPanel />
            </TabsContent>
            <TabsContent value="general" className="mt-0 flex-none space-y-6">
              <GeneralSettings />
            </TabsContent>
            <TabsContent value="remote-control" className="mt-0 flex-none space-y-6">
              <RemoteControlSettings />
            </TabsContent>
            <TabsContent
              value="logs"
              className="mt-0 h-[calc(100vh-8rem)] flex-none space-y-6 overflow-auto"
            >
              <LogsPage />
            </TabsContent>
            <TabsContent
              value="tools-playground"
              className="mt-0 h-[calc(100vh-8rem)] flex-none space-y-6 overflow-auto"
            >
              <ToolPlayground />
            </TabsContent>
            <TabsContent
              value="tracing"
              className="mt-0 h-[calc(100vh-8rem)] flex-none space-y-6 overflow-auto"
            >
              <LLMTracingPage />
            </TabsContent>
            <TabsContent value="github" className="mt-0 flex-none space-y-6">
              <div className="rounded-lg border p-6">
                <div className="mb-3 flex items-center gap-2 text-lg font-semibold">
                  <Github className="size-5" />
                  {t.Settings.tabs.github}
                </div>
                <p className="mb-4 text-sm text-muted-foreground">
                  https://github.com/whitelonng/Talkcody
                </p>
                <Button onClick={() => open('https://github.com/whitelonng/Talkcody')}>
                  {t.Common.open}
                </Button>
              </div>
            </TabsContent>
            <TabsContent value="about" className="mt-0 flex-none space-y-6">
              <AboutSettings />
            </TabsContent>
          </div>
        </main>
      </Tabs>
    </div>
  );
}
