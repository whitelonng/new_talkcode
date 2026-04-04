// TalkCody provider - Free AI provider for TalkCody users
// Auth is handled by Rust (JWT token), frontend only passes metadata.

export type TalkCodyProviderPlaceholder = {
  providerId: 'talkcody';
  requiresAuth: boolean;
};

export function createTalkCodyProvider(): TalkCodyProviderPlaceholder {
  return {
    providerId: 'talkcody',
    requiresAuth: true,
  };
}
