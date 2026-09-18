# Architecture — Koya Content Agent

## Overview

Koya Content Agent is a production-grade AI content research and publishing platform. It takes a content request through a supervised pipeline: research → planning → AI drafting → AI evaluation → human review → channel adaptation → publishing.

The system is designed around one core constraint: **AI must never publish content without explicit human approval of the exact version being published.**

---

## System Diagram

```
Browser
  │
  ├── Next.js App Router (SSR + Client Components)
  │     ├── (auth)/          — Login, Signup, OAuth callback
  │     ├── (dashboard)/     — Protected UI: Dashboard, Content, Review, Publishing, Audit
  │     └── api/             — REST API routes (server-side, authenticated)
  │
  ├── Middleware              — Session refresh + route protection
  │
  └── Supabase
        ├── PostgreSQL        — All persistent state
        ├── Auth              — JWT sessions, user management
        └── Row Level Security — Data isolation per user/role
```

---

## Workflow Pipeline

```
Content Request (DRAFT)
        │
        ▼
   Research (RESEARCHING)
   └── Firecrawl / Mock: retrieve URLs, extract content
   └── Claude / Mock: summarize each source, score relevance
        │
        ▼
   Research Complete (RESEARCH_COMPLETE)
        │
        ▼
   Planning (PLANNING)
   └── Claude generates structured ContentPlan (JSON)
        │
        ▼
   Generation (GENERATING)
   └── Claude generates ArticleDraft (JSON, min 500 words)
        │
        ▼
   Evaluation (EVALUATING)
   └── Claude scores draft on 9 dimensions (0-10)
   └── Returns PASS / REVISE / REJECT
        │
   ┌────┤
   │ REVISE → REVISING → back to GENERATING (max 3 times)
   │ REJECT → AWAITING_REVIEW (human decides)
   │ PASS  → AWAITING_REVIEW
   └────┤
        │
        ▼
   Human Review (AWAITING_REVIEW)
   └── Reviewer: Approve / Request Revision / Reject
   └── Separation of duties enforced server-side
        │
   ┌────┤
   │ REVISION_REQUESTED → re-enter GENERATING
   │ REJECTED → terminal
   │ APPROVED ──────────────────────────────┐
   └────┤                                    │
        │                                    ▼
        │                    Channel Adaptation (CHANNEL_ADAPTATION)
        │                    └── LinkedIn, X, Newsletter
        │                    └── Deterministic validation after each
        │                            │
        │                            ▼
        │                    Ready to Schedule (READY_TO_SCHEDULE)
        │                            │
        │                            ▼
        │                    Publishing Queue (SCHEDULED / PUBLISHING)
        │                            │
        └──────────────────────────  ▼
                                 Published (PUBLISHED) — terminal
```

---

## Database Schema

All tables use UUIDs and `created_at` / `updated_at` timestamps. Row Level Security is enabled on every table.

| Table | Purpose |
|---|---|
| `profiles` | User accounts, roles (content_manager / reviewer / admin) |
| `content_requests` | The root entity for each piece of content |
| `research_runs` | Tracks each research execution |
| `content_sources` | Retrieved and scored source documents |
| `content_plans` | AI-generated structured content plan |
| `content_drafts` | Immutable draft versions (never updated, only new rows) |
| `draft_evaluations` | AI evaluation scores per draft version |
| `draft_revisions` | Links original ↔ revised drafts with change reasons |
| `human_reviews` | Immutable reviewer decisions |
| `channel_content` | LinkedIn / X / Newsletter adaptations |
| `publishing_queue` | Publishing jobs with idempotency keys |
| `audit_logs` | Immutable append-only event log |
| `workflow_runs` | Traceable per-operation run records |
| `failure_events` | Structured failure records |
| `ai_usage` | Token and cost tracking per AI call |

### Key Constraints

- `content_drafts` has `Update: never` — immutable by design
- `draft_evaluations` — immutable
- `human_reviews` — immutable
- `audit_logs` — immutable
- `publishing_queue.idempotency_key` — UNIQUE constraint prevents duplicate publishing
- `content_drafts(content_request_id, version_number)` — UNIQUE prevents version collisions

---

