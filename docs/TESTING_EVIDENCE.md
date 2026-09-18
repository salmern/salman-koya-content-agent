# Testing Evidence — Koya Content Agent
## Week 4 Submission

**Test run date:** September 2026  
**Test environment:** Local development, Node 24.18, Claude Sonnet 4.5 (real), Firecrawl (real), Brevo (real), LinkedIn (real), X (mock)

---

## Automated Test Suite

```
npm test

Test Files : 7 passed
Tests      : 169 passed
Duration   : ~27 seconds
```

All tests use mock providers — no external API calls, no database required.

---

## Core Test Cases

### 1. Raw Idea Request (no URL, no supporting material)

**Input:**
- Content Idea: "How AI is changing recruitment"
- Target Audience: "HR managers and recruitment teams"
- No source URL, no supporting material

**Expected:** System creates content plan and article from idea alone. Research run completes with 0 sources. Generation produces a draft. Evaluation warns about low source grounding.

**Actual:** Research run completes (RESEARCH_COMPLETE) with `source_count=0`, `selected_source_count=0`. Generation proceeds and produces a draft. Evaluation scores `source_grounding` around 4–5/10 and includes unsupported claim warnings. Draft is sent to AWAITING_REVIEW.

**Passed?** ✅ Yes — with expected caveat: source grounding score is low (correctly flagged by evaluator).

**Notes:** The evaluator correctly distinguishes between "content exists" and "content is grounded." With no sources, topic_relevance and audience_fit scores are lower. This is by design.

---

### 2. URL-Based Request

**Input:**
- Content Idea: "How AI coding assistants are changing software development"
- Target Audience: "Software developers"
- Source URL: `https://www.worldbank.org/en/publication/digital-progress`

**Expected:** URL is validated (SSRF check passes for worldbank.org). Firecrawl retrieves page. Claude summarises and scores relevance ≥ 5.0. Source is selected. Draft grounded in source content.

**Actual:** Source retrieved successfully. Relevance score returned as 7.5/10, selected=true. Draft references World Bank publication. Source appears in Review tab's source list. Sources tab badge shows 1 selected.

**Passed?** ✅ Yes

**Notes:** Initial test failed because `deleted_at` column didn't exist (migration 004 not run). After running migration 004, sources appeared correctly. The root cause was an in-app query filtering on a non-existent column that returned 0 rows silently.

---

### 3. Research and Source Grounding

**What was tested:**
- Source relevance scoring (0–10 threshold at 5.0)
- Source appearing in Review tab with selection reason
- Unsupported claims flagged in Evaluation tab

**Expected:** Only sources scoring ≥5.0 appear as selected. Evaluation tab lists unsupported claims with location and recommendation. Sources tab shows why each source was selected.

**Actual:** 
- Sources with relevance_score < 5.0 appear in "Not selected" section
- Sources with relevance_score ≥ 5.0 appear in "Selected sources" section with selection_reason
- Evaluation tab correctly lists claims that lack source backing with specific location (e.g. "Introduction, paragraph 2") and recommendation
- Review tab shows source list with URLs and selection reasons

**Passed?** ✅ Yes

**Notes:** First test revealed a display bug — Overview tab showed `source_count=1` from the research run record, but Sources tab showed 4 sources (additional sources added during generation/summarisation). Fixed: Overview now reads from live `data.sources` array rather than stale research run counters.

---

### 4. Evaluation and Revision Loop

**What was tested:**
- REVISE path triggers auto-revision
- Each revision attempts a new draft
- Hard limit of 3 revisions enforced
- After limit, content goes to AWAITING_REVIEW with notification

**Expected:** Short/unsourced draft → REVISE → new draft generated → re-evaluated → up to 3 revision cycles → AWAITING_REVIEW regardless of final score.

**Actual (observed with mock provider):**
- Draft v1 evaluated: REVISE (short, no sources)
- Draft v2 generated using revision instructions from evaluation
- After MAX_AUTO_REVISIONS=3 attempts: status moves to AWAITING_REVIEW
- Alert shown: "Draft v4 was reached after 3 automatic revisions"

**Actual (observed with real Claude):**
- Drafts typically reach PASS on attempt 1–2 when a good source URL is provided
- Drafts reach revision limit when no sources provided (low source_grounding blocks PASS)

**Passed?** ✅ Yes

**Notes:** Initial test failed with `AiError: Connection error` — root cause was Anthropic SDK v0.52 failing on Node 24 due to broken internal fetch resolution. Fixed by passing `globalThis.fetch` explicitly to the client constructor. Second failure: `AiOutputError: invalid JSON for content plan` — root cause was `max_tokens=2000` too low causing truncated JSON. Fixed by increasing to 3000 tokens for content plan, adding 4-strategy JSON parser with truncation recovery.

---

### 5. Human Approval Before Publishing

**Test A — Attempt to publish without approval:**
**Input:** Approved content request with channel content, but no human_reviews record.

**Expected:** Publishing blocked with `NOT_APPROVED` error.

