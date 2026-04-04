import { render, screen, waitFor } from '@testing-library/react';
import { describe, expect, it, vi, beforeEach } from 'vitest';
import { PlanReviewCard } from '@/components/plan/plan-review-card';

const approvePlan = vi.hoisted(() => vi.fn());
const rejectPlan = vi.hoisted(() => vi.fn());
const sendIfNotFocused = vi.hoisted(() => vi.fn().mockResolvedValue(undefined));

vi.mock('@/stores/plan-mode-store', () => ({
  usePlanModeStore: () => ({
    approvePlan,
    rejectPlan,
  }),
}));

vi.mock('@/services/notification-service', () => ({
  notificationService: {
    sendIfNotFocused,
  },
}));

vi.mock('@/stores/task-store', () => ({
  useTaskStore: (selector: (state: { getTask: (taskId: string) => { settings?: string } | undefined }) => any) =>
    selector({
      getTask: () => ({ settings: JSON.stringify({ autoApprovePlan: false }) }),
    }),
}));

vi.mock('@/hooks/use-locale', () => ({
  useLocale: () => ({
    t: {
      PlanReview: {
        submitted: 'Submitted',
        title: 'Plan Review',
        description: 'Review the plan',
        notificationTitle: 'Plan Review Required',
        notificationBody: 'Please review the plan',
        editHint: 'Edit hint',
        editPlaceholder: 'Edit placeholder',
        feedbackPrompt: 'Feedback prompt',
        feedbackPlaceholder: 'Feedback placeholder',
        cancel: 'Cancel',
        submitRejection: 'Submit Rejection',
        edit: 'Edit',
        preview: 'Preview',
        rejectAndFeedback: 'Reject & Feedback',
        approve: 'Approve',
      },
    },
  }),
}));

vi.mock('@/components/chat/my-markdown', () => ({
  default: ({ content }: { content: string }) => <div>{content}</div>,
}));

vi.mock('@/components/ui/button', () => ({
  Button: ({ children, ...props }: { children: React.ReactNode }) => (
    <button type="button" {...props}>
      {children}
    </button>
  ),
}));

vi.mock('@/components/ui/card', () => ({
  Card: ({ children, ...props }: { children: React.ReactNode }) => <div {...props}>{children}</div>,
}));

vi.mock('@/components/ui/textarea', () => ({
  Textarea: ({ ...props }: { value?: string }) => <textarea {...props} />,
}));

describe('PlanReviewCard', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders without auto-approve and sends notification once', async () => {
    render(<PlanReviewCard planContent="Test plan" taskId="task-1" />);

    expect(screen.getByText('Plan Review')).toBeInTheDocument();

    await waitFor(() => {
      expect(sendIfNotFocused).toHaveBeenCalledTimes(1);
    });
    expect(approvePlan).not.toHaveBeenCalled();
  });
});
