# Reflection Sheet — Koya Content Agent
## Salman Yahya — Week 4

---

### 1. In a business setting, what clarifying questions would you ask when assigned this project?

Before writing a line of code, I would ask:

**About scope and users:**
- How many people will use this simultaneously? (Affects database connection pooling and whether the in-process rate limiter is sufficient or needs Redis)
- Are content managers and reviewers always different people, or can one person do both on different pieces of content? (Determines whether separation of duties needs to be configurable per-organisation)
- Do reviewers need to be explicitly assigned to specific content, or is the queue open to any reviewer?

**About content and channels:**
- Which publishing platforms are priority? LinkedIn and newsletter (Brevo) turned out to be achievable; X turned out to require $100/month. That changes the business case significantly.
- Is the output language always English? Claude's source grounding works differently across languages.
- What happens to source URLs that are paywalled? (Turned out to be a real issue — the World Bank URL encountered issues during testing)

**About AI quality standards:**
- What does "good enough" mean for a first draft? The current threshold is 7.5/10 with no major unsupported claims. Is that right for this team?
- How should the system behave when sources are insufficient? Currently it continues and flags low source_grounding. Some teams might prefer to block generation entirely.

**About integration:**
- Is there an existing CMS or publishing workflow this needs to integrate with, or is this a standalone tool?
- What is the expected content volume? (Affects AI cost — one full pipeline run costs approximately $0.05–0.15 with Claude Sonnet)

---

### 2. What was the most significant challenge you faced while building this, and what was its root cause?

**The most significant challenge was the Anthropic SDK failing silently on Node 24.**

The error message was `APIConnectionError: Connection error` — with no further detail. The raw `fetch` and `curl` commands both worked fine against `api.anthropic.com`. Only the SDK failed.

Root cause: The Anthropic SDK v0.52 uses an internal `getDefaultFetch()` function that checks `typeof fetch !== 'undefined'` and then uses `globalThis.fetch`. On Node 24 in this environment, the SDK's internal fetch resolution failed even though `globalThis.fetch` was available and working when called directly.

The fix was a single line: passing `fetch: globalThis.fetch` explicitly to the `Anthropic` constructor. But finding that fix required:
1. Eliminating network/API key as the cause (curl worked)
2. Eliminating the model name (it failed on all models)
3. Testing the SDK directly in Node (confirmed the SDK itself failed)
4. Reading the SDK source to find `getDefaultFetch()` and understanding what it was doing
5. Trying the explicit fetch override

The reason this was the most significant challenge is that it blocked all real AI testing. Every fix for Claude prompts, token limits, and JSON parsing had to be deferred until the connection worked.

**Secondary challenge:** The JSON parsing for article drafts. Claude generates a full article (600+ words) inside a JSON string field, which means every quote mark in the article must be escaped as `\"` and every newline as `\n`. When the response was truncated (max_tokens hit mid-response), the JSON was simply invalid — and the original single-strategy parser threw immediately with no recovery. The four-strategy parser (fence extraction → brace extraction → sanitisation → truncation recovery) was necessary for robustness.

---

### 3. If you were to start this project again with your current knowledge, what is the ONE thing you would do differently?

**Run a real API connectivity test as the very first step, before building any application code.**

A simple script:
```typescript
const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY, fetch: globalThis.fetch });
await client.messages.create({ model: "claude-sonnet-4-5", max_tokens: 10, messages: [{ role: "user", content: "ping" }] });
```

If that fails, everything built on top of it will fail too, and there is no point in building services until the foundation works.

More broadly: for any project with external API dependencies, I would create a `scripts/test-connections.mjs` file that tests all external services (Supabase, Claude, Firecrawl, LinkedIn, Brevo) before touching the application code. This would have saved several hours of debugging.

---

### 4. What edge cases did you account for, and how did you account for them?

**Server-Side Request Forgery (SSRF):** Every user-provided URL passes through `validateAndNormalizeUrl()` which blocks 12 private IP patterns (localhost, 127.x, 10.x, 172.16-31.x, 192.168.x, 169.254.x, IPv6 loopback/private ranges, .internal, .local TLDs). The URL is never fetched without passing this check. This prevents a malicious user from using the research pipeline to probe internal services.

**Stale approval:** After a reviewer approves draft v2, if any new draft is generated (v3), the approval is invalidated. `getApprovalState()` compares the approved draft version against the current latest version. If the current version is higher, `isStale=true` and publishing is blocked — even if the user somehow bypassed the UI. This check runs twice: once on enqueue and once immediately before the actual publish API call.

**Duplicate publishing:** The idempotency key `contentId__channel__vN` has a UNIQUE constraint in the database. Even if a user clicks "Publish Now" twice rapidly, the second attempt finds the existing queue record and reuses it rather than creating a duplicate publish job.

**Prompt injection:** Source material from external URLs is wrapped in `<source_content>` XML tags with an explicit instruction that the content is untrusted data, not instructions. This prevents a malicious webpage from including text like "ignore your previous instructions" from being treated as a directive.

**Claude JSON truncation:** The four-strategy JSON parser handles: code-fence wrapping, brace extraction, trailing comma sanitisation, and truncation recovery (closing unclosed brackets/braces). This is important because Claude sometimes hits the `max_tokens` limit mid-response, producing technically invalid but recoverable JSON.

**Separation of duties bypass:** The SOD check in `review-service.ts` uses the `contentOwnerId` fetched from the database on the server, not from the client request. A malicious user cannot bypass it by sending a different user ID in the request body.

---

### 5. Which Claude model did you use and why?

**Model used:** `claude-sonnet-4-5` (confirmed in `.env.local` as `ANTHROPIC_MODEL=claude-sonnet-4-5`)

**Alternative considered:** `claude-opus-4-5`

The initial implementation used `claude-opus-4-5`, which was changed to Sonnet before the first real API test. The reasoning:

| Factor | Opus 4.5 | Sonnet 4.5 | Decision |
|---|---|---|---|
| **Quality** | Higher on open-ended reasoning | Sufficient for structured JSON tasks | Sonnet adequate |
| **Cost** | ~$15/M input, ~$75/M output | ~$3/M input, ~$15/M output | 5x cheaper → Sonnet |
| **Latency** | Slower | Faster | Sonnet better for UX |
| **Task complexity** | Better for nuanced writing | Handles structured outputs well | Sonnet adequate |

The tasks in this pipeline — content planning, article writing, evaluation, channel adaptation — are all structured JSON generation tasks. They benefit from clear prompting more than they benefit from raw model capability. Sonnet produces consistent, valid JSON responses with the right prompt structure.

A full pipeline run (research summaries + plan + draft + evaluation + 3 channel adaptations) costs approximately $0.05–0.15 with Sonnet versus $0.50–1.50 with Opus. For a tool that might run 10–20 pipelines per day, that difference is meaningful.

The one area where Opus would be noticeably better is the evaluation's qualitative judgements — whether content is "genuinely audience-specific" versus "generically applicable." However, the prompt engineering improvements (explicit CRITICAL RELEVANCE DISTINCTION section, per-dimension guidance) achieve sufficient quality with Sonnet for this use case.
