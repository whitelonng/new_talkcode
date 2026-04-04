// src/components/chat/voice-recording-modal.tsx
import { Loader2, Mic, Square, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { useTranslation } from '@/hooks/use-locale';

interface VoiceRecordingModalProps {
  isOpen: boolean;
  isTranscribing: boolean;
  isConnecting?: boolean;
  recordingDuration: number;
  partialTranscript?: string;
  onStop: () => void;
  onCancel: () => void;
}

export function VoiceRecordingModal({
  isOpen,
  isTranscribing,
  isConnecting = false,
  recordingDuration,
  partialTranscript = '',
  onStop,
  onCancel,
}: VoiceRecordingModalProps) {
  const t = useTranslation();

  // Format duration as MM:SS
  const formatDuration = (seconds: number): string => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onCancel()}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>
            {isConnecting
              ? t.Chat.voice.modal.connectingTitle
              : isTranscribing
                ? t.Chat.voice.modal.transcribingTitle
                : t.Chat.voice.modal.recordingTitle}
          </DialogTitle>
        </DialogHeader>

        {/* Animated microphone visualization */}
        <div className="flex flex-col items-center gap-6 py-8">
          <div className="relative flex items-center justify-center">
            {isConnecting ? (
              // Connecting state
              <div className="relative z-10 rounded-full bg-blue-500 p-6 shadow-lg">
                <Loader2 className="h-8 w-8 animate-spin text-white" />
              </div>
            ) : !isTranscribing ? (
              <>
                {/* Pulsing rings - 3 layers with staggered delays */}
                <div className="absolute inset-0 flex items-center justify-center">
                  <div className="absolute h-32 w-32 animate-ping rounded-full bg-red-500/20" />
                  <div
                    className="absolute h-32 w-32 animate-ping rounded-full bg-red-500/20"
                    style={{ animationDelay: '300ms' }}
                  />
                  <div
                    className="absolute h-32 w-32 animate-ping rounded-full bg-red-500/20"
                    style={{ animationDelay: '600ms' }}
                  />
                </div>

                {/* Microphone icon */}
                <div className="relative z-10 rounded-full bg-red-500 p-6 shadow-lg">
                  <Mic className="h-8 w-8 text-white" />
                </div>
              </>
            ) : (
              // Transcribing state
              <div className="relative z-10 rounded-full bg-primary p-6 shadow-lg">
                <Loader2 className="h-8 w-8 animate-spin text-primary-foreground" />
              </div>
            )}
          </div>

          {/* Recording duration / Transcribing message / Connecting */}
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            {isConnecting ? (
              <span className="animate-pulse">{t.Chat.voice.modal.connecting}</span>
            ) : !isTranscribing ? (
              <>
                {/* Pulsing red dot */}
                <div className="h-2 w-2 animate-pulse rounded-full bg-red-500" />
                <span>
                  {t.Chat.voice.modal.recording} {formatDuration(recordingDuration)}
                </span>
              </>
            ) : (
              <span className="animate-pulse">{t.Chat.voice.modal.processing}</span>
            )}
          </div>

          {/* Real-time transcript display */}
          {partialTranscript && !isTranscribing && (
            <div className="w-full rounded-lg bg-muted p-4">
              <p className="text-xs text-muted-foreground mb-2">
                {t.Chat.voice.modal.liveTranscript}
              </p>
              <p className="text-sm italic text-foreground">{partialTranscript}</p>
            </div>
          )}
        </div>

        {/* Action buttons */}
        <DialogFooter className="flex gap-2 sm:gap-2">
          <Button
            variant="outline"
            onClick={onCancel}
            disabled={isTranscribing || isConnecting}
            className="flex-1 sm:flex-1"
          >
            <X className="mr-2 h-4 w-4" />
            {t.Common.cancel}
          </Button>
          <Button
            variant="default"
            onClick={onStop}
            disabled={isTranscribing || isConnecting}
            className="flex-1 sm:flex-1"
          >
            <Square className="mr-2 h-4 w-4" />
            {t.Chat.voice.modal.stopAndTranscribe}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
