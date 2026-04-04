/**
 * Checksum Warning Dialog
 *
 * Dialog shown when skill package checksum verification fails
 */

import { AlertTriangle } from 'lucide-react';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';

interface ChecksumWarningDialogProps {
  open: boolean;
  skillName: string;
  expectedChecksum: string;
  actualChecksum: string;
  onContinue: () => void;
  onCancel: () => void;
}

export function ChecksumWarningDialog({
  open,
  skillName,
  expectedChecksum,
  actualChecksum,
  onContinue,
  onCancel,
}: ChecksumWarningDialogProps) {
  return (
    <Dialog open={open} onOpenChange={(open) => !open && onCancel()}>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <AlertTriangle className="h-5 w-5 text-destructive" />
            Security Warning: Checksum Mismatch
          </DialogTitle>
          <DialogDescription>
            The skill package for <strong>{skillName}</strong> failed integrity verification.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <Alert variant="destructive">
            <AlertTriangle className="h-4 w-4" />
            <AlertDescription>
              <strong>Warning:</strong> This package may have been tampered with or corrupted during
              download. Installing it could pose a security risk.
            </AlertDescription>
          </Alert>

          <div className="space-y-2 text-sm">
            <div className="rounded-md bg-muted p-3">
              <div className="font-medium mb-1">Expected Checksum:</div>
              <code className="text-xs break-all">{expectedChecksum}</code>
            </div>
            <div className="rounded-md bg-muted p-3">
              <div className="font-medium mb-1">Actual Checksum:</div>
              <code className="text-xs break-all">{actualChecksum}</code>
            </div>
          </div>

          <div className="text-sm text-muted-foreground space-y-2">
            <p>Possible causes:</p>
            <ul className="list-disc list-inside space-y-1 ml-2">
              <li>Package was modified after publication</li>
              <li>Download was corrupted or incomplete</li>
              <li>Network interference or man-in-the-middle attack</li>
            </ul>
          </div>

          <div className="rounded-md bg-muted p-3 text-sm">
            <strong>Recommendation:</strong> Cancel the installation and try downloading the skill
            again. If the problem persists, contact the skill author.
          </div>
        </div>

        <DialogFooter className="gap-2">
          <Button variant="outline" onClick={onCancel}>
            Cancel Installation
          </Button>
          <Button variant="destructive" onClick={onContinue}>
            Install Anyway (Not Recommended)
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
