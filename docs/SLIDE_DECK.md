# Slide Deck — Koya Content Agent
## Week 4 Presentation (5 minutes)
### Design: Dark background, white text, minimal. No bullet walls.

---

## SLIDE 1 — INTRO
*(Full screen, centered)*

**KOYA CONTENT AGENT**

*AI-powered content research, review, and publishing*

Salman Yahya | Week 4

---

**The business problem:**

Marketing teams write content that gets published without proper research, review, or approval.

The result: factually wrong content, missed audiences, no audit trail.

---

## SLIDE 2 — WHAT WE BUILT
*(Workflow diagram — horizontal flow)*

```
IDEA / URL
    ↓
RESEARCH
(Firecrawl retrieves sources)
    ↓
SOURCE GROUNDING
(Claude scores relevance 0–10)
    ↓
CONTENT GENERATION
(Claude writes grounded draft)
    ↓
EVALUATION
(9 dimensions: relevance, audience fit, source grounding...)
    ↓
REVISION LOOP
(max 3 auto-revisions)
    ↓
HUMAN REVIEW
(approve / reject / revise)
    ↓
CHANNEL ADAPTATION
(LinkedIn · X · Newsletter)
    ↓
PUBLISHING
(LinkedIn real · Brevo real · X mock)
```

**Key principle:** AI proposes. Humans approve. Nothing publishes without explicit sign-off.

---

## SLIDE 3 — KEY FEATURES
*(Two columns)*

**Reliability**
- Stale approval protection
- Idempotency keys prevent duplicate publishing
- Prompt injection defence
- SSRF-protected URL validation

**Oversight**
- 3-role RBAC (content_manager / reviewer / admin)
- Separation of duties (server-side)
- Immutable audit log
- Reviewer sidebar badge

**Quality**
- 9-dimension evaluation (not just completeness)
- Evaluator distinguishes generic vs specific content
- Up to 3 auto-revisions before human escalation
- Deterministic channel validators

**Real integrations (live)**
- Claude Sonnet 4.5 (AI)
- Firecrawl (research)
- LinkedIn OAuth posting
- Brevo email newsletter

---

## SLIDE 4 — ROBUSTNESS (NOT JUST HAPPY PATH)
*(3 panels)*

**Panel 1: Invalid Source URL**
- User provides `http://localhost:3000` or `192.168.1.x`
- Blocked before any HTTP request
- 12 private IP patterns protected against SSRF

**Panel 2: AI Evaluation Fails → Revision**
- Draft scores 5.8/10 (REVISE)
- System auto-revises with evaluation feedback
- After 3 attempts → escalates to human reviewer
- Real example: Draft v4 after 3 revisions (seen in testing)

**Panel 3: Attempt to Publish Without Approval**
- User tries to publish unapproved content
- `NotApprovedError` thrown server-side
- Same protection applies if content edited after approval (stale approval guard)

---

## SLIDE 5 — LIVE DEMO
*(Mostly screen — minimal text)*

**Demo sequence (timestamps):**

| Time | Action |
|---|---|
| 0:00 | Sign in as content_manager |
| 0:20 | New Content Request — topic + URL + audience |
| 0:50 | Research completes — show Sources tab (relevance scores) |
| 1:20 | Generate Content — show spinner, then Draft tab |
| 1:50 | Show Evaluation tab — scores, unsupported claims |
| 2:20 | Content at AWAITING_REVIEW — sign in as reviewer |
| 2:40 | Reviewer sees badge notification |
| 3:00 | Reviewer reviews sources + evaluation + draft |
| 3:20 | Reviewer approves → status changes, badge clears |
| 3:40 | Adapt Channels — show LinkedIn / newsletter preview |
| 4:00 | Publish LinkedIn (real) — show live post |
| 4:20 | EDGE CASE: Attempt to publish rejected content → blocked |

---

## SLIDE 6 — CLOSING
*(Full screen, minimal)*

**What this solves:**
Content published without research or approval costs businesses credibility.
This system makes human oversight non-optional — at the architecture level, not the UI level.

**What makes it robust:**
- 169 automated tests
- Every major failure is caught, logged, and surfaced — not swallowed
- Real integrations verified end-to-end

**Current limitation:**
X (Twitter) posting requires $100/month plan — currently mock.
LinkedIn token expires after 60 days.

**Next step:**
Subscriber list management for newsletter (Brevo Audiences API)

---

# PRESENTER NOTES PER SLIDE

**Slide 1 (0:00–0:30):**
"I built a content operations platform that takes a raw idea and moves it through research, AI drafting, human review, and publishing — with a hard rule: nothing goes out without a human approving the exact version being published."

**Slide 2 (0:30–1:00):**
"Here's the complete workflow. What matters is the human review step in the middle. Every other step either prepares content for review or acts on an approved version. The AI cannot bypass it."

**Slide 3 (1:00–1:30):**
"A few engineering decisions worth noting: the approval system uses version numbers, not just a boolean. If you approve draft v2 and then generate draft v3, the approval is invalidated — you have to re-review. The evaluator also doesn't just check completeness — it specifically checks if the content is topic-specific or generic."

**Slide 4 (1:30–2:00):**
"Let me show you three things that aren't the happy path. First, URL validation blocks private IP ranges before any HTTP request. Second, when a draft scores too low, the system auto-revises and shows you the history. Third, publishing without approval returns a hard server error — the UI can't bypass it."

**Slide 5 (2:00–4:20):**
[Follow demo sequence table above]

**Slide 6 (4:20–5:00):**
"The core business value is trust. When content goes out, you know a human reviewed the exact version that was published, you have the audit trail to prove it, and you know the AI's claims were checked against sources. That's what makes this more than a demo."