## Authentication & Authorization

### Session Management
- Supabase Auth with JWT tokens
- Session refreshed on every request via middleware
- `createSupabaseServerClient()` — respects RLS via session cookie
- `createSupabaseAdminClient()` — service role, server-only, bypasses RLS for system operations

### Roles

| Role | Capabilities |
|---|---|
| `content_manager` | Create requests, trigger research/generation, view own content |
| `reviewer` | Review, approve, reject, request revision on all content |
| `admin` | Full access, user management, audit logs, system config |

### Separation of Duties
When `ENFORCE_SEPARATION_OF_DUTIES=true` (default), reviewers cannot approve their own content. Enforced in `submitReview()` server-side — not just the UI.

---

## AI Provider Abstraction

```typescript
interface AiProvider {
  generateContentPlan(params): Promise<AiResult<ContentPlanOutput>>
  generateArticleDraft(params): Promise<AiResult<ArticleDraftOutput>>
  evaluateDraft(params):        Promise<AiResult<EvaluationOutput>>
  generateLinkedIn(params):     Promise<AiResult<LinkedInOutput>>
  generateX(params):            Promise<AiResult<XOutput>>
  generateNewsletter(params):   Promise<AiResult<NewsletterOutput>>
  summarizeSource(params):      Promise<AiResult<SourceSummaryOutput>>
}
```

Implementations:
- `MockAiProvider` — deterministic, no API calls, used in development/testing
- `ClaudeProvider` — production, uses `claude-sonnet-4-5` with structured JSON outputs

Selected via `AI_PROVIDER=mock|real` environment variable.

### Evaluation — Relevance vs Completeness

The evaluation pipeline explicitly distinguishes between "content that exists" and "content that is relevant, specific, audience-appropriate, and grounded in sources." This directly addresses the risk of AI producing well-formatted but generic content that scores highly on completeness while failing on relevance.

**Implemented in `ClaudeProvider.evaluateDraft()` via two mechanisms:**

**1. Per-dimension scoring with per-dimension thresholds**
```
topic_relevance  — is content specific to THIS topic, not generic?
audience_fit     — does it address THIS audience's actual concerns?
source_grounding — are claims backed by the reviewed sources?
```
If `topic_relevance < 6` OR `audience_fit < 6`, the status is forced to `REVISE` regardless of the overall score.

**2. `CRITICAL RELEVANCE DISTINCTION` in the system prompt**

The evaluator is explicitly instructed to flag content that:
- Is generic and could apply to any topic
- Restates the original instructions rather than providing substantive information
- Mentions the target audience but doesn't address their specific context or concerns
- References sources but doesn't use their actual findings

**Scoring guide (implemented):**
```
PASS  — overall ≥7.5 AND topic_relevance ≥6 AND audience_fit ≥6
REVISE — overall 5.5–7.4, OR topic_relevance <6, OR audience_fit <6
REJECT — overall <5.5 or fundamentally off-topic/generic
```

This means a 600-word article that is perfectly formatted but entirely generic will score `topic_relevance ≤ 5` and be sent to revision — not passed to human review.

### Prompt Injection Defence

All source material retrieved from the web is wrapped in `<source_content>` tags with an explicit instruction that the content is **untrusted data to be analyzed, not instructions to follow**. System instructions and source material are always kept in logically separate sections of the prompt.

---

## Research Provider Abstraction

```typescript
interface ResearchProvider {
  retrieveUrl(url: string): Promise<RetrievedSource>
  isAvailable():            Promise<boolean>
}
```

Implementations:
- `MockResearchProvider` — simulates retrieval including failure scenarios
- `FirecrawlProvider` — production, calls Firecrawl API for URL scraping

Selected via `RESEARCH_PROVIDER=mock|real`.

SSRF protection is applied before any URL is fetched. Private IP ranges, localhost, `.internal`, `.local` and non-HTTP protocols are all blocked at the validation layer.

---

## Publishing Provider Abstraction

```typescript
interface PublishingProvider {
  publish(params):  Promise<PublishResult>
  schedule(params): Promise<ScheduleResult>
  cancel(params):   Promise<CancelResult>
}
```

