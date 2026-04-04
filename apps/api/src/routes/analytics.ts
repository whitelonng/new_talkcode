// Analytics routes

import { eq } from 'drizzle-orm';
import { Hono } from 'hono';
import { db } from '../db/client';
import { users } from '../db/schema';
import { verifyToken } from '../lib/jwt';
import { authMiddleware, getAuth } from '../middlewares/auth';
import { analyticsService } from '../services/analytics-service';
import type { HonoContext } from '../types/context';

const analytics = new Hono<HonoContext>();

// POST /api/analytics/events - Track event (no auth required)
analytics.post('/events', async (c) => {
  try {
    const body = await c.req.json();
    const { eventType, sessionId, osName, osVersion, appVersion } = body;

    // Accept deviceId from header (preferred) or body (for sendBeacon which can't set headers)
    const deviceId = c.req.header('X-Device-ID') || body.deviceId;
    if (!deviceId) {
      return c.json({ error: 'X-Device-ID header or deviceId in body required' }, 400);
    }

    if (!eventType || !sessionId) {
      return c.json({ error: 'eventType and sessionId are required' }, 400);
    }

    if (!['session_start', 'session_end'].includes(eventType)) {
      return c.json({ error: 'Invalid eventType' }, 400);
    }

    // Get country from Cloudflare header
    const country = c.req.header('CF-IPCountry') || undefined;

    await analyticsService.trackEvent({
      deviceId,
      eventType,
      sessionId,
      osName,
      osVersion,
      appVersion,
      country,
    });

    return c.json({ success: true });
  } catch (error) {
    console.error('Track event error:', error);
    return c.json({ error: 'Failed to track event' }, 500);
  }
});

// GET /api/analytics/dashboard - Admin dashboard (JSON)
analytics.get('/dashboard', authMiddleware, async (c) => {
  try {
    const { userId } = getAuth(c);

    // Check if user is admin
    const [user] = await db
      .select({ role: users.role })
      .from(users)
      .where(eq(users.id, userId))
      .limit(1);

    if (user?.role !== 'admin') {
      return c.json({ error: 'Admin access required' }, 403);
    }

    const stats = await analyticsService.getDashboardStats();
    return c.json({ stats });
  } catch (error) {
    console.error('Dashboard error:', error);
    return c.json({ error: 'Failed to get dashboard' }, 500);
  }
});

