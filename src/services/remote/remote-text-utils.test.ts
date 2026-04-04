import { describe, expect, it } from 'vitest';
import {
  getRemoteMessageLimit,
  isDuplicateRemoteMessage,
  normalizeRemoteCommand,
  splitRemoteText,
} from '@/services/remote/remote-text-utils';

describe('remote-text-utils', () => {
  it('returns per-channel limits', () => {
    expect(getRemoteMessageLimit('telegram')).toBe(4096);
    expect(getRemoteMessageLimit('feishu')).toBe(4000);
  });

  it('splits text using channel limit', () => {
    const text = 'a'.repeat(5000);
    const chunks = splitRemoteText(text, 'feishu');
    expect(chunks.length).toBeGreaterThan(1);
    expect(chunks.join('')).toBe(text);
  });

  it('deduplicates by channel, chat, and message id', () => {
    expect(isDuplicateRemoteMessage('telegram', 1, 10, 1000)).toBe(false);
    expect(isDuplicateRemoteMessage('telegram', 1, 10, 1000)).toBe(true);
    expect(isDuplicateRemoteMessage('telegram', 1, 11, 1000)).toBe(false);
  });

  it('does not mix dedup state across channels', () => {
    expect(isDuplicateRemoteMessage('telegram', 'chat-a', 'msg-1', 1000)).toBe(false);
    expect(isDuplicateRemoteMessage('feishu', 'chat-a', 'msg-1', 1000)).toBe(false);
    expect(isDuplicateRemoteMessage('telegram', 'chat-a', 'msg-1', 1000)).toBe(true);
  });

  it('normalizes commands with bot suffix', () => {
    expect(normalizeRemoteCommand('/status@TalkCodyBot')).toBe('/status');
    expect(normalizeRemoteCommand('/new@TalkCodyBot hello')).toBe('/new hello');
  });

  it('passes through non-commands', () => {
    expect(normalizeRemoteCommand('hello')).toBe('hello');
  });
});
