import { render, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { WhatsNewDialog } from './whats-new-dialog';

vi.mock('@tauri-apps/api/app', () => ({
  getVersion: vi.fn(() => Promise.resolve('0.3.1')),
}));

vi.mock('@tauri-apps/plugin-shell', () => ({
  open: vi.fn(() => Promise.resolve()),
}));

const mockPlatform = vi.fn(() => Promise.resolve('macos'));
vi.mock('@tauri-apps/plugin-os', () => ({
  platform: () => mockPlatform(),
}));

const mockChangelog = {
  version: '0.3.1',
  date: '2026-01-01',
  en: {
    added: [{ title: 'Demo video', videoUrl: 'https://example.com/demo.mp4' }],
    changed: [],
    fixed: [],
    removed: [],
  },
  zh: {
    added: [{ title: 'Demo video', videoUrl: 'https://example.com/demo.mp4' }],
    changed: [],
    fixed: [],
    removed: [],
  },
};

vi.mock('@/services/changelog-service', () => ({
  getChangelogForVersion: () => mockChangelog,
  getLatestChangelog: () => mockChangelog,
}));

vi.mock('@/stores/settings-store', () => ({
  useSettingsStore: vi.fn((selector) => {
    const state = {
      last_seen_version: '0.3.0',
      setLastSeenVersion: vi.fn(),
      isInitialized: true,
      language: 'en',
    };
    return selector ? selector(state) : state;
  }),
}));


describe('WhatsNewDialog video previews', () => {
  beforeEach(() => {
    mockPlatform.mockResolvedValue('macos');
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  it('does not render video previews on Linux', async () => {
    mockPlatform.mockResolvedValue('linux');

    render(<WhatsNewDialog forceOpen={true} />);

    await waitFor(() => {
      expect(document.querySelectorAll('video').length).toBe(0);
    });
  });

  it('renders video previews on non-Linux platforms', async () => {
    mockPlatform.mockResolvedValue('macos');

    render(<WhatsNewDialog forceOpen={true} />);

    await waitFor(() => {
      expect(document.querySelectorAll('video').length).toBeGreaterThan(0);
    });
  });
});