// GET /api/analytics/dashboard/html - Admin dashboard (HTML page)
// Supports both Authorization header and ?token= query parameter for browser access
analytics.get('/dashboard/html', async (c) => {
  try {
    // Try to get token from query parameter first (for browser access)
    let userId: string | null = null;
    const queryToken = c.req.query('token');

    if (queryToken) {
      const payload = await verifyToken(queryToken, c.env);
      if (payload?.userId) {
        userId = payload.userId;
      }
    }

    // Fall back to Authorization header
    if (!userId) {
      const authHeader = c.req.header('Authorization');
      if (authHeader?.startsWith('Bearer ')) {
        const token = authHeader.slice(7);
        const payload = await verifyToken(token, c.env);
        if (payload?.userId) {
          userId = payload.userId;
        }
      }
    }

    if (!userId) {
      return c.html(
        '<h1>401 Unauthorized - Token required</h1><p>Add ?token=YOUR_JWT_TOKEN to the URL</p>',
        401
      );
    }

    // Check if user is admin
    const [user] = await db
      .select({ role: users.role })
      .from(users)
      .where(eq(users.id, userId))
      .limit(1);

    if (user?.role !== 'admin') {
      return c.html('<h1>403 Forbidden - Admin access required</h1>', 403);
    }

    const stats = await analyticsService.getDashboardStats();

    const html = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>TalkCody Analytics Dashboard</title>
  <style>
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body {
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
      background: #f5f5f5;
      color: #333;
      padding: 2rem;
      max-width: 1200px;
      margin: 0 auto;
    }
    h1 { margin-bottom: 0.5rem; }
    .subtitle { color: #666; margin-bottom: 2rem; }
    .grid {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
      gap: 1rem;
      margin-bottom: 2rem;
    }
    .card {
      background: white;
      padding: 1.5rem;
      border-radius: 12px;
      box-shadow: 0 1px 3px rgba(0,0,0,0.1);
    }
    .card h3 {
      margin: 0 0 0.5rem;
      color: #666;
      font-size: 0.875rem;
      text-transform: uppercase;
      letter-spacing: 0.5px;
    }
    .card .value {
      font-size: 2.5rem;
      font-weight: 700;
      color: #111;
    }
    .card .unit {
      font-size: 1rem;
      color: #666;
      font-weight: normal;
    }
    h2 {
      margin: 2rem 0 1rem;
      font-size: 1.25rem;
    }
    table {
      width: 100%;
      border-collapse: collapse;
      background: white;
      border-radius: 12px;
      overflow: hidden;
      box-shadow: 0 1px 3px rgba(0,0,0,0.1);
      margin-bottom: 2rem;
    }
    th, td {
      padding: 1rem;
      text-align: left;
      border-bottom: 1px solid #eee;
    }
    th { background: #f9f9f9; font-weight: 600; }
    tr:last-child td { border-bottom: none; }
    .chart {
      background: white;
      padding: 1.5rem;
      border-radius: 12px;
      box-shadow: 0 1px 3px rgba(0,0,0,0.1);
      margin-bottom: 2rem;
    }
    .bar-chart {
      display: flex;
      align-items: flex-end;
      gap: 4px;
      height: 150px;
      padding-top: 1rem;
    }
    .bar {
      flex: 1;
      background: #3b82f6;
      border-radius: 4px 4px 0 0;
      min-width: 8px;
      position: relative;
      cursor: pointer;
      transition: background 0.2s;
    }
    .bar:hover { background: #2563eb; }
    .bar-label {
      position: absolute;
      bottom: -20px;
      left: 50%;
      transform: translateX(-50%);
      font-size: 10px;
      color: #666;
      white-space: nowrap;
    }
    .tooltip {
      position: fixed;
      background: #1f2937;
      color: white;
      padding: 8px 12px;
      border-radius: 6px;
      font-size: 13px;
      pointer-events: none;
      opacity: 0;
      transition: opacity 0.2s;
      z-index: 1000;
      white-space: nowrap;
      box-shadow: 0 4px 6px rgba(0,0,0,0.15);
      transform: translateX(-50%);
    }
    .tooltip::after {
      content: '';
      position: absolute;
      top: 100%;
      left: 50%;
      margin-left: -5px;
      border-width: 5px;
      border-style: solid;
      border-color: #1f2937 transparent transparent transparent;
    }
    .tooltip .date { font-weight: 600; margin-bottom: 2px; }
    .tooltip .count { color: #93c5fd; }
  </style>
</head>
<body>
  <h1>TalkCody Analytics</h1>
  <p class="subtitle">Updated: ${new Date().toISOString()}</p>

  <div class="grid">
    <div class="card">
      <h3>Daily Active Users</h3>
      <div class="value">${stats.dau}</div>
    </div>
    <div class="card">
      <h3>Monthly Active Users</h3>
      <div class="value">${stats.mau}</div>
    </div>
    <div class="card">
      <h3>Registered Users</h3>
      <div class="value">${stats.totalUsers}</div>
    </div>
    <div class="card">
      <h3>Avg Session Duration</h3>
      <div class="value">${stats.avgSessionDurationMinutes.toFixed(1)} <span class="unit">min</span></div>
    </div>
  </div>

  <h2>Daily Active Users (Last 30 Days)</h2>
  <div class="chart">
    <div class="bar-chart">
      ${(() => {
        const maxCount = Math.max(...stats.dailyActiveHistory.map((d) => d.count), 1);
        return stats.dailyActiveHistory
          .map(
            (d) => `
          <div class="bar" style="height: ${(d.count / maxCount) * 100}%" data-date="${d.date}" data-count="${d.count}">
            <span class="bar-label">${d.date.slice(5)}</span>
          </div>
        `
          )
          .join('');
      })()}
    </div>
  </div>

  <h2>Top Countries</h2>
  <table>
    <tr><th>Country</th><th>Unique Devices</th></tr>
    ${stats.topCountries.map((c) => `<tr><td>${c.country}</td><td>${c.count}</td></tr>`).join('')}
    ${stats.topCountries.length === 0 ? '<tr><td colspan="2">No data yet</td></tr>' : ''}
  </table>

  <h2>App Versions</h2>
  <table>
    <tr><th>Version</th><th>Unique Devices</th></tr>
    ${stats.topVersions.map((v) => `<tr><td>${v.version}</td><td>${v.count}</td></tr>`).join('')}
    ${stats.topVersions.length === 0 ? '<tr><td colspan="2">No data yet</td></tr>' : ''}
  </table>

  <h2>Operating Systems</h2>
  <table>
    <tr><th>OS</th><th>Unique Devices</th></tr>
    ${stats.topOS.map((o) => `<tr><td>${o.os}</td><td>${o.count}</td></tr>`).join('')}
    ${stats.topOS.length === 0 ? '<tr><td colspan="2">No data yet</td></tr>' : ''}
  </table>

  <div class="tooltip" id="tooltip">
    <div class="date"></div>
    <div class="count"></div>
  </div>

  <script>
    const tooltip = document.getElementById('tooltip');
    const bars = document.querySelectorAll('.bar');

    bars.forEach(bar => {
      bar.addEventListener('mouseenter', (e) => {
        const date = bar.dataset.date;
        const count = bar.dataset.count;
        tooltip.querySelector('.date').textContent = date;
        tooltip.querySelector('.count').textContent = count + ' active users';
        tooltip.style.opacity = '1';
      });

      bar.addEventListener('mousemove', (e) => {
        const rect = bar.getBoundingClientRect();
        tooltip.style.left = (rect.left + rect.width / 2) + 'px';
        tooltip.style.top = (rect.top - tooltip.offsetHeight - 10) + 'px';
      });

      bar.addEventListener('mouseleave', () => {
        tooltip.style.opacity = '0';
      });
    });
  </script>
</body>
</html>`;

    return c.html(html);
  } catch (error) {
    console.error('Dashboard HTML error:', error);
    return c.html('<h1>500 Internal Server Error</h1>', 500);
  }
});

export default analytics;
