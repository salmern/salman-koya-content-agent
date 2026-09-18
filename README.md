# Koya Content Agent

A production-grade AI content research and publishing platform for small marketing teams.

The system takes a content idea and moves it through a supervised pipeline: AI-assisted research, structured drafting, automated evaluation, human review, channel adaptation (LinkedIn / X / Newsletter), and publishing — with humans in control at every critical gate.

---

## What it does

- **Research**: Retrieves and analyses source URLs using Firecrawl. Summarises and scores each source for relevance using Claude.
- **Planning**: Generates a structured content plan with outline, keywords, and source-to-section mapping.
- **Drafting**: Writes a full article grounded in reviewed sources. Flags unsupported claims.
- **Evaluation**: Scores the draft on 9 dimensions (source grounding, SEO, audience fit, etc.). Recommends revisions.
- **Revision loop**: Auto-revises up to 3 times before escalating to human review.
- **Human review**: Reviewers approve, reject, or request revisions with feedback.
- **Channel adaptation**: Generates LinkedIn post, X thread, and email newsletter from the approved article.
- **Publishing**: Queues content for immediate or scheduled publishing. Prevents duplicate publishing via idempotency keys.
- **Audit log**: Every action is recorded immutably.

---

## Tech stack

- **Framework**: Next.js 15 (App Router), TypeScript, React 19
- **Styling**: Tailwind CSS
- **Database**: Supabase (PostgreSQL + Auth + Row Level Security)
- **AI**: Anthropic Claude (structured JSON outputs)
- **Research**: Firecrawl
- **Testing**: Vitest + Testing Library

---

## Local setup

### Prerequisites

