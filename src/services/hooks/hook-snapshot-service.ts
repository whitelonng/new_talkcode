import { hookConfigService } from '@/services/hooks/hook-config-service';
import { hookStateService } from '@/services/hooks/hook-state-service';
import { settingsManager } from '@/stores/settings-store';

export class HookSnapshotService {
  async initializeSession(): Promise<void> {
    hookStateService.resetSession();
    await hookConfigService.loadConfigs();
    const enabled = settingsManager.getHooksEnabled();
    hookStateService.setHooksEnabled(enabled);
  }

  async refreshEnabledState(): Promise<void> {
    const enabled = settingsManager.getHooksEnabled();
    hookStateService.setHooksEnabled(enabled);
  }
}

export const hookSnapshotService = new HookSnapshotService();
