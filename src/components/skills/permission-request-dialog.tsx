/**
 * Permission Request Dialog
 *
 * Dialog for requesting permission to execute skill scripts
 */

import { AlertTriangle, Info, Shield } from 'lucide-react';
import { useId, useState } from 'react';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import type { SkillPermissionRequest, SkillScriptPermissionLevel } from '@/types/skill-permission';

interface PermissionRequestDialogProps {
  open: boolean;
  request: SkillPermissionRequest | null;
  onDecide: (granted: boolean, level: SkillScriptPermissionLevel, remember: boolean) => void;
  onCancel: () => void;
}

const PERMISSION_LEVELS: Array<{
  value: SkillScriptPermissionLevel;
  label: string;
  description: string;
  danger: 'low' | 'medium' | 'high';
}> = [
  {
    value: 'read-only',
    label: 'Read Only',
    description: 'Can only read files within the workspace',
    danger: 'low',
  },
  {
    value: 'write-project',
    label: 'Write Project',
    description: 'Can write files within the current project directory',
    danger: 'medium',
  },
  {
    value: 'write-all',
    label: 'Write All',
    description: 'Can write files anywhere on the filesystem',
    danger: 'high',
  },
  {
    value: 'network',
    label: 'Network Access',
    description: 'Can make network requests (includes write-all)',
    danger: 'high',
  },
  {
    value: 'full',
    label: 'Full Access',
    description: 'Complete system access (use with extreme caution)',
    danger: 'high',
  },
];

export function PermissionRequestDialog({
  open,
  request,
  onDecide,
  onCancel,
}: PermissionRequestDialogProps) {
  const [selectedLevel, setSelectedLevel] = useState<SkillScriptPermissionLevel>(
    request?.requestedLevel || 'read-only'
  );
  const [rememberDecision, setRememberDecision] = useState(false);
  const rememberId = useId();

  if (!request) {
    return null;
  }

  const requestedLevelInfo = PERMISSION_LEVELS.find((l) => l.value === request.requestedLevel);
  const scriptFileName = request.scriptPath.split('/').pop() || request.scriptPath;

  const handleGrant = () => {
    onDecide(true, selectedLevel, rememberDecision);
  };

  const handleDeny = () => {
    onDecide(false, selectedLevel, false);
  };

  return (
    <Dialog open={open} onOpenChange={(open) => !open && onCancel()}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Shield className="h-5 w-5 text-blue-500" />
            Permission Request
          </DialogTitle>
          <DialogDescription>A skill script is requesting permission to execute</DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          {/* Skill and Script Info */}
          <div className="bg-muted rounded-lg p-4 space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-sm font-medium">Skill:</span>
              <span className="text-sm">{request.skillName}</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-sm font-medium">Script:</span>
              <span className="text-sm font-mono">{scriptFileName}</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-sm font-medium">Type:</span>
              <span className="text-sm">{request.scriptType}</span>
            </div>
          </div>

          {/* Requested Permission Level */}
          {requestedLevelInfo && (
            <Alert variant={requestedLevelInfo.danger === 'high' ? 'destructive' : 'default'}>
              <AlertTriangle className="h-4 w-4" />
              <AlertDescription>
                <strong>Requested Permission:</strong> {requestedLevelInfo.label}
                <br />
                {requestedLevelInfo.description}
              </AlertDescription>
            </Alert>
          )}

          {/* Reason (if provided) */}
          {request.reason && (
            <div className="bg-muted rounded-lg p-4">
              <div className="flex items-start gap-2">
                <Info className="h-4 w-4 mt-0.5 text-muted-foreground" />
                <div>
                  <div className="text-sm font-medium mb-1">Reason:</div>
                  <div className="text-sm text-muted-foreground">{request.reason}</div>
                </div>
              </div>
            </div>
          )}

          {/* Permission Level Selection */}
          <div className="space-y-3">
            <Label className="text-sm font-medium">Grant Permission Level:</Label>
            <RadioGroup
              value={selectedLevel}
              onValueChange={(value: string) =>
                setSelectedLevel(value as SkillScriptPermissionLevel)
              }
            >
              {PERMISSION_LEVELS.map((level) => (
                <div
                  key={level.value}
                  className="flex items-start space-x-3 rounded-lg border p-3 hover:bg-accent"
                >
                  <RadioGroupItem value={level.value} id={level.value} className="mt-0.5" />
                  <div className="flex-1">
                    <Label htmlFor={level.value} className="cursor-pointer">
                      <div className="flex items-center gap-2">
                        <span className="font-medium">{level.label}</span>
                        {level.danger === 'high' && (
                          <AlertTriangle className="h-3 w-3 text-red-500" />
                        )}
                      </div>
                      <div className="text-sm text-muted-foreground mt-0.5">
                        {level.description}
                      </div>
                    </Label>
                  </div>
                </div>
              ))}
            </RadioGroup>
          </div>

          {/* Remember Decision */}
          <div className="flex items-center space-x-2 pt-2 border-t">
            <Checkbox
              id={rememberId}
              checked={rememberDecision}
              onCheckedChange={(checked) => setRememberDecision(checked === true)}
            />
            <Label
              htmlFor={rememberId}
              className="text-sm cursor-pointer peer-disabled:cursor-not-allowed peer-disabled:opacity-70"
            >
              Remember this decision for this skill (auto-approve future executions)
            </Label>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={handleDeny}>
            Deny
          </Button>
          <Button onClick={handleGrant}>Grant Permission</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
