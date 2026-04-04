/**
 * Type definitions for AskUserQuestions tool
 */

/**
 * A single option for a question
 */
export interface QuestionOption {
  label: string;
  description: string;
}

/**
 * A question to ask the user
 */
export interface Question {
  /** Unique identifier for the question */
  id: string;
  /** The question text to display */
  question: string;
  /** Short header/title for the tab (max 12 chars recommended) */
  header: string;
  /** Available options for the user to choose from */
  options: QuestionOption[];
  /** Whether to allow multiple selections */
  multiSelect: boolean;
}

/**
 * User's answer to a question
 */
export interface QuestionAnswer {
  /** Selected option labels */
  selectedOptions: string[];
  /** Custom text input (if provided) */
  customText?: string;
}

/**
 * Input parameters for AskUserQuestions tool
 */
export interface AskUserQuestionsInput {
  questions: Question[];
}

/**
 * Output from AskUserQuestions tool
 * Maps question ID to the user's answer
 */
export type AskUserQuestionsOutput = Record<string, QuestionAnswer>;
