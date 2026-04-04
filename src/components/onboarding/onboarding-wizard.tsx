import { useState } from 'react';
import { Button } from '@/components/ui/button';
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { useLocale } from '@/hooks/use-locale';
import { settingsManager } from '@/stores/settings-store';
import { OnboardingProgress } from './onboarding-progress';
import { LanguageStep } from './steps/language-step';
import { ThemeStep } from './steps/theme-step';

interface OnboardingWizardProps {
  onComplete: () => void;
}

const STEPS = [
  { key: 'language', component: LanguageStep },
  { key: 'theme', component: ThemeStep },
] as const;

export function OnboardingWizard({ onComplete }: OnboardingWizardProps) {
  const [currentStep, setCurrentStep] = useState(0);
  const { t } = useLocale();

  const handleNext = () => {
    if (currentStep < STEPS.length - 1) {
      setCurrentStep(currentStep + 1);
    }
  };

  const handleBack = () => {
    if (currentStep > 0) {
      setCurrentStep(currentStep - 1);
    }
  };

  const handleFinish = async () => {
    await settingsManager.set('onboarding_completed', 'true');
    onComplete();
  };

  const handleSkip = async () => {
    await settingsManager.set('onboarding_completed', 'true');
    onComplete();
  };

  const currentStepData = STEPS[currentStep];
  const CurrentStepComponent = currentStepData?.component ?? LanguageStep;
  const isFirstStep = currentStep === 0;
  const isLastStep = currentStep === STEPS.length - 1;

  return (
    <div className="flex h-screen items-center justify-center bg-background p-4">
      <Card className="w-full max-w-md">
        <CardHeader className="text-center">
          <CardTitle className="text-2xl">{t.Onboarding.title}</CardTitle>
          <CardDescription>{t.Onboarding.subtitle}</CardDescription>
        </CardHeader>

        <CardContent>
          <OnboardingProgress currentStep={currentStep} totalSteps={STEPS.length} />

          <div className="transition-all duration-300">
            <CurrentStepComponent />
          </div>
        </CardContent>

        <CardFooter className="flex justify-between">
          <div>
            {isFirstStep ? (
              <Button variant="ghost" onClick={handleSkip}>
                {t.Onboarding.skip}
              </Button>
            ) : (
              <Button variant="ghost" onClick={handleBack}>
                {t.Common.back}
              </Button>
            )}
          </div>

          <div>
            {isLastStep ? (
              <Button onClick={handleFinish}>{t.Onboarding.getStarted}</Button>
            ) : (
              <Button onClick={handleNext}>{t.Common.next}</Button>
            )}
          </div>
        </CardFooter>
      </Card>
    </div>
  );
}
