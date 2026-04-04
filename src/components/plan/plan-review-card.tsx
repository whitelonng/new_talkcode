import { Check, Edit2, X } from 'lucide-react';
import { useEffect, useMemo, useRef, useState } from 'react';
import MyMarkdown from '@/components/chat/my-markdown';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Textarea } from '@/components/ui/textarea';
import { useLocale } from '@/hooks/use-locale';
import { notificationService } from '@/services/notification-service';
import { usePlanModeStore } from '@/stores/plan-mode-store';
import { useTaskStore } from '@/stores/task-store';
import type { TaskSettings } from '@/types/task';

interface PlanReviewCardProps {
  planContent: string;
  taskId?: string;
}

export function PlanReviewCard({ planContent, taskId }: PlanReviewCardProps) {
  const [isEditing, setIsEditing] = useState(false);
  const [editedContent, setEditedContent] = useState(planContent);
  const [showFeedbackInput, setShowFeedbackInput] = useState(false);
  const [feedback, setFeedback] = useState('');
  const [submitted, setSubmitted] = useState(false);

  const { t } = useLocale();
  const { approvePlan, rejectPlan } = usePlanModeStore();
  const taskSettingsJson = useTaskStore((state) => {
    if (!taskId) return null;
    return state.getTask(taskId)?.settings ?? null;
  });
  const autoApprovePlan = useMemo(() => {
    if (!taskSettingsJson) return undefined;
    try {
      const parsed = JSON.parse(taskSettingsJson) as TaskSettings;
      return parsed.autoApprovePlan;
    } catch {
      return undefined;
    }
  }, [taskSettingsJson]);
  const lastNotifiedKeyRef = useRef<string | null>(null);
  const autoApprovedRef = useRef(false);

  useEffect(() => {
    if (!taskId || autoApprovedRef.current) return;
    if (autoApprovePlan !== true) return;

    autoApprovedRef.current = true;
    approvePlan(taskId);
    setSubmitted(true);
  }, [approvePlan, autoApprovePlan, taskId]);

  useEffect(() => {
    if (autoApprovePlan === true) {
      return;
    }

    const notificationKey = taskId ?? planContent;

    if (lastNotifiedKeyRef.current === notificationKey) {
      return;
    }

    lastNotifiedKeyRef.current = notificationKey;
    notificationService
      .sendIfNotFocused(t.PlanReview.notificationTitle, t.PlanReview.notificationBody)
      .catch((error) => {
        console.error('[PlanReviewCard] Failed to send notification', error);
      });
  }, [
    planContent,
    taskId,
    t.PlanReview.notificationBody,
    t.PlanReview.notificationTitle,
    autoApprovePlan,
  ]);

  const handleApprove = () => {
    if (!taskId) {
      console.error('[PlanReviewCard] taskId is required for approval');
      return;
    }
    // If content was edited, pass the edited version
    const finalContent = isEditing && editedContent !== planContent ? editedContent : undefined;
    approvePlan(taskId, finalContent);
    setSubmitted(true);
  };

  const handleReject = () => {
    if (!showFeedbackInput) {
      // Show feedback input first
      setShowFeedbackInput(true);
      return;
    }

    if (!taskId) {
      console.error('[PlanReviewCard] taskId is required for rejection');
      return;
    }

    // Submit rejection with feedback
    rejectPlan(taskId, feedback.trim() || undefined);
    setSubmitted(true);
  };

  const handleEdit = () => {
    setIsEditing(!isEditing);
    if (!isEditing) {
      // Reset edited content when entering edit mode
      setEditedContent(planContent);
    }
  };

  const handleCancelFeedback = () => {
    setShowFeedbackInput(false);
    setFeedback('');
  };

  if (submitted) {
    return (
      <Card className="border-green-500/50 bg-green-500/10 p-4">
        <div className="flex items-center gap-2 text-green-600 dark:text-green-400">
          <Check className="size-5" />
          <span className="font-medium">{t.PlanReview.submitted}</span>
        </div>
      </Card>
    );
  }

  return (
    <Card className="@container w-full overflow-hidden border-blue-500/50 bg-blue-500/10 p-4">
      <div className="space-y-4 min-w-0">
        {/* Header */}
        <div>
          <h3 className="font-semibold text-foreground text-lg">{t.PlanReview.title}</h3>
          <p className="text-muted-foreground text-sm">{t.PlanReview.description}</p>
        </div>

        {/* Plan Content */}
        <div className="rounded-lg border border-border bg-background p-4 w-full overflow-hidden">
          {isEditing ? (
            <div className="space-y-2">
              <div className="text-muted-foreground text-xs">{t.PlanReview.editHint}</div>
              <Textarea
                value={editedContent}
                onChange={(e) => setEditedContent(e.target.value)}
                className="min-h-[300px] resize-vertical font-mono text-sm w-full"
                placeholder={t.PlanReview.editPlaceholder}
              />
            </div>
          ) : (
            <div className="prose prose-sm dark:prose-invert max-w-none break-words">
              <MyMarkdown content={planContent} />
            </div>
          )}
        </div>

        {/* Feedback Input (shown when rejecting) */}
        {showFeedbackInput && (
          <div className="space-y-2 rounded-lg border border-orange-500/50 bg-orange-500/10 p-4 w-full overflow-hidden">
            <div className="text-foreground text-sm font-medium">{t.PlanReview.feedbackPrompt}</div>
            <Textarea
              value={feedback}
              onChange={(e) => setFeedback(e.target.value)}
              className="min-h-[100px] resize-none w-full"
              placeholder={t.PlanReview.feedbackPlaceholder}
            />
          </div>
        )}

        {/* Action Buttons */}
        <div className="flex flex-wrap items-center justify-end gap-2 pt-2">
          {showFeedbackInput ? (
            <>
              <Button variant="outline" onClick={handleCancelFeedback}>
                <span className="hidden @xs:inline">{t.PlanReview.cancel}</span>
                <X className="size-4 @xs:hidden" />
              </Button>
              <Button onClick={handleReject} variant="destructive">
                <X className="size-4 flex-shrink-0 @xs:mr-2" />
                <span className="hidden @xs:inline">{t.PlanReview.submitRejection}</span>
              </Button>
            </>
          ) : (
            <>
              <Button variant="outline" onClick={handleEdit}>
                <Edit2 className="size-4 flex-shrink-0 @xs:mr-2" />
                <span className="hidden @xs:inline">
                  {isEditing ? t.PlanReview.preview : t.PlanReview.edit}
                </span>
              </Button>
              <Button
                variant="outline"
                onClick={() => setShowFeedbackInput(true)}
                className="border-orange-500/50 text-orange-600 hover:bg-orange-500/10 dark:text-orange-400"
              >
                <X className="size-4 flex-shrink-0 @xs:mr-2" />
                <span className="hidden @xs:inline">{t.PlanReview.rejectAndFeedback}</span>
              </Button>
              <Button onClick={handleApprove} className="bg-green-600 hover:bg-green-700">
                <Check className="size-4 flex-shrink-0 @xs:mr-2" />
                <span className="hidden @xs:inline">{t.PlanReview.approve}</span>
              </Button>
            </>
          )}
        </div>
      </div>
    </Card>
  );
}
