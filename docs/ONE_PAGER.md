# Koya Content Agent — One-Pager Documentation

**Project Name:** Koya Content Agent  
**Tagline:** AI-powered content research, drafting, review, and publishing for marketing teams  
**Application URL:** http://localhost:3000 (local development)  
**Last Updated:** September 2026

---

## Summary

### What business problem does this solve?
Marketing teams and content managers spend hours researching topics, writing drafts, coordinating reviews, and reformatting content for different channels. Without structure, drafts get published without proper review, AI-generated claims go unchecked, and there is no audit trail. This system replaces that chaos with a supervised pipeline.

### Who is it for?
Small marketing teams with defined roles: a content manager who creates and manages content, a reviewer who approves before publication, and an admin who manages the team and system.

### What does the system do from start to finish?
A content manager enters a topic idea and optionally a source URL or file. The system retrieves and analyses the source, generates a structured content plan, writes a draft, evaluates it across 9 quality dimensions (including topic relevance, audience fit, and source grounding), auto-revises up to 3 times if needed, then routes it to a human reviewer. Only after explicit human approval can the content be published to LinkedIn, X (Twitter, mock), and email newsletter (Brevo). Every action is logged in an immutable audit trail.

### What business value does it provide?
- Reduces time-to-first-draft from hours to minutes
- Prevents AI hallucination via source-grounded evaluation
- Eliminates unauthorised publishing via mandatory human approval gate
- Provides full audit trail for compliance and accountability
- Separates duties so authors cannot approve their own content

---

## How It Works

```
1. Content Manager enters idea + optional URL/file + target audience + channels
              ↓
2. System retrieves and scrapes the URL (Firecrawl) or processes supporting material
              ↓
3. Claude AI summarises each source, scores relevance (0–10), selects sources ≥ 5.0
              ↓
4. Claude generates a structured content plan (outline, keywords, source mapping)
              ↓
5. Claude writes the article draft (500–800 words, grounded in sources)
              ↓
6. Claude evaluates the draft on 9 dimensions:
   topic_relevance | source_grounding | factual_consistency | audience_fit |
   tone | seo_fit | channel_fit | clarity | completeness

   **Relevance gate (not just completeness):** The evaluator is explicitly instructed
   to distinguish between "content that exists" and "content that is relevant, specific,
   and grounded." It flags content that is generic, restates the instructions, or mentions
   the target audience without addressing their actual concerns.

   → PASS (overall ≥7.5, topic_relevance ≥6, audience_fit ≥6): goes to human review
   → REVISE (overall <7.5, OR topic_relevance <6, OR audience_fit <6): AI revises
   → REJECT (overall <5.5 or fundamentally off-topic): goes to human review with flag
   Max 3 auto-revisions before escalating to human review regardless
              ↓
7. Human reviewer (different person, enforced server-side) reviews article,
   sources, evaluation scores, and unsupported claims
              ↓
8. Reviewer: Approves → Requests Revision → Rejects
              ↓
9. On approval: system generates channel adaptations
   LinkedIn (plain text, ≤3000 chars) | X (≤280 chars / thread) | Newsletter (250–600 words)
   Each validated by deterministic rules before saving
              ↓
10. Content manager publishes to LinkedIn (real), Newsletter/Brevo (real), X (mock)
    Publishing blocked server-side without approval and version match
              ↓
11. Audit log records every action | Sidebar badge notifies reviewer of pending items
    Failure events captured with retry counts | AI usage/cost tracked per operation
```

---

## How to Use

### Login / Authentication
- Navigate to http://localhost:3000 → redirects to /login
- Create an account via Sign Up (email confirmation required)
- Admin can create accounts directly in Supabase Dashboard → Authentication → Users

### User Roles
| Role | What they can do |
|---|---|
| **content_manager** | Create requests, trigger research/generation, view own content |
| **reviewer** | See all content, submit reviews (approve/reject/request revision) |
| **admin** | Full access + user management + audit log + system settings |

Set a user's role in Supabase SQL Editor:
```sql
UPDATE profiles SET role = 'reviewer' WHERE email = 'reviewer@example.com';
```

### Creating a Content Request
1. Click **New Content** in the sidebar
2. Fill in: Content Idea (required), Target Audience (required), Channels (required)
3. Optionally add: Primary Keyword, Tone, Content Goal, Source URL, Supporting Material (text or file upload — PDF/DOCX/TXT)
4. Click **Create Content Request** → research starts automatically in background

### Using a Source URL
Enter a public URL in the **Source URL** field. The system retrieves the page via Firecrawl, extracts text, summarises it, scores relevance, and uses it to ground the generated content. Private/paywalled/localhost URLs are blocked.

### Reviewing Research
Open the content workspace → **Sources** tab. See all retrieved sources with relevance scores, summaries, and why each was selected or rejected.

### How the Evaluator Works (Relevance vs Completeness)
The evaluation system does **not** simply check whether content exists or has the right word count. It distinguishes between:

- ❌ "Content exists and is 600 words" — not sufficient
- ✅ "Content is specific to this topic, grounded in reviewed sources, and addresses this audience's actual concerns" — required

This is enforced through two mechanisms:

**1. Per-dimension scoring** — the evaluator scores `topic_relevance` and `audience_fit` as separate dimensions (0–10 each). If either falls below 6, the overall status is forced to REVISE even if other scores are high.

