import { DEFAULT_PROJECT } from '@/stores/settings-store';
import type { UtilityTab } from '@/stores/browser-store';
import { SidebarView } from '@/types/navigation';
import type { FullscreenPanel } from './types';

export const DEFAULT_SIDEBAR_VIEW = SidebarView.FILES;
export const DEFAULT_FULLSCREEN_PANEL: FullscreenPanel = 'none';
export const DEFAULT_UTILITY_TAB: UtilityTab = 'terminal';
export { DEFAULT_PROJECT };
