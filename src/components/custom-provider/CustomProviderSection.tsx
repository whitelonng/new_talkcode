// src/components/custom-provider/CustomProviderSection.tsx

import { Edit, Loader2, Plus, Trash2 } from 'lucide-react';
import { useCallback, useEffect, useState } from 'react';
import { toast } from 'sonner';
import { AddCustomProviderDialog } from '@/components/custom-provider/AddCustomProviderDialog';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Switch } from '@/components/ui/switch';
import { useTranslation } from '@/hooks/use-locale';
import { customProviderService } from '@/providers/custom/custom-provider-service';
import { useProviderStore } from '@/providers/stores/provider-store';
import type { CustomProviderConfig } from '@/types/custom-provider';

export function CustomProviderSection() {
  const t = useTranslation();
  const [providers, setProviders] = useState<CustomProviderConfig[]>([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingProvider, setEditingProvider] = useState<CustomProviderConfig | undefined>();

  // Subscribe to provider store for custom providers to trigger re-renders
  const customProvidersFromStore = useProviderStore((state) => state.customProviders);

  const loadProviders = useCallback(async () => {
    try {
      const config = await customProviderService.getCustomProviders();
      setProviders(Object.values(config.providers));
    } catch (error) {
      console.error('Error loading providers:', error);
    } finally {
      setLoading(false);
    }
  }, []);

  // Initial load
  useEffect(() => {
    loadProviders();
  }, [loadProviders]);

  // Refresh when store changes
  useEffect(() => {
    if (customProvidersFromStore) {
      loadProviders();
    }
  }, [customProvidersFromStore, loadProviders]);

  const handleAdd = () => {
    setEditingProvider(undefined);
    setDialogOpen(true);
  };

  const handleEdit = (provider: CustomProviderConfig) => {
    setEditingProvider(provider);
    setDialogOpen(true);
  };

  const handleToggleEnabled = async (provider: CustomProviderConfig) => {
    try {
      // Use provider store to update - this handles persistence and rebuilding
      await useProviderStore.getState().updateCustomProvider(provider.id, {
        enabled: !provider.enabled,
      });
      toast.success(
        !provider.enabled
          ? t.CustomProviderSection.providerEnabled
          : t.CustomProviderSection.providerDisabled
      );
    } catch (_error) {
      toast.error(t.CustomProviderSection.updateFailed);
    }
  };

  const handleDelete = async (provider: CustomProviderConfig) => {
    if (!confirm(t.CustomProviderSection.deleteConfirm(provider.name))) {
      return;
    }

    try {
      // Use provider store to remove - this handles persistence and rebuilding
      await useProviderStore.getState().removeCustomProvider(provider.id);
      toast.success(t.CustomProviderSection.deleteSuccess);
    } catch (_error) {
      toast.error(t.CustomProviderSection.deleteFailed);
    }
  };

  const handleDialogClose = (open: boolean) => {
    setDialogOpen(open);
    if (!open) {
      setEditingProvider(undefined);
    }
  };

  const getProviderTypeLabel = (type: string) => {
    switch (type) {
      case 'openai-compatible':
        return 'OpenAI';
      case 'anthropic':
        return 'Anthropic';
      default:
        return type;
    }
  };

  return (
    <>
      <Card>
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="text-lg">{t.Settings.tabs.customProviders}</CardTitle>
              <CardDescription>{t.CustomProviderSection.description}</CardDescription>
            </div>
            <Button size="sm" onClick={handleAdd}>
              <Plus className="mr-2 h-4 w-4" />
              {t.Common.add}
            </Button>
          </div>
        </CardHeader>

        <CardContent>
          {loading ? (
            <div className="flex items-center justify-center py-4">
              <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
            </div>
          ) : providers.length === 0 ? (
            <div className="text-sm text-muted-foreground text-center py-4">
              {t.CustomProviderSection.noProviders}
            </div>
          ) : (
            <div className="space-y-2">
              {providers.map((provider) => (
                <div
                  key={provider.id}
                  className={`flex items-center justify-between rounded-md border p-3 ${
                    !provider.enabled ? 'opacity-60 bg-muted/30' : 'bg-muted/30'
                  }`}
                >
                  <div className="flex items-center gap-3 flex-1 min-w-0">
                    <Switch
                      checked={provider.enabled}
                      onCheckedChange={() => handleToggleEnabled(provider)}
                    />
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-medium truncate">{provider.name}</span>
                        <Badge variant="outline" className="text-xs">
                          {getProviderTypeLabel(provider.type)}
                        </Badge>
                      </div>
                      <div className="text-xs text-muted-foreground truncate">
                        {provider.baseUrl}
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center gap-1">
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => handleEdit(provider)}
                      className="h-8 w-8 p-0"
                    >
                      <Edit className="h-4 w-4" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => handleDelete(provider)}
                      className="h-8 w-8 p-0 text-destructive hover:text-destructive"
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      <AddCustomProviderDialog
        open={dialogOpen}
        onOpenChange={handleDialogClose}
        provider={editingProvider}
        onProviderSaved={loadProviders}
      />
    </>
  );
}
