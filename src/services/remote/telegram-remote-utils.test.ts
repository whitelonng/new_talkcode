import { describe, expect, it } from 'vitest';
import {
  isDuplicateTelegramMessage,
  normalizeTelegramCommand,
  parseAllowedChatIds,
  splitTelegramText,
} from '@/services/remote/telegram-remote-utils';

describe('telegram-remote-utils', () => {
  it('normalizes commands with bot suffix', () => {
    expect(normalizeTelegramCommand('/status@TalkCodyBot')).toBe('/status');
    expect(normalizeTelegramCommand('/new@TalkCodyBot hello')).toBe('/new hello');
  });

  it('passes through non-commands', () => {
    expect(normalizeTelegramCommand('hello')).toBe('hello');
  });

  it('deduplicates by channel, chat, and message id', () => {
    expect(isDuplicateTelegramMessage('telegram', 1, 10, 1000)).toBe(false);
    expect(isDuplicateTelegramMessage('telegram', 1, 10, 1000)).toBe(true);
    expect(isDuplicateTelegramMessage('telegram', 1, 11, 1000)).toBe(false);
  });

  it('does not mix dedup state across channels', () => {
    expect(isDuplicateTelegramMessage('telegram', 'chat-a', 'msg-1', 1000)).toBe(false);
    expect(isDuplicateTelegramMessage('feishu', 'chat-a', 'msg-1', 1000)).toBe(false);
    expect(isDuplicateTelegramMessage('telegram', 'chat-a', 'msg-1', 1000)).toBe(true);
  });

  it('parses allowed chat ids and filters invalid/zero values', () => {
    expect(parseAllowedChatIds('')).toEqual([]);
    expect(parseAllowedChatIds('   ')).toEqual([]);
    expect(parseAllowedChatIds(',')).toEqual([]);
    expect(parseAllowedChatIds('0, 0')).toEqual([]);
    expect(parseAllowedChatIds('123, abc, 0, 456')).toEqual([123, 456]);
  });

  it('keeps large numeric chat ids intact', () => {
    expect(parseAllowedChatIds('8136227891')).toEqual([8136227891]);
  });

  it('handles null and undefined safely', () => {
    expect(parseAllowedChatIds(null)).toEqual([]);
    expect(parseAllowedChatIds(undefined)).toEqual([]);
  });

  it('splits long text into chunks', () => {
    const text = 'a'.repeat(5000);
    const chunks = splitTelegramText(text, 4096);
    expect(chunks.length).toBeGreaterThan(1);
    expect(chunks.join('')).toBe(text);
  });
});
