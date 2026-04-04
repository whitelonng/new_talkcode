// Auth service tests - focusing on avatar preservation during OAuth login
import { afterAll, beforeAll, describe, expect, it } from 'bun:test';
import { eq } from 'drizzle-orm';
import { users } from '../db/schema';
import { authService } from '../services/auth-service';
import { testDb as db } from './db-client';
import { clearDatabase, verifyTestEnvironment } from './fixtures';

// Initialize test database before all tests
beforeAll(async () => {
  console.log('\n🔧 Setting up auth service test environment...\n');
  verifyTestEnvironment();
  await clearDatabase();
  console.log('\n✅ Auth service test environment ready\n');
});

// Clean up after all tests
afterAll(async () => {
  console.log('\n🧹 Cleaning up auth service test environment...\n');
  await clearDatabase();
  console.log('✅ Cleanup complete\n');
});

describe('AuthService - Avatar handling during OAuth login', () => {
  it('should use OAuth avatar when creating a new user', async () => {
    const oauthProfile = {
      provider: 'github' as const,
      providerId: 'github-new-user-123',
      email: 'newuser@example.com',
      name: 'New User',
      avatarUrl: 'https://github.com/avatar/new-user.png',
    };

    const user = await authService.findOrCreateUser(oauthProfile);

    expect(user.avatarUrl).toBe('https://github.com/avatar/new-user.png');
  });

  it('should preserve existing avatar when user re-logs in via OAuth', async () => {
    // First, create a user with GitHub OAuth
    const initialProfile = {
      provider: 'github' as const,
      providerId: 'github-existing-user-456',
      email: 'existinguser@example.com',
      name: 'Existing User',
      avatarUrl: 'https://github.com/avatar/initial.png',
    };

    await authService.findOrCreateUser(initialProfile);

    // Simulate user uploading a custom avatar
    const customAvatarUrl = 'https://r2.talkcody.com/users/custom-avatar.png';
    await db
      .update(users)
      .set({ avatarUrl: customAvatarUrl })
      .where(eq(users.githubId, 'github-existing-user-456'));

    // Now user logs in again via GitHub with a different avatar URL
    const reLoginProfile = {
      provider: 'github' as const,
      providerId: 'github-existing-user-456',
      email: 'existinguser@example.com',
      name: 'Existing User',
      avatarUrl: 'https://github.com/avatar/updated.png', // GitHub's new avatar
    };

    const user = await authService.findOrCreateUser(reLoginProfile);

    // The custom avatar should be preserved, NOT overwritten by GitHub's avatar
    expect(user.avatarUrl).toBe(customAvatarUrl);
  });

  it('should use OAuth avatar when existing user has no avatar', async () => {
    // First, create a user without an avatar via email lookup scenario
    await db.insert(users).values({
      email: 'noavatar@example.com',
      name: 'No Avatar User',
      avatarUrl: null,
      role: 'user',
      isVerified: true,
    });

    // User logs in via GitHub (linking account by email)
    const oauthProfile = {
      provider: 'github' as const,
      providerId: 'github-noavatar-789',
      email: 'noavatar@example.com',
      name: 'No Avatar User',
      avatarUrl: 'https://github.com/avatar/noavatar.png',
    };

    const user = await authService.findOrCreateUser(oauthProfile);

    // Since user had no avatar, OAuth avatar should be used
    expect(user.avatarUrl).toBe('https://github.com/avatar/noavatar.png');
  });

  it('should preserve avatar when linking account by email', async () => {
    // Create a user with a custom avatar (e.g., registered via Google first)
    await db.insert(users).values({
      email: 'multiauth@example.com',
      name: 'Multi Auth User',
      avatarUrl: 'https://r2.talkcody.com/users/google-avatar.png',
      googleId: 'google-multiauth-123',
      role: 'user',
      isVerified: true,
    });

    // User now logs in via GitHub (linking account by email)
    const githubProfile = {
      provider: 'github' as const,
      providerId: 'github-multiauth-456',
      email: 'multiauth@example.com',
      name: 'Multi Auth User',
      avatarUrl: 'https://github.com/avatar/multiauth.png',
    };

    const user = await authService.findOrCreateUser(githubProfile);

    // The existing avatar should be preserved
    expect(user.avatarUrl).toBe('https://r2.talkcody.com/users/google-avatar.png');
  });
});
