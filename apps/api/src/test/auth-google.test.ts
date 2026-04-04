// Google OAuth route validation tests
import { describe, expect, it } from 'bun:test';
import { app } from '../index';

const baseEnv = {
  JWT_SECRET: 'test-jwt-secret',
  TURSO_DATABASE_URL: 'file:./test.db',
  TURSO_AUTH_TOKEN: 'test-token',
  GOOGLE_CLIENT_ID: 'test-google-client-id',
  GOOGLE_CLIENT_SECRET: 'test-google-client-secret',
};

describe('Auth API - Google OAuth', () => {
  it('should reject request when Google client config is missing', async () => {
    const res = await app.request('/api/auth/google', {
      env: {
        JWT_SECRET: 'test-jwt-secret',
        TURSO_DATABASE_URL: 'file:./test.db',
        TURSO_AUTH_TOKEN: 'test-token',
      },
    });

    expect(res.status).toBe(400);

    const data = await res.json();
    expect(data).toHaveProperty('error');
  });

  it('should redirect to Google when config is provided', async () => {
    const res = await app.request('/api/auth/google', {
      env: baseEnv,
    });

    expect(res.status).toBe(302);

    const location = res.headers.get('location');
    expect(location).toContain('https://accounts.google.com/o/oauth2/v2/auth?');
    expect(location).toContain('client_id=test-google-client-id');
    expect(location).toContain('scope=openid');
  });
});
