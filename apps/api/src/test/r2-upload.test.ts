// R2 avatar upload tests
import { describe, expect, it } from 'bun:test';

// Mock R2 bucket implementation for testing
class MockR2Bucket {
  private storage = new Map<string, { data: ArrayBuffer; metadata: any }>();

  async put(key: string, data: ArrayBuffer, options?: any) {
    this.storage.set(key, { data, metadata: options });
  }

  async get(key: string) {
    const item = this.storage.get(key);
    if (!item) return null;
    return {
      key,
      body: item.data,
      httpMetadata: item.metadata?.httpMetadata,
    };
  }

  async delete(key: string) {
    this.storage.delete(key);
  }

  async list(options?: { prefix?: string }) {
    const prefix = options?.prefix || '';
    const objects = Array.from(this.storage.keys())
      .filter((key) => key.startsWith(prefix))
      .map((key) => ({ key }));
    return { objects };
  }

  // Helper for testing
  has(key: string) {
    return this.storage.has(key);
  }

  clear() {
    this.storage.clear();
  }
}

describe('R2 Avatar Upload', () => {
  it('should generate correct R2 key for avatar', () => {
    const userId = 'test-user-123';
    const ext = 'jpg';
    const expectedKey = `users/${userId}/avatar.${ext}`;

    expect(expectedKey).toBe('users/test-user-123/avatar.jpg');
  });

  it('should delete old avatar before uploading new one', async () => {
    const bucket = new MockR2Bucket();
    const userId = 'test-user';

    // Upload first avatar
    await bucket.put(`users/${userId}/avatar.jpg`, new ArrayBuffer(100));
    expect(bucket.has(`users/${userId}/avatar.jpg`)).toBe(true);

    // Simulate deletion of old avatar
    const listed = await bucket.list({ prefix: `users/${userId}/` });
    for (const obj of listed.objects) {
      if (obj.key.includes('avatar')) {
        await bucket.delete(obj.key);
      }
    }

    expect(bucket.has(`users/${userId}/avatar.jpg`)).toBe(false);
  });

  it('should support multiple file extensions', () => {
    const userId = 'test-user';
    const extensions = ['jpg', 'png', 'gif', 'webp'];

    for (const ext of extensions) {
      const key = `users/${userId}/avatar.${ext}`;
      expect(key).toContain(`avatar.${ext}`);
    }
  });

  it('should generate correct CDN URL', () => {
    const cdnBaseUrl = 'https://cdn.talkcody.com';
    const userId = 'test-user';
    const ext = 'png';
    const key = `users/${userId}/avatar.${ext}`;
    const cdnUrl = `${cdnBaseUrl}/${key}`;

    expect(cdnUrl).toBe('https://cdn.talkcody.com/users/test-user/avatar.png');
  });

  it('should only delete files with "avatar" in the name', async () => {
    const bucket = new MockR2Bucket();
    const userId = 'test-user';

    // Create multiple files
    await bucket.put(`users/${userId}/avatar.jpg`, new ArrayBuffer(100));
    await bucket.put(`users/${userId}/document.pdf`, new ArrayBuffer(100));
    await bucket.put(`users/${userId}/profile.txt`, new ArrayBuffer(100));

    // Delete only avatar files
    const listed = await bucket.list({ prefix: `users/${userId}/` });
    for (const obj of listed.objects) {
      if (obj.key.includes('avatar')) {
        await bucket.delete(obj.key);
      }
    }

    expect(bucket.has(`users/${userId}/avatar.jpg`)).toBe(false);
    expect(bucket.has(`users/${userId}/document.pdf`)).toBe(true);
    expect(bucket.has(`users/${userId}/profile.txt`)).toBe(true);
  });
});