- Node.js 18+
- A [Supabase](https://supabase.com) project
- An [Anthropic](https://console.anthropic.com) API key (optional — mock mode works without it)
- A [Firecrawl](https://firecrawl.dev) API key (optional — mock mode works without it)

### 1. Clone and install

```bash
git clone <your-repo-url>
cd koya-content-agent
npm install
```

### 2. Configure environment

```bash
cp .env.example .env.local
```

Edit `.env.local` and fill in:

```env
NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key

ANTHROPIC_API_KEY=your-claude-key
FIRECRAWL_API_KEY=your-firecrawl-key

# Use 'mock' to run without real AI/research APIs
AI_PROVIDER=mock
RESEARCH_PROVIDER=mock
PUBLISHING_PROVIDER=mock
```

### 3. Set up the database

In your Supabase dashboard, navigate to **SQL Editor** and run the migrations in order:

```
supabase/migrations/001_initial_schema.sql
supabase/migrations/002_rls_policies.sql
supabase/migrations/003_demo_seed.sql
```

Or using the Supabase CLI:

```bash
supabase db push
```

### 4. Create demo users (optional)

After running migrations, create accounts in **Supabase Auth → Users**:

| Email | Password | Role |
|---|---|---|
| `admin@koya-demo.com` | `DemoAdmin2026!` | admin |
| `reviewer@koya-demo.com` | `DemoReview2026!` | reviewer |
| `manager@koya-demo.com` | `DemoManager2026!` | content_manager |

Then update roles in SQL:
```sql
UPDATE profiles SET role = 'admin'    WHERE email = 'admin@koya-demo.com';
UPDATE profiles SET role = 'reviewer' WHERE email = 'reviewer@koya-demo.com';
```

Or run the demo seed script:

```bash
node scripts/seed-demo.mjs
```

### 5. Run locally

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

---

## Environment variables

| Variable | Required | Description |
|---|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | Yes | Your Supabase project URL |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Yes | Supabase anon/public key |
| `SUPABASE_SERVICE_ROLE_KEY` | Yes | Service role key — server only, never expose to browser |
| `ANTHROPIC_API_KEY` | For real AI | Claude API key |
| `ANTHROPIC_MODEL` | No | Defaults to `claude-opus-4-5` |
| `FIRECRAWL_API_KEY` | For real research | Firecrawl API key |
| `AI_PROVIDER` | No | `mock` (default) or `real` |
| `RESEARCH_PROVIDER` | No | `mock` (default) or `real` |
| `PUBLISHING_PROVIDER` | No | `mock` (default — no real publishing integrations yet) |
| `ENFORCE_SEPARATION_OF_DUTIES` | No | `true` (default) — prevents self-approval |
| `MAX_AUTO_REVISIONS` | No | `3` (default) — hard cap on AI revision loop |
| `API_RATE_LIMIT_PER_MINUTE` | No | `60` (default) |
| `NEXT_PUBLIC_DEMO_MODE` | No | `true` shows demo badge and sample credentials |

---

## Running tests

```bash
# All tests (unit + integration)
npm test

# Watch mode
npm run test:watch

# Type check
npm run type-check

# Lint
npm run lint
```

All tests use mock providers — no external API calls required.

---

## Deployment

### Vercel

1. Push to GitHub
2. Import the repo in [Vercel](https://vercel.com)
3. Add all environment variables from `.env.example`
4. Set `AI_PROVIDER=real`, `RESEARCH_PROVIDER=real` in Vercel env
5. Deploy

The `SUPABASE_SERVICE_ROLE_KEY` must be set as a **server-side only** env var (not prefixed with `NEXT_PUBLIC_`).

### Supabase

1. Create a project at [supabase.com](https://supabase.com)
2. Run the SQL migrations in `supabase/migrations/` in order
3. Enable email auth in **Auth → Providers**
4. Set your site URL and redirect URLs in **Auth → URL Configuration**:
   - Site URL: `https://your-app.vercel.app`
   - Redirect URL: `https://your-app.vercel.app/auth/callback`

---

## Project structure

```
src/
  app/
    (auth)/           — Login, signup, OAuth callback
    (dashboard)/      — Protected dashboard pages
    api/              — API routes (all server-side, authenticated)
  components/
    auth/             — Login/signup forms
    content/          — Content request form, workspace, draft view
    layout/           — App sidebar, top bar
    publishing/       — Channel panel, publishing panel
    review/           — Review submission panel
    ui/               — Badge, Button, Card, Alert, Progress, Skeleton...
  lib/
    ai/               — AI provider abstraction + Claude + Mock
    auth/             — requireAuth, requireRole, rate limiter
    audit/            — Audit log writer
    db/               — Supabase client factory
    errors/           — Typed error hierarchy
    publishing/       — Publishing provider abstraction + Mock
    research/         — Research provider abstraction + Firecrawl + Mock
    validation/       — Channel validators, SEO validator, URL validator
    workflow/         — State machine
  services/
    generation/       — Content planning + drafting + evaluation + revision
    publishing/       — Channel adaptation + publishing queue
    research/         — Research pipeline orchestration
    review/           — Review submission + approval state
  types/              — Domain types
  schemas/            — Zod validation schemas
  prompts/            — (Claude prompt templates)
  middleware.ts       — Route protection + session refresh
supabase/
  migrations/         — SQL migration files
tests/
  unit/               — Unit tests for pure logic
  integration/        — End-to-end pipeline tests using mock providers
docs/
  USER_GUIDE.md
  TESTING_EVIDENCE.md
```

---

## Demo accounts

When `NEXT_PUBLIC_DEMO_MODE=true`, demo credentials are shown on the login page:

- **Admin**: `admin@koya-demo.com` / `DemoAdmin2026!`
- **Reviewer**: `reviewer@koya-demo.com` / `DemoReview2026!`
- **Content Manager**: `manager@koya-demo.com` / `DemoManager2026!`

These accounts must be created in Supabase Auth first. See setup instructions above.

---

## Architecture

See [ARCHITECTURE.md](./ARCHITECTURE.md) for a full technical description including database schema, workflow state machine, security model, provider abstractions, and approval invariants.
