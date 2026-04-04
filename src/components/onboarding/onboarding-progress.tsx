import { cn } from '@/lib/utils';

interface OnboardingProgressProps {
  currentStep: number;
  totalSteps: number;
}

export function OnboardingProgress({ currentStep, totalSteps }: OnboardingProgressProps) {
  return (
    <div className="flex items-center justify-center gap-2 mb-6">
      {Array.from({ length: totalSteps }).map((_, index) => (
        <div
          // biome-ignore lint/suspicious/noArrayIndexKey: Static progress indicators never reorder
          key={index}
          className={cn(
            'h-2 w-2 rounded-full transition-all duration-300',
            index < currentStep
              ? 'bg-primary'
              : index === currentStep
                ? 'bg-primary w-6'
                : 'bg-muted'
          )}
        />
      ))}
    </div>
  );
}
