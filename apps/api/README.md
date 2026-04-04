# TalkCody Agent Marketplace API

The backend API service for TalkCody Agent Marketplace, built with Hono, Bun, and Drizzle ORM.

## Tech Stack

- **Runtime**: Bun
- **Framework**: Hono
- **Database**: Neon (Serverless PostgreSQL)
- **ORM**: Drizzle
- **Authentication**: @hono/oauth-providers (GitHub, Google)
- **Validation**: Zod
- **JWT**: jose

## Getting Started

### Prerequisites

- Bun >= 1.0.0
- Neon PostgreSQL database (free tier available)
- GitHub OAuth App credentials
- Google OAuth App credentials

### Setup

1. Install dependencies:

```bash
bun install
```

2. Copy environment variables:

```bash
cp .env.example .env
```

3. Fill in your `.env` file with actual values:

```env
DATABASE_URL=postgresql://user:password@host:5432/database
JWT_SECRET=your-secure-random-string
GITHUB_CLIENT_ID=your-github-app-id
GITHUB_CLIENT_SECRET=your-github-app-secret
GOOGLE_CLIENT_ID=your-google-app-id
GOOGLE_CLIENT_SECRET=your-google-app-secret
# Optional: explicit callback URL registered in Google Console
# Example: https://api.talkcody.com/api/auth/google
GOOGLE_REDIRECT_URI=
```

4. Generate database migrations:

```bash
bun run db:generate
```

5. Run migrations:

```bash
bun run db:migrate
```

6. Seed the database with initial data:

```bash
bun run db:seed
```

### Development

Run the development server with hot reload:

```bash
bun run dev
```

The API will be available at `http://localhost:3000`

### Testing

Run tests:

```bash
bun test
```

### Database Management

```bash
# Generate migrations from schema changes
bun run db:generate

# Run migrations
bun run db:migrate

# Push schema changes directly (dev only)
bun run db:push

# Open Drizzle Studio (database GUI)
bun run db:studio

# Seed database with initial data
bun run db:seed
```

### Building for Production

Build for Bun runtime:

```bash
bun run build
```

Build for Cloudflare Workers:

```bash
bun run build:cloudflare
```

### Deployment

#### Cloudflare Workers

1. Install Wrangler CLI:

```bash
bun install -g wrangler
```

2. Login to Cloudflare:

```bash
wrangler login
```

3. Set environment variables:

```bash
wrangler secret put DATABASE_URL
wrangler secret put JWT_SECRET
wrangler secret put GITHUB_CLIENT_ID
wrangler secret put GITHUB_CLIENT_SECRET
wrangler secret put GOOGLE_CLIENT_ID
wrangler secret put GOOGLE_CLIENT_SECRET
```

4. Deploy:

```bash
bun run deploy
```

#### Other Platforms (Railway, Fly.io, etc.)

Use the standard Bun deployment process for your platform.

## API Endpoints

### Health Check

- `GET /health` - Health check and database status

### Authentication

- `GET /api/auth/github` - GitHub OAuth
- `GET /api/auth/github/callback` - GitHub OAuth callback
- `GET /api/auth/google` - Google OAuth
- `GET /api/auth/google/callback` - Google OAuth callback
- `GET /api/auth/me` - Get current user (requires auth)
- `POST /api/auth/logout` - Logout

### Marketplace (Public)

- `GET /api/marketplace/agents` - List agents (with filters)
- `GET /api/marketplace/agents/featured` - Featured agents
- `GET /api/marketplace/agents/:slug` - Agent details
- `GET /api/marketplace/agents/:slug/versions` - Agent versions
- `GET /api/marketplace/agents/:slug/versions/:version` - Version details
- `POST /api/marketplace/agents/:slug/download` - Track download
- `POST /api/marketplace/agents/:slug/install` - Track install
- `GET /api/marketplace/categories` - List categories
- `GET /api/marketplace/tags` - List tags
- `GET /api/marketplace/collections` - List collections
- `GET /api/marketplace/collections/:slug` - Collection details

### Agents (Requires Auth)

- `POST /api/agents` - Publish new agent
- `PUT /api/agents/:slug` - Update agent
- `DELETE /api/agents/:slug` - Delete agent
- `POST /api/agents/:slug/versions` - Publish new version

### Users (Requires Auth)

- `GET /api/users/me/agents` - Get my agents
- `GET /api/users/me/stats` - Get my statistics

## Project Structure

```
apps/api/
├── src/
│   ├── index.ts              # Main application entry
│   ├── db/
│   │   ├── schema.ts         # Database schema
│   │   ├── client.ts         # Database connection
│   │   ├── migrate.ts        # Migration script
│   │   ├── seed.ts           # Seed script
│   │   └── migrations/       # Migration files
│   ├── routes/               # API routes
│   │   ├── auth.ts
│   │   ├── marketplace.ts
│   │   ├── agents.ts
│   │   └── users.ts
│   ├── services/             # Business logic
│   │   ├── agent-service.ts
│   │   ├── user-service.ts
│   │   ├── auth-service.ts
│   │   └── stats-service.ts
│   ├── middlewares/          # Middleware
│   │   ├── auth.ts
│   │   └── error-handler.ts
│   ├── lib/                  # Utilities
│   │   ├── jwt.ts
│   │   └── utils.ts
│   └── types/                # Type definitions
│       ├── env.ts
│       └── context.ts
├── package.json
├── tsconfig.json
├── drizzle.config.ts
├── wrangler.toml
└── README.md
```

## License

MIT
