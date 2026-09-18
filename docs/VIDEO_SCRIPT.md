# 5-Minute Video Script — Koya Content Agent
## Salman Yahya | Week 4

**Total target time: 4:45**

---

## [0:00–0:30] INTRODUCTION — BUSINESS PROBLEM
*(Show: Slide 1)*

"Hi, I'm Salman, and I built the Koya Content Agent for Week 4.

The business problem I'm solving: marketing teams regularly publish AI-generated content that hasn't been properly researched, reviewed, or approved. There's no audit trail, claims aren't verified against sources, and anyone can hit publish.

Koya Content Agent fixes that by making human approval a hard engineering constraint — not just a process suggestion."

---

## [0:30–1:15] WHAT WE BUILT
*(Show: Slide 2 — workflow diagram)*

"The system takes a content idea — or a source URL — through research, AI drafting, quality evaluation, and human review before anything reaches a publish queue.

The key thing to notice here is the human review step. Every path through the system reaches it. The AI can draft. The AI can revise. But it cannot publish. Only an approved human decision unlocks publishing — and that decision is stored with a version number so if the content changes after approval, the approval is automatically invalidated.

Let me show you how this actually works."

---

## [1:15–4:20] LIVE DEMO
*(Screen share — follow exactly)*

**[1:15] Sign in as content manager**
*(Show: /login — sign in with content manager account)*
"I'm signing in as the content manager. The interface is minimal — sidebar shows the workflow."

**[1:25] Create a new content request**
*(Click: New Content → fill form)*
"Creating a request: topic is 'How AI coding assistants are changing software development in 2026', target audience is software developers, channels are LinkedIn, X, and Newsletter. I'm adding the World Bank digital report as a source URL."

*(Click: Create Content Request)*
"Research starts automatically."

**[1:45] Show research results**
*(Click: Sources tab when status reaches RESEARCH_COMPLETE)*
"Research is complete. Here in the Sources tab I can see the source was retrieved, summarised, and scored 7.5 out of 10 for relevance — above the 5.0 threshold for selection. The system shows exactly why the source was selected."

**[2:00] Generate content**
*(Click: Generate Content banner)*
"Clicking Generate Content. The system runs: planning, drafting, then evaluation. This takes 30–60 seconds with real Claude."

*(Wait for AWAITING_REVIEW)*

**[2:20] Show evaluation**
*(Click: Evaluation tab)*
"Here's the evaluation. 9 dimensions scored. I want to point out these two: topic_relevance at 8.5 — the evaluator confirmed this content is specific to AI coding tools, not a generic 'AI is changing everything' piece. And source_grounding at 7.5 — claims are backed by what the sources actually say. The evaluator explicitly distinguishes between content that merely exists and content that's grounded and audience-specific."

**[2:50] Switch to reviewer**
*(Show: amber badge on sidebar Review Queue — switch accounts)*
"Switching to the reviewer account. Notice the amber badge on Review Queue — that appeared when the content reached awaiting review status. The reviewer didn't have to check manually."

**[3:05] Review and approve**
*(Open content → Review tab)*
"The reviewer sees the full article, the source list with URLs, the evaluation scores, and any unsupported claims. Everything they need to make a real decision."

*(Submit: Approved)*
"Approving. The badge clears immediately."

**[3:20] Channel adaptation**
*(Switch back to content manager → Adapt Channels)*
"Back as content manager. Content is approved. Clicking Adapt Channels — this generates LinkedIn, X, and newsletter versions."

*(Show: Channels tab with content)*
"Here's LinkedIn — plain text, no asterisks. Here's the newsletter — subject line, proper formatting. Each one is validated by deterministic rules before saving."

**[3:45] Publish LinkedIn**
*(Publishing tab → Publish Now on LinkedIn)*
"Publishing to LinkedIn now — this is a real post."

*(Show: Published status)*
"Published. That post is live on my LinkedIn profile."

**[4:00] EDGE CASE — attempt to publish without approval**
*(Show: new content request that is in AWAITING_REVIEW — click publish from URL directly, or show the publish tab with blocked state)*
"Let me quickly show the approval guard. If I try to publish content that hasn't been reviewed yet, I get a 409 error: 'Content has not been approved for publishing.' This is enforced on the server, not just the UI. You can't bypass it by calling the API directly either."

---

## [4:20–4:50] ROBUSTNESS — WHAT ELSE WAS TESTED
*(Show: Slide 4)*

"A few other things I verified:

Invalid URLs — if a user provides localhost or a private IP, the request is blocked before any HTTP call is made. That's SSRF protection.

AI revision loop — when drafts score below 7.5, the system auto-revises up to 3 times with specific feedback from the evaluation. After 3 attempts it escalates to the reviewer regardless.

Duplicate publishing — the idempotency key scheme means clicking Publish Now twice doesn't send the post twice. The database prevents it."

---

## [4:50–5:00] CLOSING
*(Show: Slide 6)*

"The core value isn't the AI generation — any tool can generate content. The value is the enforcement layer around it. Human approval is non-optional, approval is tied to a specific version, every action is in the audit log, and the AI's claims are checked against real sources before anyone signs off.

That's Koya Content Agent."

---

## BACKUP NOTES

**If demo takes too long:** Skip the reviewer badge section, go straight to approval.  
**If generation is slow:** Say "while that runs" and show the Evaluation tab from a previous test run.  
**If LinkedIn post takes time:** The queue shows PUBLISHED within 30 seconds — continue talking while it updates.  
**If asked about X:** "X requires Twitter's Basic plan at $100/month, so X is currently in demo mode — content is generated and stored but not posted live."
