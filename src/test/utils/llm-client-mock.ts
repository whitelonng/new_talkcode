import type { StreamEvent } from '@/services/llm/types';

export function createLlmEventStream(events: StreamEvent[]) {
  return {
    events: (async function* () {
      for (const event of events) {
        yield event;
      }
    })(),
  };
}

export function createTextOnlyEvents(chunks: string[], finishReason = 'stop'): StreamEvent[] {
  return [
    { type: 'text-start' },
    ...chunks.map((text) => ({ type: 'text-delta', text }) as StreamEvent),
    { type: 'done', finish_reason: finishReason },
  ];
}