**Actual:** `enqueueForPublishing()` calls `getApprovalState()` → finds `approval.isApproved = false` → throws `NotApprovedError` → API returns 409 with message "Content has not been approved for publishing."

**Passed?** ✅ Yes — server-side enforcement, not just UI.

**Test B — Stale approval (content edited after approval):**
**Input:** Content approved at v2, then a new draft v3 exists.

**Expected:** Publishing blocked — approval is stale.

**Actual:** `getApprovalState()` returns `isStale=true` (latest draft version 3 > approved version 2) → `StaleApprovalError` → 409 response.

**Passed?** ✅ Yes

**Test C — Self-approval attempt:**
**Input:** content_manager tries to review own content (ENFORCE_SEPARATION_OF_DUTIES=true).

**Expected:** `submitReview()` throws `SeparationOfDutiesError` before any DB write.

**Actual:** Error thrown at line 2 of the authorization checks. DB write never reached. Client receives 403.

**Passed?** ✅ Yes

**Test D — Reviewer approves correctly:**
**Input:** Reviewer (different user) opens content in AWAITING_REVIEW → submits Approve with no feedback.

**Expected:** Review saved, status → APPROVED, sidebar badge decrements.

**Actual:** Review record inserted, content status updated to APPROVED, `router.refresh()` triggers layout Server Component re-run, sidebar badge count decrements immediately.

**Passed?** ✅ Yes (after fixing null feedback bug — `z.string().optional()` rejected null; fixed by adding `.nullable()`)

---

### 6. Channel Formatting

**Test A — LinkedIn plain text:**
**Expected:** No markdown symbols (`**`, `##`, `---`) in published LinkedIn post.

**Actual (initial):** Post published with `**THE PROBLEM:**`, `**THE REALITY:**` visible on LinkedIn profile.

**Root cause:** Claude defaulted to markdown formatting. Content was stored with markdown and published raw.

**Fix:** (1) Updated Claude prompt with `CRITICAL: LinkedIn does NOT render markdown` instruction. (2) `stripMarkdown()` function applied to LinkedIn and X content before saving to DB. (3) `stripMarkdownForLinkedIn()` applied again in the LinkedIn provider before the API call.

**Final result:** LinkedIn post published with clean plain text, no visible markdown symbols.

**Passed?** ✅ Yes (after fix)

**Test B — X character limit:**
**Expected:** X post ≤ 280 characters.

**Actual (initial):** First attempt generated 297-char post. Validator rejected it. 3 retries all generated similar-length posts.

**Root cause:** Claude prompt didn't emphasise the 280-char hard limit clearly enough.

**Fix:** Prompt updated with `CRITICAL: entire post MUST be under 280 characters`. Safety net added: if post > 280 chars after all retries, auto-truncate to 277 + "…".

**Passed?** ✅ Yes (after fix, or truncation safety net applies)

**Test C — Newsletter word count:**
**Expected:** Newsletter 250–600 words, subject line ≤ 60 chars.

**Actual:** Generated newsletter consistently 260–350 words. Subject lines ≤ 60 chars. Validator passes.

**Passed?** ✅ Yes

---

### 7. Publishing and Scheduling

**Test A — LinkedIn real publish:**
**Expected:** Post appears on LinkedIn personal profile.

**Actual:** ✅ Verified. Post appeared on LinkedIn profile within 30 seconds.

**Test B — Newsletter real publish (Brevo):**
**Expected:** Email delivered to recipient inbox.

**Actual (initial):** Brevo returned 401 — IP address `143.105.174.201` not on allowlist.

**Fix:** Added server IP to Brevo allowlist at app.brevo.com/security/authorised_ips.

**Final result:** ✅ Email delivered successfully with correct sender name and HTML formatting.

**Test C — X publish (mock):**
**Actual:** X uses mock provider (Twitter Basic plan required, $100/mo). Queue item created and marked PUBLISHED with `isDemo: true`. Toast shows "Published (Demo)".

**Passed?** ✅ Yes — correctly documented as demo. No real post made.

**Test D — Schedule future publish:**
**Expected:** Queue item created with status SCHEDULED, scheduled_at set.

**Actual:** ✅ Queue item saved as SCHEDULED. Publish button shows "Schedule" label when datetime is selected.

---

### 8. Failure Handling

**Test A — Invalid source URL:**
**Input:** `http://localhost:3000/page`

**Expected:** Validation blocks the URL before any HTTP request.

**Actual:** `validateAndNormalizeUrl()` matches `localhost` against `BLOCKED_PATTERNS[0]` → returns `{ valid: false, reason: "Internal and private network URLs are not allowed" }`. No HTTP request made.

**Passed?** ✅ Yes

**Test B — Paywall URL:**
**Input:** Source URL pointing to a paywalled page.

**Expected:** Research run completes with source marked `retrieval_status: "paywall"`. Pipeline continues with other sources.

**Actual:** Source record saved with `retrieval_status: "paywall"`, `selected: false`. Research run marks complete. Sources tab shows the source in "Not selected" with paywall badge. Pipeline continues without the source.