Implementations:
- `MockPublishingProvider` — simulates publishing, always sets `isDemo: true`, never posts to real platforms

Real platform integrations (LinkedIn, Twitter/X, Mailchimp) are plugged in by implementing the interface. The UI displays a **Demo Publishing** badge when mock is active.

---

## Approval Model (Critical Invariants)

Five invariants are enforced server-side — they cannot be bypassed via the UI:

1. **No publishing without human approval** — `getApprovalState()` checked before every publish call
2. **Approval must match the exact version being published** — version numbers compared in `executePublishing()`
3. **Edited content invalidates approval** — `isApprovalStale` check compares approved version vs latest draft version
4. **Rejected content cannot be published** — checked in `checkPublishingEligibility()`
5. **No duplicate publishing** — `idempotency_key = content_id + channel + version` with UNIQUE DB constraint

---

## Workflow State Machine

`WorkflowStateMachine` in `src/lib/workflow/state-machine.ts` is the single authority for state transitions. Invalid transitions throw `WorkflowTransitionError`. No code outside this class may set workflow status directly.

```
DRAFT → RESEARCHING → RESEARCH_COMPLETE → PLANNING → GENERATING
                                                         ↕
AWAITING_REVIEW ← EVALUATING ↔ REVISING (max 3 auto-revisions)
     │
     ├── APPROVED → CHANNEL_ADAPTATION → READY_TO_SCHEDULE
     │                                        │
     ├── REVISION_REQUESTED → GENERATING     SCHEDULED
     │                                        │
     └── REJECTED (terminal)                PUBLISHED (terminal)

Any non-terminal state → FAILED → retry possible
```

---

## Channel Validation (Deterministic)

AI-generated channel content is validated with rule-based functions — no AI involved. Validators return typed `ChannelValidationError[]` with `error` or `warning` severity.

| Channel | Rules Checked |
|---|---|
| LinkedIn | max 3000 chars, max 5 hashtags, CTA required |
| X | max 280 chars OR thread format, max 2 hashtags |
| Newsletter | 250–600 words, subject line required (max 60 chars), CTA |
| SEO | single H1, keyword in title + intro, min 2 H2s, word count |

If validation fails after `MAX_CHANNEL_RETRIES` attempts, the failure is logged and the content is saved with `validation_status: invalid` for human inspection.

---

## Audit Logging

Every significant workflow action writes an immutable row to `audit_logs` via `recordAudit()`. This uses the service role client so logs are always written regardless of the user's RLS context.

Logged actions include: `content_created`, `research_started/completed`, `source_selected`, `draft_generated/evaluated/revised`, `review_approved/rejected`, `revision_requested`, `channel_generated`, `scheduled`, `published`, `publishing_failed`, `approval_invalidated`.

---

## AI Cost Control

- All AI calls use structured JSON output — no token-wasting free-form parsing
- Revision loop hard-capped at `MAX_AUTO_REVISIONS` (default 3)
- Source content truncated to 8,000 chars per source before sending to Claude
- Supporting material truncated at 50,000 chars
- All AI calls log `input_tokens`, `output_tokens`, `estimated_cost_usd` to `ai_usage` table

---

## Security Summary

| Control | Implementation |
|---|---|
| Route protection | Next.js middleware + `requireAuth()` in every API route |
| Role enforcement | `requireRole()` server-side, never trust client |
| Data isolation | Supabase RLS on all 15 tables |
| Service role isolation | Admin client only in server services, never bundled to browser |
| SSRF prevention | `validateAndNormalizeUrl()` blocks all private/internal addresses |
| Prompt injection | Source material wrapped in explicit `<source_content>` untrusted-data delimiters |
| Input validation | Zod schemas on all API inputs, server-side |
| Idempotency | Publishing idempotency key enforced at DB level |
| Rate limiting | In-process rate limiter (replace with Redis for multi-instance) |
| Security headers | X-Frame-Options, X-Content-Type-Options, Referrer-Policy set in `next.config.ts` |

---

## Deployment Targets

- **Frontend/API**: Vercel (Next.js App Router, serverless functions)
- **Database/Auth**: Supabase (PostgreSQL + GoTrue Auth)

See `README.md` for deployment instructions.
