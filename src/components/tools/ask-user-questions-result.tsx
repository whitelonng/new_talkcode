import { CheckCircle2, MessageSquare } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Card } from '@/components/ui/card';
import type { AskUserQuestionsOutput, Question } from '@/types/user-question';

interface AskUserQuestionsResultProps {
  answers: AskUserQuestionsOutput;
  questions: Question[];
}

export function AskUserQuestionsResult({ answers, questions }: AskUserQuestionsResultProps) {
  return (
    <Card className="border-green-500/50 bg-green-500/10 p-4 w-full overflow-hidden">
      <div className="space-y-3 min-w-0">
        <div className="flex items-center gap-2 text-green-600 dark:text-green-400">
          <CheckCircle2 className="size-5" />
          <span className="font-semibold">User Answers Received</span>
        </div>

        <div className="space-y-3">
          {questions.map((q) => {
            const answer = answers[q.id];
            if (!answer) return null;

            const hasOptions = answer.selectedOptions.length > 0;
            const hasCustomText = answer.customText && answer.customText.trim() !== '';

            return (
              <div
                key={q.id}
                className="rounded-lg border border-border bg-background/50 p-3 space-y-2 w-full overflow-hidden"
              >
                <div className="flex items-start gap-2 min-w-0">
                  <MessageSquare className="mt-0.5 size-4 text-muted-foreground flex-shrink-0" />
                  <div className="flex-1 space-y-2 min-w-0">
                    <p className="font-medium text-foreground text-sm break-words">{q.question}</p>

                    {hasOptions && (
                      <div className="flex flex-wrap gap-1.5">
                        {answer.selectedOptions.map((option) => (
                          <Badge
                            key={option}
                            variant="secondary"
                            className="bg-blue-500/20 text-blue-700 dark:text-blue-300"
                          >
                            {option}
                          </Badge>
                        ))}
                      </div>
                    )}

                    {hasCustomText && (
                      <div className="rounded border border-dashed border-border bg-muted/50 p-2 overflow-hidden">
                        <p className="text-muted-foreground text-xs italic break-words">
                          {answer.customText}
                        </p>
                      </div>
                    )}

                    {!hasOptions && !hasCustomText && (
                      <p className="text-muted-foreground text-xs italic">No answer provided</p>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </Card>
  );
}