**2. CRITICAL RELEVANCE DISTINCTION in the system prompt** — Claude is explicitly instructed to flag:
- Content that is generic and could apply to any topic
- Content that restates the original instructions rather than providing substantive information
- Content that mentions the target audience label but doesn't address their actual context or concerns
- Content that mentions sources but doesn't use their specific findings

This directly addresses the distinction between "completeness" (does content exist?) and "relevance" (is the content actually about this topic, for this audience, grounded in these sources?).

### Reviewing Generated Content
- **Draft** tab: read the full article, summary, version history
- **Evaluation** tab: see all 9 dimension scores, unsupported claims, weak sections, recommended changes

### Sending for Approval / Reviewer Notification
Content moves to AWAITING_REVIEW automatically after generation. The reviewer sees an amber badge on "Review Queue" in the sidebar, updated in real time after each review submission.

### Reviewer Approval/Rejection
Reviewer opens the content → **Review** tab → selects Approve / Request Revision / Reject → submits. Separation of duties is enforced: reviewers cannot approve their own content (server-side, not just UI).

### Publishing/Scheduling
After approval → **Adapt Channels** → generates LinkedIn, X, Newsletter versions → **Publishing** tab → Publish Now or set a scheduled date/time. X uses mock provider (Twitter Basic plan required for real posting). LinkedIn and Newsletter (Brevo) post for real.

### Viewing Status/History
- Dashboard: counts by status across all content
- Audit Log (admin/reviewer): full immutable history of every action
- Content list: all requests with current status

---

## Roles

| Role | Create content | Research/Generate | Review | Approve | Admin functions |
|---|---|---|---|---|---|
| content_manager | ✓ (own) | ✓ (own) | ✗ | ✗ | ✗ |
| reviewer | ✗ | ✗ | ✓ (all) | ✓ (not own) | ✗ |
| admin | ✓ | ✓ | ✓ | ✓ | ✓ |

---

## Artifacts

| Artifact | Location |
|---|---|
| Live application | http://localhost:3000 |
| Content sample pack | `/docs/CONTENT_SAMPLE_PACK.md` |
| Testing evidence | `/docs/TESTING_EVIDENCE.md` |
| Architecture documentation | `/ARCHITECTURE.md` |
| User guide | `/docs/USER_GUIDE.md` |
| Database migrations | `/supabase/migrations/` |
| Unit + integration tests | `/tests/` (169 tests, 7 files) |

---

## Troubleshooting

| Issue | Cause | Fix |
|---|---|---|
| "Connection error" from Claude | Node 24 Anthropic SDK fetch bug | Fixed: `fetch: globalThis.fetch` passed explicitly to client |
| Content disappears from dashboard | `deleted_at` column migration not run | Run migration 004 in Supabase SQL Editor |
| "Invalid path specified in request URL" | Supabase URL has `/rest/v1/` appended | Use bare URL: `https://project.supabase.co` (no trailing path) |
| "Expected string, received null" on review | Feedback field sent null | Fixed: schema accepts `null` and `undefined` on optional fields |
| X publishing fails with 402 | Twitter Basic plan required | Set `TWITTER_PROVIDER=mock` in `.env.local` |
| Brevo 401 Unauthorized IP | IP not allowlisted in Brevo | Add server IP at app.brevo.com/security/authorised_ips |
| Content generation times out | `max_tokens` too high or wrong fetch | Fixed: per-operation token limits + `globalThis.fetch` |
| LinkedIn posts show asterisks | Claude used markdown in plain-text channel | Fixed: `stripMarkdown()` applied before saving and before posting |

---

## Limitations and Assumptions

**Supported:**
- Single source URL per content request
- File upload: PDF, DOCX, TXT, Markdown (max 10 MB, 50k chars extracted)
- LinkedIn real publishing (OAuth 2.0, 60-day token expiry)
- Newsletter real publishing via Brevo (transactional email, not subscriber broadcast)
- X/Twitter: content generated and stored, but posting requires Twitter Basic plan ($100/mo) — currently mock
- Up to 5 sources per research run
- Up to 3 automatic AI revision attempts before escalating to human review
- Channels: Article, LinkedIn, X, Newsletter

**Not supported / Current limitations:**
- No automatic web search — system only processes URLs/files you provide; it does not find sources independently
- No real-time collaborative editing
- No subscriber list management (Brevo sends to fixed NEWSLETTER_TO addresses)
- No scheduled LinkedIn/X posts via platform scheduling APIs (schedule stored in DB, must be manually triggered)
- No mobile-optimised view
- Twitter posting requires $100/mo Twitter Basic API plan
- LinkedIn access token expires after 60 days and must be manually renewed at `/auth/linkedin`
- No email confirmation resend flow (use Supabase dashboard to resend)
- Separation of duties: content manager and reviewer must be different accounts; currently no in-app user invitation

**Assumptions:**
- Small team (2–5 users) using shared Supabase project
- Content managers provide at least one source URL or supporting material for best results
- All users have email access for confirmation during signup
- Production deployment requires Vercel + Supabase (configured but not deployed)
- AI output quality depends on Claude Sonnet 4.5 and the quality/relevance of provided sources
