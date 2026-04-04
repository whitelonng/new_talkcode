/**
 * Skill Permissions Settings
 *
 * UI for managing granted skill permissions
 */

import { AlertCircle, Shield, Trash2 } from 'lucide-react';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { useSkillPermissionStore } from '@/stores/skill-permission-store';
import type { SkillPermissionGrant } from '@/types/skill-permission';

const PERMISSION_LABELS: Record<string, string> = {
  'read-only': 'Read Only',
  'write-project': 'Write Project',
  'write-all': 'Write All',
  network: 'Network Access',
  full: 'Full Access',
};

export function SkillPermissionsSettings() {
  const { getAllGrants, revokePermission } = useSkillPermissionStore();
  const grants = getAllGrants();

  const handleRevoke = (skillId: string) => {
    if (confirm('Are you sure you want to revoke this permission?')) {
      revokePermission(skillId);
    }
  };

  const formatDate = (timestamp: number) => {
    return new Date(timestamp).toLocaleString();
  };

  const getPermissionColor = (grant: SkillPermissionGrant) => {
    switch (grant.level) {
      case 'read-only':
        return 'text-green-600 dark:text-green-400';
      case 'write-project':
        return 'text-yellow-600 dark:text-yellow-400';
      case 'write-all':
      case 'network':
      case 'full':
        return 'text-red-600 dark:text-red-400';
      default:
        return 'text-gray-600 dark:text-gray-400';
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-semibold flex items-center gap-2">
          <Shield className="h-6 w-6" />
          Skill Permissions
        </h2>
        <p className="text-muted-foreground mt-2">
          Manage permissions granted to skills for script execution
        </p>
      </div>

      {grants.length === 0 ? (
        <Alert>
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>
            No permissions granted yet. Permissions will appear here when you grant access to skill
            scripts.
          </AlertDescription>
        </Alert>
      ) : (
        <div className="space-y-3">
          {grants.map((grant) => (
            <div
              key={grant.skillId}
              className="border rounded-lg p-4 hover:bg-accent/50 transition-colors"
            >
              <div className="flex items-start justify-between">
                <div className="flex-1">
                  <div className="flex items-center gap-3 mb-2">
                    <h3 className="font-medium">{grant.skillName}</h3>
                    <span
                      className={`text-sm font-medium px-2 py-0.5 rounded-full ${getPermissionColor(
                        grant
                      )} bg-opacity-10`}
                    >
                      {PERMISSION_LABELS[grant.level]}
                    </span>
                    {grant.autoApprove && (
                      <span className="text-xs text-muted-foreground bg-muted px-2 py-0.5 rounded">
                        Auto-approve
                      </span>
                    )}
                  </div>

                  <div className="text-sm text-muted-foreground space-y-1">
                    <div>
                      Scope:{' '}
                      {grant.applyToAllScripts ? (
                        'All scripts in skill'
                      ) : (
                        <span>{grant.allowedScripts?.length || 0} specific script(s)</span>
                      )}
                    </div>
                    <div>Granted: {formatDate(grant.grantedAt)}</div>
                  </div>
                </div>

                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => handleRevoke(grant.skillId)}
                  className="text-destructive hover:text-destructive hover:bg-destructive/10"
                >
                  <Trash2 className="h-4 w-4" />
                </Button>
              </div>
            </div>
          ))}
        </div>
      )}

      {grants.length > 0 && (
        <Alert variant="default">
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>
            Revoking a permission will require re-authorization the next time the skill attempts to
            execute a script.
          </AlertDescription>
        </Alert>
      )}
    </div>
  );
}
