// Authentication routes

import { githubAuth } from '@hono/oauth-providers/github';
import { googleAuth } from '@hono/oauth-providers/google';
import type { Context } from 'hono';
import { Hono } from 'hono';
import { authMiddleware, getAuth } from '../middlewares/auth';
import { authService } from '../services/auth-service';
import type { HonoContext } from '../types/context';

const auth = new Hono<HonoContext>();

// Helper to get OAuth config from environment (works in both Bun and Cloudflare Workers)
function normalizeEnvValue(value?: string | null) {
  if (!value) {
    return undefined;
  }
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : undefined;
}

function getOAuthConfig(c: Context<HonoContext>) {
  const env = c.env;
  return {
    githubClientId: normalizeEnvValue(
      env?.GITHUB_CLIENT_ID || (typeof Bun !== 'undefined' ? Bun.env.GITHUB_CLIENT_ID : '')
    ),
    githubClientSecret: normalizeEnvValue(
      env?.GITHUB_CLIENT_SECRET || (typeof Bun !== 'undefined' ? Bun.env.GITHUB_CLIENT_SECRET : '')
    ),
    googleClientId: normalizeEnvValue(
      env?.GOOGLE_CLIENT_ID || (typeof Bun !== 'undefined' ? Bun.env.GOOGLE_CLIENT_ID : '')
    ),
    googleClientSecret: normalizeEnvValue(
      env?.GOOGLE_CLIENT_SECRET || (typeof Bun !== 'undefined' ? Bun.env.GOOGLE_CLIENT_SECRET : '')
    ),
    googleRedirectUri: normalizeEnvValue(
      env?.GOOGLE_REDIRECT_URI || (typeof Bun !== 'undefined' ? Bun.env.GOOGLE_REDIRECT_URI : '')
    ),
  };
}

function renderSuccessPage(deepLink: string) {
  return `
    <!DOCTYPE html>
    <html lang="en">
    <head>
      <meta charset="utf-8">
      <meta name="viewport" content="width=device-width, initial-scale=1">
      <title>Authentication Successful</title>
      <style>
        :root { color-scheme: dark; }
        * { box-sizing: border-box; }
        body {
          margin: 0;
          min-height: 100vh;
          display: flex;
          align-items: center;
          justify-content: center;
          background: radial-gradient(circle at 20% 20%, #1c1c1f, #0b0b0f 60%);
          color: #f5f5f5;
          font-family: "Inter", -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
          letter-spacing: 0.01em;
        }
        .wrap { width: min(540px, 90vw); padding: 32px; }
        .card {
          border: 1px solid rgba(255, 255, 255, 0.08);
          background: rgba(12, 12, 16, 0.85);
          border-radius: 20px;
          padding: 32px;
          box-shadow: 0 18px 50px rgba(0, 0, 0, 0.35);
          backdrop-filter: blur(16px);
          text-align: center;
        }
        .badge {
          display: inline-flex;
          align-items: center;
          justify-content: center;
          width: 56px;
          height: 56px;
          border-radius: 50%;
          border: 1px solid rgba(255, 255, 255, 0.12);
          background: linear-gradient(135deg, rgba(255, 255, 255, 0.08), rgba(255, 255, 255, 0.02));
          font-size: 28px;
          margin-bottom: 20px;
        }
        h1 { margin: 0 0 12px; font-size: 26px; font-weight: 600; color: #f8f8f8; }
        .sub { margin: 0 0 24px; color: #cfcfd4; font-size: 15px; }
        .spinner {
          margin: 0 auto 20px;
          width: 44px;
          height: 44px;
          border-radius: 50%;
          border: 4px solid rgba(255, 255, 255, 0.15);
          border-top-color: #ffffff;
          animation: spin 1s linear infinite;
        }
        @keyframes spin { to { transform: rotate(360deg); } }
        .hint { margin: 0; color: #b6b6bd; line-height: 1.6; font-size: 14px; }
        .link {
          color: #ffffff;
          text-decoration: none;
          border-bottom: 1px solid rgba(255, 255, 255, 0.4);
          padding-bottom: 2px;
          transition: opacity 0.2s ease;
        }
        .link:hover { opacity: 0.7; }
        .actions {
          margin-top: 18px;
          display: flex;
          flex-wrap: wrap;
          justify-content: center;
          gap: 10px;
        }
        .button {
          display: inline-flex;
          align-items: center;
          justify-content: center;
          padding: 10px 14px;
          border-radius: 999px;
          border: 1px solid rgba(255, 255, 255, 0.18);
          background: rgba(255, 255, 255, 0.06);
          color: #ffffff;
          text-decoration: none;
          font-size: 13px;
          transition: transform 0.2s ease, opacity 0.2s ease;
        }
        .button:hover { opacity: 0.85; transform: translateY(-1px); }
        .code {
          margin-top: 16px;
          padding: 12px;
          border-radius: 12px;
          background: rgba(255, 255, 255, 0.06);
          font-family: ui-monospace, SFMono-Regular, SFMono-Regular, Menlo, Consolas, "Liberation Mono", monospace;
          font-size: 12px;
          word-break: break-all;
          color: #d8d8df;
        }
        .copy {
          border: none;
          background: none;
          color: #ffffff;
          text-decoration: underline;
          cursor: pointer;
          font-size: 12px;
        }
      </style>
    </head>
    <body>
      <div class="wrap">
        <div class="card">
          <div class="badge">✓</div>
          <h1>Authentication Successful</h1>
          <p class="sub">Signed in. Redirecting to TalkCody...</p>
          <div class="spinner" aria-label="Loading"></div>
          <p class="hint">
            If the app doesn't open automatically, <a class="link" href="${deepLink}" id="manual-link">click to continue</a> or return to the app to finish.
          </p>
          <div class="actions">
            <a class="button" href="${deepLink}">Open TalkCody</a>
            <button class="button" type="button" id="copy-link">Copy sign-in link</button>
          </div>
          <div class="code" id="link-preview">${deepLink}</div>
          <button class="copy" type="button" id="copy-token">Copy token only</button>
        </div>
      </div>
      <script>
        const deepLink = '${deepLink}';
        const token = new URL(deepLink).searchParams.get('token') || '';

        const copyLinkButton = document.getElementById('copy-link');
        const copyTokenButton = document.getElementById('copy-token');

        const copyText = async (value) => {
          if (!value) return;
          try {
            await navigator.clipboard.writeText(value);
          } catch (error) {
            const textArea = document.createElement('textarea');
            textArea.value = value;
            document.body.appendChild(textArea);
            textArea.select();
            document.execCommand('copy');
            document.body.removeChild(textArea);
          }
        };

        copyLinkButton?.addEventListener('click', () => copyText(deepLink));
        copyTokenButton?.addEventListener('click', () => copyText(token));

        setTimeout(() => { window.location.href = deepLink; }, 900);
        setTimeout(() => { window.close(); }, 9000);
      </script>
    </body>
    </html>
  `;
}

