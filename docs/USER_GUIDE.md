# User Guide — Koya Content Agent

This guide walks through the complete workflow from content idea to published output.

---

## 1. Sign in

Navigate to the app and sign in with your account credentials.

- **Content Manager** — create and manage content requests
- **Reviewer** — review and approve drafts
- **Admin** — full access including audit logs and settings

If demo mode is active, sample credentials are shown on the login page.

---

## 2. Create a content request

Click **New Content** in the sidebar or on the dashboard.

**Required fields:**

| Field | Description |
|---|---|
| Content Idea | What the article is about. Be specific. Minimum 10 characters. |
| Target Audience | Who will read this. E.g. "HR managers at mid-size companies" |
| Channels | Select at least one: Article, LinkedIn, X, Newsletter |

**Optional fields (improve quality):**

| Field | Description |
|---|---|
| Primary Keyword | The main SEO keyword. E.g. "AI recruitment" |
| Tone | Professional, Conversational, Educational, etc. |
| Content Goal | What should readers do or understand after reading |
| Source URL | A public article to use as a primary source |
| Supporting Material | Paste text, data, or context directly |
| Additional Instructions | Specific requirements or things to avoid |

Click **Start Research** to submit.

---

## 3. Research

The system automatically begins research after you submit.

**If you provided a Source URL:**
The URL is retrieved, content is extracted, and the text is summarised and scored for relevance.

**If no URL was provided:**
The system uses your supporting material (if any) as source context. You can always add a URL later by creating a new request.

**Status indicators:**
- `Researching` — retrieval in progress (page polls automatically every 3 seconds)
- `Research Complete` — sources are ready, click **Generate Content**
- `Failed` — see the error message in the Sources tab and retry

**Sources tab** shows:
- Each retrieved source with its relevance score (0–10)
- Why each source was selected or rejected
- Any retrieval errors with specific reasons (paywall, 403, etc.)

---

## 4. Generate content

Once research is complete, click **Generate Content** in the workspace header.

The pipeline runs automatically:

```
Planning → Drafting → Evaluation
             ↕ (up to 3 auto-revisions)
          Awaiting Review
```

Page polls every 3 seconds while processing. This typically takes 30–90 seconds in mock mode, and 60–180 seconds with real Claude.

When complete the status changes to **Awaiting Review**.

---

## 5. Review the draft

Open the **Draft** tab to read the article.

Key information shown:
- Version number (e.g. `v1`, `v2` if revised)
- Word count and estimated reading time
- Key claims with source backing indicators
- Change summary (for revised versions)

Use the version selector to compare earlier versions.

---

## 6. Review the AI evaluation

Open the **Evaluation** tab.

Shows:
- Overall status: **PASS**, **REVISE**, or **REJECT**
- Scores for 9 dimensions (0–10 each)
- Unsupported claims — specific claims the AI could not ground in sources
- Weak sections — with specific improvement recommendations
- Recommended changes list

---

## 7. Human review

Open the **Review** tab.

**Who can review:**
Reviewers and Admins only. If separation of duties is enabled, you cannot review content you created.

**Decisions:**

| Decision | When to use |
|---|---|
| **Approve** | Draft is ready to publish as-is |
| **Request Revision** | Specific changes needed — provide instructions |
| **Reject** | Content is not suitable — explain why |

When requesting a revision, be specific in the **Revision Instructions** field. The AI will use these instructions to generate the next version.

Review history is visible — every past decision is shown with the reviewer's name, timestamp, and feedback.

---

## 8. Generate channel content

After approval, click **Adapt Channels** (or it may trigger automatically).

The system generates:
- **LinkedIn post** — PAS structure, 3 hashtags max, clear CTA
- **X post** — strong hook, single idea, max 280 chars (or thread)
- **Email Newsletter** — subject line, 250–600 words, CTA

Each piece is validated with deterministic rules before saving. The **Channels** tab shows validation status for each.

---

## 9. Schedule or publish

Open the **Publishing** tab.

**Publish now:** Click **Publish Now** next to the channel.

**Schedule:** Set a date/time using the datetime picker and click **Schedule**.

**Important:**
- Only approved content can be published
- If the content was edited after approval, it must be re-approved
- The same version cannot be published to the same channel twice
- A **Demo** badge appears when mock publishing is active — nothing is actually sent to LinkedIn, X, or any email platform

---

## 10. Monitor the publishing queue

Navigate to **Publishing** in the sidebar to see all queue items across all content.

Status values:
- `Ready` — queued for immediate publishing
- `Scheduled` — will publish at the scheduled time
- `Published` — successfully published (demo or real)
- `Failed` — see the error message; retry is available

---

## 11. Audit history

Navigate to **Audit Log** (Admin/Reviewer only).

Every action in the system is recorded: who did what, when, and on which content. Audit records are immutable — they cannot be edited or deleted.

---

## Tips

**Improving research quality:**
Provide a specific Source URL rather than relying on the AI alone. The more grounded the sources, the stronger the draft.

**Improving draft quality:**
Use the **Additional Instructions** field to specify things like "avoid statistics that aren't from reviewed sources" or "include a real-world example in each section".

**Reviewing efficiently:**
Read the Evaluation tab before the draft. Unsupported claims and weak sections are already flagged — you don't need to hunt for them.

**Demo workflow for a 5-minute walk-through:**
1. Create request: "How AI is changing recruitment" / "HR managers" / all 4 channels
2. Start Research → watch Sources tab fill in
3. Generate Content → watch status update through Drafting → Evaluation
4. Review Draft tab + Evaluation tab
5. Switch to reviewer account, open Review tab, Approve
6. Adapt Channels → preview LinkedIn / X / Newsletter
7. Publish to LinkedIn (demo)
8. Check Publishing queue — shows Published (Demo)
9. Check Audit Log — full history visible
