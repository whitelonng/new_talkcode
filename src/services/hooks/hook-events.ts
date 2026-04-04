import type {
  HookEventName,
  HookInputBase,
  NotificationInput,
  PostToolUseInput,
  PreToolUseInput,
  SessionEndInput,
  SessionStartInput,
  StopInput,
  UserPromptSubmitInput,
} from '@/types/hooks';
import type { ToolInput, ToolOutput } from '@/types/tool';

export interface HookEventContext {
  sessionId: string;
  cwd: string;
  permissionMode: 'default' | 'plan';
}

export function buildBaseInput(event: HookEventName, context: HookEventContext): HookInputBase {
  return {
    session_id: context.sessionId,
    cwd: context.cwd,
    permission_mode: context.permissionMode,
    hook_event_name: event,
  };
}

export function buildUserPromptSubmitInput(
  context: HookEventContext,
  prompt: string
): UserPromptSubmitInput {
  return {
    ...buildBaseInput('UserPromptSubmit', context),
    prompt,
  };
}

export function buildPreToolUseInput(
  context: HookEventContext,
  toolName: string,
  toolInput: ToolInput,
  toolUseId: string
): PreToolUseInput {
  return {
    ...buildBaseInput('PreToolUse', context),
    tool_name: toolName,
    tool_input: toolInput,
    tool_use_id: toolUseId,
  };
}

export function buildPostToolUseInput(
  context: HookEventContext,
  toolName: string,
  toolInput: ToolInput,
  toolResponse: ToolOutput,
  toolUseId: string
): PostToolUseInput {
  return {
    ...buildBaseInput('PostToolUse', context),
    tool_name: toolName,
    tool_input: toolInput,
    tool_response: toolResponse,
    tool_use_id: toolUseId,
  };
}

export function buildNotificationInput(
  context: HookEventContext,
  message: string,
  notificationType: string
): NotificationInput {
  return {
    ...buildBaseInput('Notification', context),
    message,
    notification_type: notificationType,
  };
}

export function buildStopInput(context: HookEventContext, stopHookActive: boolean): StopInput {
  return {
    ...buildBaseInput('Stop', context),
    stop_hook_active: stopHookActive,
  };
}

export function buildSessionStartInput(
  context: HookEventContext,
  source: SessionStartInput['source']
): SessionStartInput {
  return {
    ...buildBaseInput('SessionStart', context),
    source,
  };
}

export function buildSessionEndInput(
  context: HookEventContext,
  reason: SessionEndInput['reason']
): SessionEndInput {
  return {
    ...buildBaseInput('SessionEnd', context),
    reason,
  };
}