/**
 * GitHub OAuth
 */
// Dynamic middleware that gets config from context
auth.use('/github', async (c, next) => {
  const config = getOAuthConfig(c);
  if (!config.githubClientId || !config.githubClientSecret) {
    return c.json(
      {
        error: 'GitHub OAuth is not configured',
        message: 'Missing GITHUB_CLIENT_ID or GITHUB_CLIENT_SECRET',
      },
      400
    );
  }
  const middleware = githubAuth({
    client_id: config.githubClientId,
    client_secret: config.githubClientSecret,
    scope: ['read:user', 'user:email'],
    oauthApp: true, // Use OAuth App instead of GitHub App (doesn't require email endpoint)
  });
  return middleware(c, next);
});

auth.get('/github', async (c) => {
  const githubUser = c.get('user-github');

  if (!githubUser) {
    return c.json({ error: 'GitHub authentication failed' }, 400);
  }

  try {
    const _config = getOAuthConfig(c);

    console.log('GitHub user data:', {
      id: githubUser.id,
      login: githubUser.login,
      email: githubUser.email,
      name: githubUser.name,
    });

    // Use a fallback email if GitHub email is not available
    const email = githubUser.email || `${githubUser.login}@users.noreply.github.com`;

    // Find or create user
    const user = await authService.findOrCreateUser({
      provider: 'github',
      providerId: githubUser.id?.toString() ?? '',
      email: email,
      name: githubUser.name ?? githubUser.login ?? 'GitHub User',
      avatarUrl: githubUser.avatar_url,
    });

    // Generate JWT token
    const token = await authService.generateToken(user.id, user.email, c.env);

    // Return HTML page that handles deep link redirect
    const deepLink = `talkcody://auth/callback?token=${token}`;
    return c.html(renderSuccessPage(deepLink));
  } catch (error) {
    console.error('GitHub auth error:', error);
    const errorMessage = error instanceof Error ? error.message : 'Authentication failed';
    return c.redirect(`talkcody://auth/error?message=${encodeURIComponent(errorMessage)}`);
  }
});

/**
 * Google OAuth
 */
// Dynamic middleware that gets config from context
// Explicit redirect_uri ensures Google console settings match and avoids code exchange errors.
auth.use('/google', async (c, next) => {
  const config = getOAuthConfig(c);
  if (!config.googleClientId || !config.googleClientSecret) {
    return c.json(
      {
        error: 'Google OAuth is not configured',
        message: 'Missing GOOGLE_CLIENT_ID or GOOGLE_CLIENT_SECRET',
      },
      400
    );
  }
  const baseRedirectUri = config.googleRedirectUri || c.req.url.split('?')[0];
  const middleware = googleAuth({
    client_id: config.googleClientId,
    client_secret: config.googleClientSecret,
    scope: ['openid', 'email', 'profile'],
    redirect_uri: baseRedirectUri,
    access_type: 'offline',
    prompt: 'consent',
  });
  return middleware(c, next);
});

auth.get('/google', async (c) => {
  const googleUser = c.get('user-google');

  if (!googleUser) {
    return c.json({ error: 'Google authentication failed' }, 400);
  }

  try {
    // Find or create user
    const user = await authService.findOrCreateUser({
      provider: 'google',
      providerId: googleUser.id ?? googleUser.sub ?? '',
      email: googleUser.email ?? '',
      name: googleUser.name ?? 'Google User',
      avatarUrl: googleUser.picture,
    });

    // Generate JWT token
    const token = await authService.generateToken(user.id, user.email, c.env);

    // Return HTML page that handles deep link redirect
    const deepLink = `talkcody://auth/callback?token=${token}`;
    return c.html(renderSuccessPage(deepLink));
  } catch (error) {
    console.error('Google auth error:', error);
    const errorMessage = error instanceof Error ? error.message : 'Authentication failed';
    return c.redirect(`talkcody://auth/error?message=${encodeURIComponent(errorMessage)}`);
  }
});

/**
 * Get current user (requires authentication)
 */
auth.get('/me', authMiddleware, async (c) => {
  const { userId } = getAuth(c);

  const user = await authService.getUserById(userId);

  if (!user) {
    return c.json({ error: 'User not found' }, 404);
  }

  return c.json({ user });
});

/**
 * Logout endpoint (client-side token removal)
 */
auth.post('/logout', authMiddleware, async (c) => {
  // JWT is stateless, so logout is handled client-side by removing the token
  return c.json({ message: 'Logged out successfully' });
});

export default auth;
