export type SessionId = string;

export type SessionStatusEvent = {
  type: 'status'
  data: { message: string }
}

export type SessionTokenEvent = {
  type: 'token'
  data: { token: string }
}

export type SessionMessageFinalEvent = {
  type: 'message.final'
  data: { messageId: string; content: string }
}

export type SessionToolCallEvent = {
  type: 'tool.call'
  data: { toolCallId: string; name: string; input: unknown }
}

export type SessionToolResultEvent = {
  type: 'tool.result'
  data: { toolCallId: string; output: unknown }
}

export type SessionErrorEvent = {
  type: 'error'
  data: { message: string }
}

export type SessionEventEnvelope =
  | SessionStatusEvent
  | SessionTokenEvent
  | SessionMessageFinalEvent
  | SessionToolCallEvent
  | SessionToolResultEvent
  | SessionErrorEvent

export type CreateSessionRequest = {
  projectId?: string
  taskSettings?: Record<string, unknown>
}

export type CreateSessionResponse = {
  sessionId: SessionId
}

export type TaskSettings = {
  autoApproveEdits?: boolean
  autoApprovePlan?: boolean
  autoCodeReview?: boolean
}