**Passed?** ✅ Yes (with mock provider; Firecrawl provider handles paywall detection via response content)

**Test C — Claude API connection failure (Node 24 bug):**
**Actual:** `APIConnectionError: Connection error` from Anthropic SDK. Root cause: SDK v0.52 fetch resolution broken on Node 24. Fixed by passing `globalThis.fetch` explicitly. After fix: all Claude calls succeed.

**Passed?** ✅ Yes (after fix)

**Test D — Duplicate publishing attempt:**
**Input:** Click "Publish Now" for a channel already marked PUBLISHED.

**Expected:** `DuplicatePublishError` thrown, 409 response.

**Actual:** `enqueueForPublishing()` finds existing record with `status=PUBLISHED` → throws `DuplicatePublishError`. API returns 409.

**Passed?** ✅ Yes

**Test E — Unauthorized role attempting review:**
**Input:** content_manager role attempts POST /api/review.

**Expected:** 403 Forbidden before any DB write.

**Actual:** `submitReview()` checks `input.reviewerRole` → not in `["reviewer", "admin"]` → throws `ForbiddenError` → 403.

**Passed?** ✅ Yes

---

## Edge Cases

| Edge Case | Expected | Actual | Passed? | Notes |
|---|---|---|---|---|
| No source URL provided | Research completes with 0 sources, generation continues | ✅ Correct | ✅ | Low source_grounding flagged in evaluation |
| Source URL returns 403 | Source saved as failed, pipeline continues | ✅ Correct | ✅ | Error message shown in Sources tab |
| Source URL returns 404 | Source saved as failed, pipeline continues | ✅ Correct | ✅ | |
| Source URL is internal IP (SSRF) | Blocked before HTTP request | ✅ Blocked | ✅ | 12 IP patterns blocked including 10.x, 172.16–31, 192.168.x, link-local |
| Source URL is ftp:// | Blocked at protocol check | ✅ Blocked | ✅ | Only http/https allowed |
| File upload: PDF with no text (scanned) | Error: "No readable text could be extracted" | ✅ Correct | ✅ | Checked at ≥10 char minimum |
| AI returns malformed JSON | Retry up to 2 times, 4-strategy parser | ✅ Correct | ✅ | After fix: truncation recovery, trailing comma sanitisation |
| Content idea too short (<10 chars) | Zod validation error, form prevents submit | ✅ Correct | ✅ | Both client and server validate |
| Empty required fields | Form prevents submit | ✅ Correct | ✅ | Client + Zod server-side |
| Review feedback empty on rejection | Server rejects with "Feedback is required" | ✅ Correct | ✅ | Service-layer check, not just UI |
| Self-approval (SOD=true) | 403 ForbiddenError | ✅ Correct | ✅ | Server-side, bypassing UI has no effect |
| Attempt to publish rejected content | `checkPublishingEligibility` blocks (status=REJECTED) | ✅ Correct | ✅ | Tested via unit test |
| X post > 280 chars | Auto-truncated to 277 + "…" after retries | ✅ Correct | ✅ | After fix |
| Max revisions hit | Goes to AWAITING_REVIEW with "limit reached" message | ✅ Correct | ✅ | Observed with Draft v6 |
| LinkedIn post with markdown | Stripped before saving and before posting | ✅ Correct | ✅ | After fix — real post verified |
| OAuth callback with expired OTP | Redirected to login with readable error message | ✅ Correct | ✅ | After adding error-code handling to callback route |

---

## Items Initially Failed — Summary

| Issue | Root Cause | Fix | Final Result |
|---|---|---|---|
| "Connection error" from Claude | Anthropic SDK fetch bug on Node 24 | `globalThis.fetch` passed to client | ✅ Fixed |
| "Invalid JSON for content plan" | `max_tokens=2000` truncating response | Raised to 3000, added 4-strategy JSON parser | ✅ Fixed |
| LinkedIn posts with asterisks | Claude used markdown in plain-text field | Prompt + `stripMarkdown()` + provider-level strip | ✅ Fixed |
| X post 297 chars (over limit) | Claude prompt not explicit enough | Hard limit instruction + auto-truncate safety net | ✅ Fixed |
| Content disappears after research | Migration 004 not run (deleted_at column missing) | Run migration 004 in Supabase SQL Editor | ✅ Fixed (user action) |
| "Expected string, received null" on approve | `z.string().optional()` rejected null | Added `.nullable()` to feedback field in schema | ✅ Fixed |
| Brevo 401 | Server IP not in Brevo allowlist | Added IP at app.brevo.com/security/authorised_ips | ✅ Fixed |
| X 402 error | Twitter Basic plan required | Set `TWITTER_PROVIDER=mock`, documented limitation | ✅ Documented |
| Overview source count mismatch | Using stale research_run counters | Overview now reads from live sources array | ✅ Fixed |
| Adapt Channels double-click required | Optimistic UI not updated after async action | Status updated optimistically after 202 response | ✅ Fixed |
| Sign out: no obvious button | Found via top-right header | Confirmed present — "Sign out" text link in TopBar | ✅ Confirmed present |
