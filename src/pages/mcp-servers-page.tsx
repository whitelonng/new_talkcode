import {
  ChevronDown,
  Edit2,
  Minus,
  Plus,
  Power,
  PowerOff,
  RefreshCw,
  Server,
  Trash2,
} from 'lucide-react';
import { useId, useState } from 'react';
import { Alert, AlertDescription } from '@/components/ui/alert';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { HelpTooltip } from '@/components/ui/help-tooltip';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { useTranslation } from '@/hooks/use-locale';
import { useMultiMCPTools } from '@/hooks/use-multi-mcp-tools';
import { getDocLinks } from '@/lib/doc-links';
import { logger } from '@/lib/logger';
import { TransportFactory } from '@/lib/mcp/transport-factory';
import {
  type CreateMCPServerData,
  databaseService,
  type MCPServer,
  type UpdateMCPServerData,
} from '@/services/database-service';

interface EnvVarItem {
  key: string;
  value: string;
}

interface MCPServerFormData {
  id: string;
  name: string;
  url: string;
  protocol: 'http' | 'sse' | 'stdio';
  api_key?: string;
  headers?: string; // JSON string
  stdio_command?: string;
  stdio_args?: string; // JSON string
  stdio_env: EnvVarItem[]; // Array of key-value pairs for UI
}

// Convert Record<string, string> to EnvVarItem[]
const envRecordToArray = (env: Record<string, string> | undefined): EnvVarItem[] => {
  if (!env) return [];
  return Object.entries(env).map(([key, value]) => ({ key, value }));
};

// Convert EnvVarItem[] to Record<string, string>
const envArrayToRecord = (items: EnvVarItem[]): Record<string, string> => {
  const record: Record<string, string> = {};
  for (const item of items) {
    if (item.key.trim()) {
      record[item.key.trim()] = item.value;
    }
  }
  return record;
};

// Check if this is a MiniMax Coding Plan MCP server
const isMinimaxCodingPlanServer = (formData: MCPServerFormData): boolean => {
  // Check by args containing minimax-coding-plan-mcp
  if (formData.stdio_args) {
    try {
      const args = JSON.parse(formData.stdio_args);
      if (Array.isArray(args) && args.some((arg) => arg.includes('minimax-coding-plan'))) {
        return true;
      }
    } catch {
      // Ignore parse errors
    }
  }
  // Check by ID
  if (formData.id.toLowerCase().includes('minimax')) {
    return true;
  }
  return false;
};

const MINIMAX_DEFAULT_HOST = 'https://api.minimaxi.com';

// Check if this is a GLM Coding Plan Vision MCP server (stdio)
const isGLMCodingPlanVisionServer = (formData: MCPServerFormData): boolean => {
  // Check by args containing @z_ai/mcp-server
  if (formData.stdio_args) {
    try {
      const args = JSON.parse(formData.stdio_args);
      if (Array.isArray(args) && args.some((arg) => arg.includes('@z_ai/mcp-server'))) {
        return true;
      }
    } catch {
      // Ignore parse errors
    }
  }
  // Check by ID
  if (formData.id === 'glm-coding-plan-vision') {
    return true;
  }
  return false;
};

// Check if this is a GLM Coding Plan HTTP server (Search or Reader)
const isGLMCodingPlanHttpServer = (formData: MCPServerFormData): boolean => {
  // Check by URL containing bigmodel.cn
  if (formData.url?.includes('open.bigmodel.cn/api/mcp/')) {
    return true;
  }
  // Check by ID
  if (formData.id === 'glm-coding-plan-search' || formData.id === 'glm-coding-plan-reader') {
    return true;
  }
  return false;
};

