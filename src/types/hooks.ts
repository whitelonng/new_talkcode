export type HookEventName =
  | 'PreToolUse'
  | 'PostToolUse'
  | 'UserPromptSubmit'
  | 'Notification'
  | 'Stop'
  | 'SessionStart'
  | 'SessionEnd';

export type HookCommandType = 'command';

export interface HookCommand {
  type: HookCommandType;
  command: string;
  timeout?: number; // Seconds
  enabled?: boolean;
  description?: string;
}

export interface HookRule {
  matcher?: string;
  hooks: HookCommand[];
  enabled?: boolean;
  description?: string;
}

export interface HooksConfigFile {
  hooks?: Partial<Record<HookEventName, HookRule[]>>;
}

export type HookConfigScope = 'user' | 'project' | 'local';

export interface HookInputBase {
  session_id: string;
  cwd: string;
  permission_mode: 'default' | 'plan';
  hook_event_name: HookEventName;
}

export interface PreToolUseInput extends HookInputBase {
  tool_name: string;
  tool_input: unknown;
  tool_use_id: string;
}

export interface PostToolUseInput extends HookInputBase {
  tool_name: string;
  tool_input: unknown;
  tool_response: unknown;
  tool_use_id: string;
}

export interface UserPromptSubmitInput extends HookInputBase {
  prompt: string;
}

export interface NotificationInput extends HookInputBase {
  message: string;
  notification_type: string;
}

export interface StopInput extends HookInputBase {
  stop_hook_active?: boolean;
}

export interface SessionStartInput extends HookInputBase {
  source: 'startup' | 'resume' | 'clear' | 'compact';
}

export interface SessionEndInput extends HookInputBase {
  reason: 'clear' | 'logout' | 'prompt_input_exit' | 'other';
}

export interface HookOutputCommon {
  continue?: boolean;
  stopReason?: string;
  suppressOutput?: boolean;
  systemMessage?: string;
  decision?: 'block' | 'allow' | 'ask' | 'approve' | 'deny';
  reason?: string;
  additionalContext?: string;
  updatedInput?: unknown;
  hookSpecificOutput?: {
    hookEventName?: HookEventName;
    additionalContext?: string;
    updatedInput?: unknown;
    permissionDecision?: 'allow' | 'deny' | 'ask';
    permissionDecisionReason?: string;
  };
}

export interface HookRunSummary {
  blocked: boolean;
  blockReason?: string;
  permissionDecision?: 'allow' | 'deny' | 'ask';
  permissionDecisionReason?: string;
  updatedInput?: unknown;
  additionalContext: string[];
  continue: boolean;
  stopReason?: string;
  systemMessage?: string;
}