export function MCPServersPage() {
  // Generate unique IDs for form fields
  const createIdId = useId();
  const createNameId = useId();
  const createUrlId = useId();
  const createApiKeyId = useId();
  const createHeadersId = useId();
  const createCommandId = useId();
  const createArgsId = useId();
  const createEnvId = useId();
  const editIdId = useId();
  const editNameId = useId();
  const editUrlId = useId();
  const editApiKeyId = useId();
  const editHeadersId = useId();
  const editCommandId = useId();
  const editArgsId = useId();
  const editEnvId = useId();

  const t = useTranslation();

  const {
    servers,
    isLoading,
    error,
    refreshTools,
    refreshServer,
    enableServer,
    disableServer,
    reloadData,
  } = useMultiMCPTools();

  // Check if there are any enabled servers
  const hasEnabledServers = servers.some((serverData) => serverData.server.is_enabled);

  const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false);
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false);
  const [editingServer, setEditingServer] = useState<MCPServer | null>(null);
  const [serverToDelete, setServerToDelete] = useState<MCPServer | null>(null);
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);
  const [formData, setFormData] = useState<MCPServerFormData>({
    id: '',
    name: '',
    url: '',
    protocol: 'http',
    stdio_env: [],
  });
  const [formError, setFormError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const resetForm = () => {
    setFormData({
      id: '',
      name: '',
      url: '',
      protocol: 'http',
      stdio_env: [],
    });
    setFormError(null);
  };

  const openCreateDialog = () => {
    resetForm();
    setIsCreateDialogOpen(true);
  };

  const openEditDialog = (server: MCPServer) => {
    setEditingServer(server);

    // For GLM HTTP servers, extract API key from Authorization header
    let apiKey = server.api_key || '';
    let headersJson = JSON.stringify(server.headers || {}, null, 2);
    const isGLMHttp =
      server.url?.includes('open.bigmodel.cn/api/mcp/') ||
      server.id === 'glm-coding-plan-search' ||
      server.id === 'glm-coding-plan-reader';

    if (isGLMHttp && server.headers?.Authorization) {
      const authHeader = server.headers.Authorization;
      if (authHeader.startsWith('Bearer ')) {
        apiKey = authHeader.substring(7); // Extract token after "Bearer "
      }
      // Clear headers display for GLM servers since we use API key field
      headersJson = '{}';
    }

    setFormData({
      id: server.id,
      name: server.name,
      url: server.url,
      protocol: server.protocol,
      api_key: apiKey,
      headers: headersJson,
      stdio_command: server.stdio_command || '',
      stdio_args: JSON.stringify(server.stdio_args || [], null, 2),
      stdio_env: envRecordToArray(server.stdio_env),
    });
    setFormError(null);
    setIsEditDialogOpen(true);
  };

  const validateForm = (): boolean => {
    if (!formData.id.trim()) {
      setFormError(t.MCPServers.validation.serverIdRequired);
      return false;
    }

    if (!formData.name.trim()) {
      setFormError(t.MCPServers.validation.nameRequired);
      return false;
    }

    // Validate protocol-specific fields
    if (formData.protocol === 'stdio') {
      if (!formData.stdio_command?.trim()) {
        setFormError(t.MCPServers.validation.commandRequired);
        return false;
      }
    } else {
      if (!formData.url.trim()) {
        setFormError(t.MCPServers.validation.urlRequired);
        return false;
      }

      try {
        new URL(formData.url);
      } catch {
        setFormError(t.MCPServers.validation.invalidUrl);
        return false;
      }
    }

    // Validate JSON fields
    if (formData.headers?.trim()) {
      try {
        JSON.parse(formData.headers);
      } catch {
        setFormError(t.MCPServers.validation.invalidHeaders);
        return false;
      }
    }

    if (formData.stdio_args?.trim()) {
      try {
        const args = JSON.parse(formData.stdio_args);
        if (!Array.isArray(args)) {
          setFormError(t.MCPServers.validation.argumentsMustBeArray);
          return false;
        }
      } catch {
        setFormError(t.MCPServers.validation.invalidArguments);
        return false;
      }
    }

    // Validate env vars - check for duplicate keys
    const envKeys = formData.stdio_env.map((item) => item.key.trim()).filter((key) => key);
    const uniqueKeys = new Set(envKeys);
    if (envKeys.length !== uniqueKeys.size) {
      setFormError(t.MCPServers.validation.duplicateEnvVarKey);
      return false;
    }

    return true;
  };

  const handleCreateServer = async () => {
    if (!validateForm()) return;

    setIsSubmitting(true);
    try {
      let envRecord = envArrayToRecord(formData.stdio_env);

      // For MiniMax servers, ensure MINIMAX_API_HOST is set with default value if not provided
      if (isMinimaxCodingPlanServer(formData) && !envRecord.MINIMAX_API_HOST) {
        envRecord = { ...envRecord, MINIMAX_API_HOST: MINIMAX_DEFAULT_HOST };
      }

      const serverData: CreateMCPServerData = {
        id: formData.id.trim(),
        name: formData.name.trim(),
        url: formData.url.trim(),
        protocol: formData.protocol,
        api_key: formData.api_key?.trim() || undefined,
        headers: formData.headers?.trim() ? JSON.parse(formData.headers) : undefined,
        stdio_command: formData.stdio_command?.trim() || undefined,
        stdio_args: formData.stdio_args?.trim() ? JSON.parse(formData.stdio_args) : undefined,
        stdio_env: Object.keys(envRecord).length > 0 ? envRecord : undefined,
        is_enabled: true,
        is_built_in: false,
      };

      await databaseService.createMCPServer(serverData);
      await reloadData();
      setIsCreateDialogOpen(false);
      resetForm();

      logger.info(`Created MCP server: ${serverData.id}`);
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Failed to create server';
      setFormError(message);
      logger.error('Failed to create MCP server:', error);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleUpdateServer = async () => {
    if (!editingServer || !validateForm()) return;

    setIsSubmitting(true);
    try {
      let envRecord = envArrayToRecord(formData.stdio_env);

      // For MiniMax servers, ensure MINIMAX_API_HOST is set with default value if not provided
      if (isMinimaxCodingPlanServer(formData) && !envRecord.MINIMAX_API_HOST) {
        envRecord = { ...envRecord, MINIMAX_API_HOST: MINIMAX_DEFAULT_HOST };
      }

      // For GLM HTTP servers, convert API key to Authorization header
      let headers: Record<string, string> | undefined;
      if (isGLMCodingPlanHttpServer(formData) && formData.api_key?.trim()) {
        headers = { Authorization: `Bearer ${formData.api_key.trim()}` };
      } else if (formData.headers?.trim()) {
        headers = JSON.parse(formData.headers);
      }

      const updateData: UpdateMCPServerData = {
        name: formData.name.trim(),
        url: formData.url.trim(),
        protocol: formData.protocol,
        api_key: isGLMCodingPlanHttpServer(formData)
          ? undefined
          : formData.api_key?.trim() || undefined,
        headers,
        stdio_command: formData.stdio_command?.trim() || undefined,
        stdio_args: formData.stdio_args?.trim() ? JSON.parse(formData.stdio_args) : undefined,
        stdio_env: Object.keys(envRecord).length > 0 ? envRecord : undefined,
      };

      await databaseService.updateMCPServer(editingServer.id, updateData);
      await refreshServer(editingServer.id);
      await reloadData();
      setIsEditDialogOpen(false);
      setEditingServer(null);

      logger.info(`Updated MCP server: ${editingServer.id}`);
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Failed to update server';
      setFormError(message);
      logger.error('Failed to update MCP server:', error);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDeleteServer = (server: MCPServer) => {
    if (server.is_built_in) {
      alert(t.MCPServersExtra.alerts.cannotDeleteBuiltIn);
      return;
    }

    setServerToDelete(server);
    setIsDeleteDialogOpen(true);
  };

  const confirmDeleteServer = async () => {
    if (!serverToDelete) return;

    try {
      await databaseService.deleteMCPServer(serverToDelete.id);
      await reloadData();

      logger.info(`Deleted MCP server: ${serverToDelete.id}`);
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Failed to delete server';
      alert(t.MCPServersExtra.alerts.operationFailed(message));
      logger.error('Failed to delete MCP server:', error);
    } finally {
      setServerToDelete(null);
      setIsDeleteDialogOpen(false);
    }
  };

  const handleToggleServer = async (server: MCPServer) => {
    try {
      if (server.is_enabled) {
        await disableServer(server.id);
      } else {
        await enableServer(server.id);
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Failed to toggle server';
      alert(t.MCPServersExtra.alerts.operationFailed(message));
      logger.error('Failed to toggle MCP server:', error);
    }
  };

  const supportedProtocols = TransportFactory.getSupportedProtocols();

  return (
    <div className="flex h-full flex-col bg-white dark:bg-gray-950">
      {/* Header */}
      <div className="flex items-center justify-between border-b px-6 py-4">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-2xl font-bold">{t.MCPServers.title}</h1>
            <HelpTooltip
              title={t.MCPServers.tooltipTitle}
              description={t.MCPServers.tooltipDescription}
              docUrl={getDocLinks().features.mcpServers}
            />
          </div>
          <p className="text-gray-600 dark:text-gray-400 mt-1">{t.MCPServers.description}</p>
        </div>
        <div className="flex items-center gap-2">
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                variant="outline"
                size="sm"
                onClick={refreshTools}
                disabled={isLoading || !hasEnabledServers}
                className={!hasEnabledServers ? 'opacity-50 cursor-not-allowed' : ''}
              >
                <RefreshCw className={`h-4 w-4 mr-2 ${isLoading ? 'animate-spin' : ''}`} />
                {t.MCPServers.refreshAll}
              </Button>
            </TooltipTrigger>
            {!hasEnabledServers && (
              <TooltipContent>
                <p>{t.MCPServers.refreshAllTooltip}</p>
              </TooltipContent>
            )}
          </Tooltip>
          <Button size="sm" onClick={openCreateDialog}>
            <Plus className="h-4 w-4 mr-2" />
            {t.MCPServers.addServer}
          </Button>
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto">
        <div className="mx-auto max-w-6xl p-6">
          {/* Error Alert */}
          {error && (
            <Alert className="mb-6 border-red-200 bg-red-50 text-red-800">
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          )}

          {/* Servers Grid */}
          <div className="grid gap-4">
            {servers.map((serverData) => (
              <Card key={serverData.server.id} className="relative">
                <CardHeader className="pb-3">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <Server className="h-5 w-5" />
                      <div>
                        <CardTitle className="text-lg">{serverData.server.name}</CardTitle>
                        <p className="text-sm text-gray-600 dark:text-gray-400">
                          {serverData.server.url || `Command: ${serverData.server.stdio_command}`}
                        </p>
                      </div>
                    </div>

                    <div className="flex items-center gap-2">
                      {/* Status Badges */}
                      {serverData.server.is_built_in && (
                        <Badge variant="secondary">{t.MCPServers.builtIn}</Badge>
                      )}

                      <Badge
                        variant={serverData.server.protocol === 'http' ? 'default' : 'outline'}
                      >
                        {serverData.server.protocol.toUpperCase()}
                      </Badge>

                      {serverData.isConnected ? (
                        <Badge className="bg-green-100 text-green-800">
                          {t.MCPServers.connected(serverData.toolCount)}
                        </Badge>
                      ) : (
                        <Badge variant="destructive">{t.MCPServers.disconnected}</Badge>
                      )}

                      {/* Action Buttons */}
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={() => refreshServer(serverData.server.id)}
                            disabled={isLoading}
                          >
                            <RefreshCw className={`h-4 w-4 ${isLoading ? 'animate-spin' : ''}`} />
                          </Button>
                        </TooltipTrigger>
                        <TooltipContent>
                          <p>{t.MCPServers.refreshConnection}</p>
                        </TooltipContent>
                      </Tooltip>

                      <Tooltip>
                        <TooltipTrigger asChild>
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={() => handleToggleServer(serverData.server)}
                            disabled={isLoading}
                          >
                            {serverData.server.is_enabled ? (
                              <Power className="h-4 w-4 text-green-600" />
                            ) : (
                              <PowerOff className="h-4 w-4 text-gray-400" />
                            )}
                          </Button>
                        </TooltipTrigger>
                        <TooltipContent>
                          <p>
                            {serverData.server.is_enabled
                              ? t.MCPServers.disableServer
                              : t.MCPServers.enableServer}
                          </p>
                        </TooltipContent>
                      </Tooltip>

                      <Tooltip>
                        <TooltipTrigger asChild>
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={() => openEditDialog(serverData.server)}
                            disabled={isLoading}
                          >
                            <Edit2 className="h-4 w-4" />
                          </Button>
                        </TooltipTrigger>
                        <TooltipContent>
                          <p>{t.MCPServers.editServer}</p>
                        </TooltipContent>
                      </Tooltip>

                      {!serverData.server.is_built_in && (
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => handleDeleteServer(serverData.server)}
                          disabled={isLoading}
                          title={t.MCPServersExtra.tooltip.deleteServer}
                          className="text-red-600 hover:text-red-700"
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      )}
                    </div>
                  </div>
                </CardHeader>

                {serverData.error && (
                  <CardContent className="pt-0">
                    <Alert className="border-red-200 bg-red-50 text-red-800">
                      <AlertDescription>{serverData.error}</AlertDescription>
                    </Alert>
                  </CardContent>
                )}

                {/* GitHub MCP Server Setup Instructions */}
                {serverData.server.id === 'github' && !serverData.server.api_key && (
                  <CardContent className="pt-0">
                    <Collapsible>
                      <CollapsibleTrigger asChild>
                        <Alert className="cursor-pointer border-blue-200 bg-blue-50 text-blue-800 dark:border-blue-800 dark:bg-blue-950 dark:text-blue-200">
                          <div className="flex items-center gap-2">
                            <span className="whitespace-nowrap text-sm font-medium">
                              {t.MCPServersExtra.github.setupRequired}
                            </span>
                            <ChevronDown className="h-4 w-4 shrink-0 transition-transform duration-200 [[data-state=open]>&]:rotate-180" />
                          </div>
                        </Alert>
                      </CollapsibleTrigger>
                      <CollapsibleContent>
                        <div className="mt-2 space-y-1 rounded-md border border-blue-200 bg-blue-50 p-3 text-sm text-blue-800 dark:border-blue-800 dark:bg-blue-950 dark:text-blue-200">
                          <p>{t.MCPServersExtra.github.setupInstructions.intro}</p>
                          <p>{t.MCPServersExtra.github.setupInstructions.step1}</p>
                          <p>
                            {t.MCPServersExtra.github.setupInstructions.step2}{' '}
                            <span className="inline-flex flex-wrap gap-1">
                              <code>repo</code>
                              <code>read:packages</code>
                              <code>read:org</code>
                            </span>
                          </p>
                          <p>{t.MCPServersExtra.github.setupInstructions.step3}</p>
                          <p>{t.MCPServersExtra.github.setupInstructions.step4}</p>
                        </div>
                      </CollapsibleContent>
                    </Collapsible>
                  </CardContent>
                )}

                {/* GitHub MCP Server Connection Error Help */}
                {serverData.server.id === 'github' &&
                  serverData.server.api_key &&
                  serverData.error && (
                    <CardContent className="pt-0">
                      <Alert className="border-yellow-200 bg-yellow-50 text-yellow-800 dark:border-yellow-700 dark:bg-yellow-950 dark:text-yellow-200">
                        <AlertDescription>
                          <strong>{t.MCPServersExtra.github.connectionFailed.title}</strong> Please
                          check:
                          <br />• {t.MCPServersExtra.github.connectionFailed.checkScopes}{' '}
                          <span className="inline-flex flex-wrap gap-1">
                            <code>repo</code>
                            <code>read:packages</code>
                            <code>read:org</code>
                          </span>
                          <br />• {t.MCPServersExtra.github.connectionFailed.checkExpiry}
                          <br />• {t.MCPServersExtra.github.connectionFailed.checkNetwork}
                          <br />• {t.MCPServersExtra.github.connectionFailed.checkApi}
                        </AlertDescription>
                      </Alert>
                    </CardContent>
                  )}

                {serverData.server.is_enabled && serverData.tools.length > 0 && (
                  <CardContent className="pt-0">
                    <div className="text-sm text-gray-600 dark:text-gray-400">
                      <strong>{t.MCPServers.availableTools}</strong>{' '}
                      {serverData.tools.map((tool) => tool.name).join(', ')}
                    </div>
                  </CardContent>
                )}
              </Card>
            ))}

            {servers.length === 0 && !isLoading && (
              <Card>
                <CardContent className="flex flex-col items-center justify-center py-12">
                  <Server className="h-12 w-12 text-gray-400 mb-4" />
                  <h3 className="text-lg font-medium text-gray-900 dark:text-gray-100">
                    {t.MCPServers.noServers}
                  </h3>
                  <p className="text-gray-600 dark:text-gray-400 text-center mt-2 mb-4">
                    {t.MCPServers.noServersDescription}
                  </p>
                  <Button onClick={openCreateDialog}>
                    <Plus className="h-4 w-4 mr-2" />
                    {t.MCPServers.addServer}
                  </Button>
                </CardContent>
              </Card>
            )}
          </div>
        </div>
      </div>

      {/* Create Server Dialog */}
      <Dialog open={isCreateDialogOpen} onOpenChange={setIsCreateDialogOpen}>
        <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{t.MCPServers.addDialogTitle}</DialogTitle>
          </DialogHeader>

          <div className="space-y-4">
            {formError && (
              <Alert className="border-red-200 bg-red-50 text-red-800">
                <AlertDescription>{formError}</AlertDescription>
              </Alert>
            )}

            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label htmlFor={createIdId}>{t.MCPServers.form.serverId}</Label>
                <Input
                  id={createIdId}
                  value={formData.id}
                  onChange={(e) => setFormData({ ...formData, id: e.target.value })}
                  placeholder={t.MCPServers.form.serverIdPlaceholder}
                />
              </div>
              <div>
                <Label htmlFor={createNameId}>{t.MCPServers.form.name}</Label>
                <Input
                  id={createNameId}
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  placeholder={t.MCPServers.form.namePlaceholder}
                />
              </div>
            </div>

            <div>
              <Label htmlFor="create-protocol">{t.MCPServers.form.protocol}</Label>
              <Select
                value={formData.protocol}
                onValueChange={(value: 'http' | 'sse' | 'stdio') =>
                  setFormData({ ...formData, protocol: value })
                }
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {supportedProtocols.map((protocol) => (
                    <SelectItem key={protocol.value} value={protocol.value}>
                      <div>
                        <div className="font-medium">{protocol.label}</div>
                        <div className="text-xs text-gray-500">{protocol.description}</div>
                      </div>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {formData.protocol !== 'stdio' ? (
              <>
                <div>
                  <Label htmlFor={createUrlId}>{t.MCPServers.form.url}</Label>
                  <Input
                    id={createUrlId}
                    value={formData.url}
                    onChange={(e) => setFormData({ ...formData, url: e.target.value })}
                    placeholder={t.MCPServers.form.urlPlaceholder}
                  />
                </div>

                <div>
                  <Label htmlFor={createApiKeyId}>{t.MCPServers.form.apiKey}</Label>
                  <Input
                    id={createApiKeyId}
                    type="password"
                    value={formData.api_key || ''}
                    onChange={(e) => setFormData({ ...formData, api_key: e.target.value })}
                    placeholder={t.MCPServers.form.apiKeyPlaceholder}
                  />
                </div>

                <div>
                  <Label htmlFor={createHeadersId}>{t.MCPServers.form.headers}</Label>
                  <Textarea
                    id={createHeadersId}
                    value={formData.headers || ''}
                    onChange={(e) => setFormData({ ...formData, headers: e.target.value })}
                    placeholder={t.MCPServers.form.headersPlaceholder}
                    rows={3}
                  />
                </div>
              </>
            ) : (
              <>
                <div>
                  <Label htmlFor={createCommandId}>{t.MCPServers.form.command}</Label>
                  <Input
                    id={createCommandId}
                    value={formData.stdio_command || ''}
                    onChange={(e) =>
                      setFormData({
                        ...formData,
                        stdio_command: e.target.value,
                      })
                    }
                    placeholder={t.MCPServers.form.commandPlaceholder}
                  />
                </div>

                <div>
                  <Label htmlFor={createArgsId}>{t.MCPServers.form.arguments}</Label>
                  <Textarea
                    id={createArgsId}
                    value={formData.stdio_args || ''}
                    onChange={(e) => setFormData({ ...formData, stdio_args: e.target.value })}
                    placeholder={t.MCPServers.form.argumentsPlaceholder}
                    rows={3}
                  />
                </div>

                {/* Environment Variables */}
                <div className="space-y-2">
                  <Label>{t.MCPServers.form.envVars}</Label>
                  {isMinimaxCodingPlanServer(formData) ? (
                    // MiniMax specific env vars
                    <div className="space-y-3">
                      <div>
                        <Label htmlFor={`${createEnvId}-api-key`} className="text-sm font-normal">
                          {t.MCPServers.form.minimaxApiKey}
                        </Label>
                        <Input
                          id={`${createEnvId}-api-key`}
                          type="password"
                          value={
                            formData.stdio_env.find((e) => e.key === 'MINIMAX_API_KEY')?.value || ''
                          }
                          onChange={(e) => {
                            const newEnv = formData.stdio_env.filter(
                              (item) => item.key !== 'MINIMAX_API_KEY'
                            );
                            if (e.target.value) {
                              newEnv.push({ key: 'MINIMAX_API_KEY', value: e.target.value });
                            }
                            setFormData({ ...formData, stdio_env: newEnv });
                          }}
                          placeholder={t.MCPServers.form.minimaxApiKeyPlaceholder}
                        />
                      </div>
                      <div>
                        <Label htmlFor={`${createEnvId}-api-host`} className="text-sm font-normal">
                          {t.MCPServers.form.minimaxApiHost}
                        </Label>
                        <Input
                          id={`${createEnvId}-api-host`}
                          value={
                            formData.stdio_env.find((e) => e.key === 'MINIMAX_API_HOST')?.value ||
                            MINIMAX_DEFAULT_HOST
                          }
                          onChange={(e) => {
                            const newEnv = formData.stdio_env.filter(
                              (item) => item.key !== 'MINIMAX_API_HOST'
                            );
                            if (e.target.value && e.target.value !== MINIMAX_DEFAULT_HOST) {
                              newEnv.push({ key: 'MINIMAX_API_HOST', value: e.target.value });
                            } else if (e.target.value === '') {
                              // Keep empty to use default
                            } else {
                              newEnv.push({ key: 'MINIMAX_API_HOST', value: e.target.value });
                            }
                            setFormData({ ...formData, stdio_env: newEnv });
                          }}
                          placeholder={MINIMAX_DEFAULT_HOST}
                        />
                      </div>
                    </div>
                  ) : isGLMCodingPlanVisionServer(formData) ? (
                    // GLM Coding Plan Vision specific env vars
                    <div className="space-y-3">
                      <div>
                        <Label
                          htmlFor={`${createEnvId}-z-ai-api-key`}
                          className="text-sm font-normal"
                        >
                          {t.MCPServers.form.glmApiKey}
                        </Label>
                        <Input
                          id={`${createEnvId}-z-ai-api-key`}
                          type="password"
                          value={
                            formData.stdio_env.find((e) => e.key === 'Z_AI_API_KEY')?.value || ''
                          }
                          onChange={(e) => {
                            const newEnv = formData.stdio_env.filter(
                              (item) => item.key !== 'Z_AI_API_KEY'
                            );
                            if (e.target.value) {
                              newEnv.push({ key: 'Z_AI_API_KEY', value: e.target.value });
                            }
                            setFormData({ ...formData, stdio_env: newEnv });
                          }}
                          placeholder={t.MCPServers.form.glmApiKeyPlaceholder}
                        />
                      </div>
                      <div>
                        <Label htmlFor={`${createEnvId}-z-ai-mode`} className="text-sm font-normal">
                          {t.MCPServers.form.glmApiMode}
                        </Label>
                        <Input
                          id={`${createEnvId}-z-ai-mode`}
                          value={
                            formData.stdio_env.find((e) => e.key === 'Z_AI_MODE')?.value || 'ZHIPU'
                          }
                          onChange={(e) => {
                            const newEnv = formData.stdio_env.filter(
                              (item) => item.key !== 'Z_AI_MODE'
                            );
                            newEnv.push({ key: 'Z_AI_MODE', value: e.target.value || 'ZHIPU' });
                            setFormData({ ...formData, stdio_env: newEnv });
                          }}
                          placeholder="ZHIPU"
                        />
                        <p className="text-xs text-muted-foreground mt-1">
                          {t.MCPServers.form.glmApiModeHint}
                        </p>
                      </div>
                    </div>
                  ) : (
                    // Generic key-value env vars
                    <div className="space-y-2">
                      {formData.stdio_env.map((item, index) => (
                        <div
                          key={`${item.key}-${item.value}-${index}`}
                          className="flex items-center gap-2"
                        >
                          <Input
                            value={item.key}
                            onChange={(e) => {
                              const newEnv = [...formData.stdio_env];
                              newEnv[index] = { key: e.target.value, value: item.value };
                              setFormData({ ...formData, stdio_env: newEnv });
                            }}
                            placeholder={t.MCPServers.form.envVarKey}
                            className="flex-1"
                          />
                          <Input
                            value={item.value}
                            onChange={(e) => {
                              const newEnv = [...formData.stdio_env];
                              newEnv[index] = { key: item.key, value: e.target.value };
                              setFormData({ ...formData, stdio_env: newEnv });
                            }}
                            placeholder={t.MCPServers.form.envVarValue}
                            className="flex-1"
                          />
                          <Button
                            type="button"
                            variant="ghost"
                            size="icon"
                            onClick={() => {
                              const newEnv = formData.stdio_env.filter((_, i) => i !== index);
                              setFormData({ ...formData, stdio_env: newEnv });
                            }}
                          >
                            <Minus className="h-4 w-4" />
                          </Button>
                        </div>
                      ))}
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        onClick={() => {
                          setFormData({
                            ...formData,
                            stdio_env: [...formData.stdio_env, { key: '', value: '' }],
                          });
                        }}
                      >
                        <Plus className="h-4 w-4 mr-1" />
                        {t.MCPServers.form.addEnvVar}
                      </Button>
                    </div>
                  )}
                </div>
              </>
            )}

            <div className="flex justify-end space-x-2 pt-4">
              <Button
                variant="outline"
                onClick={() => setIsCreateDialogOpen(false)}
                disabled={isSubmitting}
              >
                {t.Common.cancel}
              </Button>
              <Button onClick={handleCreateServer} disabled={isSubmitting}>
                {isSubmitting ? t.MCPServers.actions.creating : t.MCPServers.actions.create}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Edit Server Dialog */}
      <Dialog open={isEditDialogOpen} onOpenChange={setIsEditDialogOpen}>
        <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{t.MCPServers.editDialogTitle}</DialogTitle>
          </DialogHeader>

          <div className="space-y-4">
            {formError && (
              <Alert className="border-red-200 bg-red-50 text-red-800">
                <AlertDescription>{formError}</AlertDescription>
              </Alert>
            )}

            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label htmlFor={editIdId}>{t.MCPServers.form.serverId}</Label>
                <Input
                  id={editIdId}
                  value={formData.id}
                  disabled
                  className="bg-gray-100 dark:bg-gray-800"
                />
              </div>
              <div>
                <Label htmlFor={editNameId}>{t.MCPServers.form.name}</Label>
                <Input
                  id={editNameId}
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  placeholder={t.MCPServers.form.namePlaceholder}
                />
              </div>
            </div>

            <div>
              <Label htmlFor="edit-protocol">{t.MCPServers.form.protocol}</Label>
              <Select
                value={formData.protocol}
                onValueChange={(value: 'http' | 'sse' | 'stdio') =>
                  setFormData({ ...formData, protocol: value })
                }
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {supportedProtocols.map((protocol) => (
                    <SelectItem key={protocol.value} value={protocol.value}>
                      <div>
                        <div className="font-medium">{protocol.label}</div>
                        <div className="text-xs text-gray-500">{protocol.description}</div>
                      </div>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {formData.protocol !== 'stdio' ? (
              <>
                <div>
                  <Label htmlFor={editUrlId}>{t.MCPServers.form.url}</Label>
                  <Input
                    id={editUrlId}
                    value={formData.url}
                    onChange={(e) => setFormData({ ...formData, url: e.target.value })}
                    placeholder={t.MCPServers.form.urlPlaceholder}
                  />
                </div>

                <div>
                  <Label htmlFor={editApiKeyId}>{t.MCPServers.form.apiKey}</Label>
                  <Input
                    id={editApiKeyId}
                    type="password"
                    value={formData.api_key || ''}
                    onChange={(e) => setFormData({ ...formData, api_key: e.target.value })}
                    placeholder={t.MCPServers.form.apiKeyPlaceholder}
                  />
                </div>

                {/* Hide headers field for GLM HTTP servers - API key is auto-converted to Authorization header */}
                {!isGLMCodingPlanHttpServer(formData) && (
                  <div>
                    <Label htmlFor={editHeadersId}>{t.MCPServers.form.headers}</Label>
                    <Textarea
                      id={editHeadersId}
                      value={formData.headers || ''}
                      onChange={(e) => setFormData({ ...formData, headers: e.target.value })}
                      placeholder={t.MCPServers.form.headersPlaceholder}
                      rows={3}
                    />
                  </div>
                )}
              </>
            ) : (
              <>
                <div>
                  <Label htmlFor={editCommandId}>{t.MCPServers.form.command}</Label>
                  <Input
                    id={editCommandId}
                    value={formData.stdio_command || ''}
                    onChange={(e) =>
                      setFormData({
                        ...formData,
                        stdio_command: e.target.value,
                      })
                    }
                    placeholder={t.MCPServers.form.commandPlaceholder}
                  />
                </div>

                <div>
                  <Label htmlFor={editArgsId}>{t.MCPServers.form.arguments}</Label>
                  <Textarea
                    id={editArgsId}
                    value={formData.stdio_args || ''}
                    onChange={(e) => setFormData({ ...formData, stdio_args: e.target.value })}
                    placeholder={t.MCPServers.form.argumentsPlaceholder}
                    rows={3}
                  />
                </div>

                {/* Environment Variables */}
                <div className="space-y-2">
                  <Label>{t.MCPServers.form.envVars}</Label>
                  {isMinimaxCodingPlanServer(formData) ? (
                    // MiniMax specific env vars
                    <div className="space-y-3">
                      <div>
                        <Label htmlFor={`${editEnvId}-api-key`} className="text-sm font-normal">
                          {t.MCPServers.form.minimaxApiKey}
                        </Label>
                        <Input
                          id={`${editEnvId}-api-key`}
                          type="password"
                          value={
                            formData.stdio_env.find((e) => e.key === 'MINIMAX_API_KEY')?.value || ''
                          }
                          onChange={(e) => {
                            const newEnv = formData.stdio_env.filter(
                              (item) => item.key !== 'MINIMAX_API_KEY'
                            );
                            if (e.target.value) {
                              newEnv.push({ key: 'MINIMAX_API_KEY', value: e.target.value });
                            }
                            setFormData({ ...formData, stdio_env: newEnv });
                          }}
                          placeholder={t.MCPServers.form.minimaxApiKeyPlaceholder}
                        />
                      </div>
                      <div>
                        <Label htmlFor={`${editEnvId}-api-host`} className="text-sm font-normal">
                          {t.MCPServers.form.minimaxApiHost}
                        </Label>
                        <Input
                          id={`${editEnvId}-api-host`}
                          value={
                            formData.stdio_env.find((e) => e.key === 'MINIMAX_API_HOST')?.value ||
                            MINIMAX_DEFAULT_HOST
                          }
                          onChange={(e) => {
                            const newEnv = formData.stdio_env.filter(
                              (item) => item.key !== 'MINIMAX_API_HOST'
                            );
                            if (e.target.value && e.target.value !== MINIMAX_DEFAULT_HOST) {
                              newEnv.push({ key: 'MINIMAX_API_HOST', value: e.target.value });
                            } else if (e.target.value === '') {
                              // Keep empty to use default
                            } else {
                              newEnv.push({ key: 'MINIMAX_API_HOST', value: e.target.value });
                            }
                            setFormData({ ...formData, stdio_env: newEnv });
                          }}
                          placeholder={MINIMAX_DEFAULT_HOST}
                        />
                      </div>
                    </div>
                  ) : isGLMCodingPlanVisionServer(formData) ? (
                    // GLM Coding Plan Vision specific env vars
                    <div className="space-y-3">
                      <div>
                        <Label
                          htmlFor={`${editEnvId}-z-ai-api-key`}
                          className="text-sm font-normal"
                        >
                          {t.MCPServers.form.glmApiKey}
                        </Label>
                        <Input
                          id={`${editEnvId}-z-ai-api-key`}
                          type="password"
                          value={
                            formData.stdio_env.find((e) => e.key === 'Z_AI_API_KEY')?.value || ''
                          }
                          onChange={(e) => {
                            const newEnv = formData.stdio_env.filter(
                              (item) => item.key !== 'Z_AI_API_KEY'
                            );
                            if (e.target.value) {
                              newEnv.push({ key: 'Z_AI_API_KEY', value: e.target.value });
                            }
                            setFormData({ ...formData, stdio_env: newEnv });
                          }}
                          placeholder={t.MCPServers.form.glmApiKeyPlaceholder}
                        />
                      </div>
                      <div>
                        <Label htmlFor={`${editEnvId}-z-ai-mode`} className="text-sm font-normal">
                          {t.MCPServers.form.glmApiMode}
                        </Label>
                        <Input
                          id={`${editEnvId}-z-ai-mode`}
                          value={
                            formData.stdio_env.find((e) => e.key === 'Z_AI_MODE')?.value || 'ZHIPU'
                          }
                          onChange={(e) => {
                            const newEnv = formData.stdio_env.filter(
                              (item) => item.key !== 'Z_AI_MODE'
                            );
                            newEnv.push({ key: 'Z_AI_MODE', value: e.target.value || 'ZHIPU' });
                            setFormData({ ...formData, stdio_env: newEnv });
                          }}
                          placeholder="ZHIPU"
                        />
                        <p className="text-xs text-muted-foreground mt-1">
                          {t.MCPServers.form.glmApiModeHint}
                        </p>
                      </div>
                    </div>
                  ) : (
                    // Generic key-value env vars
                    <div className="space-y-2">
                      {formData.stdio_env.map((item, index) => (
                        <div
                          key={`${item.key}-${item.value}-${index}`}
                          className="flex items-center gap-2"
                        >
                          <Input
                            value={item.key}
                            onChange={(e) => {
                              const newEnv = [...formData.stdio_env];
                              newEnv[index] = { key: e.target.value, value: item.value };
                              setFormData({ ...formData, stdio_env: newEnv });
                            }}
                            placeholder={t.MCPServers.form.envVarKey}
                            className="flex-1"
                          />
                          <Input
                            value={item.value}
                            onChange={(e) => {
                              const newEnv = [...formData.stdio_env];
                              newEnv[index] = { key: item.key, value: e.target.value };
                              setFormData({ ...formData, stdio_env: newEnv });
                            }}
                            placeholder={t.MCPServers.form.envVarValue}
                            className="flex-1"
                          />
                          <Button
                            type="button"
                            variant="ghost"
                            size="icon"
                            onClick={() => {
                              const newEnv = formData.stdio_env.filter((_, i) => i !== index);
                              setFormData({ ...formData, stdio_env: newEnv });
                            }}
                          >
                            <Minus className="h-4 w-4" />
                          </Button>
                        </div>
                      ))}
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        onClick={() => {
                          setFormData({
                            ...formData,
                            stdio_env: [...formData.stdio_env, { key: '', value: '' }],
                          });
                        }}
                      >
                        <Plus className="h-4 w-4 mr-1" />
                        {t.MCPServers.form.addEnvVar}
                      </Button>
                    </div>
                  )}
                </div>
              </>
            )}

            <div className="flex justify-end space-x-2 pt-4">
              <Button
                variant="outline"
                onClick={() => setIsEditDialogOpen(false)}
                disabled={isSubmitting}
              >
                {t.Common.cancel}
              </Button>
              <Button onClick={handleUpdateServer} disabled={isSubmitting}>
                {isSubmitting ? t.MCPServers.actions.updating : t.MCPServers.actions.update}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation Dialog */}
      <AlertDialog open={isDeleteDialogOpen} onOpenChange={setIsDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t.MCPServers.deleteDialogTitle}</AlertDialogTitle>
            <AlertDialogDescription>
              {t.MCPServers.deleteDialogDescription(serverToDelete?.name || '')}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel
              onClick={() => {
                setServerToDelete(null);
                setIsDeleteDialogOpen(false);
              }}
            >
              {t.Common.cancel}
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={confirmDeleteServer}
              className="bg-red-600 hover:bg-red-700 focus:ring-red-600"
            >
              {t.Common.delete}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
