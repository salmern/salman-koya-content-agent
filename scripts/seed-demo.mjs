/**
 * Demo Seed Script
 *
 * Seeds the database with realistic demo content records.
 * Run after setting up Supabase and creating demo user accounts.
 *
 * Prerequisites:
 *   1. Run database migrations (001, 002, 003)
 *   2. Create demo users in Supabase Auth dashboard:
 *      - admin@koya-demo.com   / DemoAdmin2026!
 *      - reviewer@koya-demo.com / DemoReview2026!
 *      - manager@koya-demo.com  / DemoManager2026!
 *   3. Copy .env.example to .env.local and fill in values
 *
 * Usage:
 *   node scripts/seed-demo.mjs
 */

import { createClient } from "@supabase/supabase-js";
import { readFileSync } from "fs";
import { resolve, dirname } from "path";
import { fileURLToPath } from "url";

const __dirname = dirname(fileURLToPath(import.meta.url));

// Load .env.local manually
function loadEnv() {
  try {
    const envPath = resolve(__dirname, "../.env.local");
    const lines = readFileSync(envPath, "utf-8").split("\n");
    for (const line of lines) {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith("#")) continue;
      const [key, ...rest] = trimmed.split("=");
      if (key && rest.length) {
        process.env[key.trim()] = rest.join("=").trim();
      }
    }
  } catch {
    console.error("Could not load .env.local — ensure it exists");
  }
}

loadEnv();

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (
  !supabaseUrl ||
  supabaseUrl.includes("placeholder") ||
  !serviceRoleKey ||
  serviceRoleKey.includes("placeholder")
) {
  console.error(
    "❌  Real Supabase credentials required.\n" +
    "   Set NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY in .env.local"
  );
  process.exit(1);
}

const admin = createClient(supabaseUrl, serviceRoleKey, {
  auth: { autoRefreshToken: false, persistSession: false },
});

// ---- Helpers -----------------------------------------------

function uuid() {
  return crypto.randomUUID();
}

function ago(days, hours = 0) {
  const d = new Date();
  d.setDate(d.getDate() - days);
  d.setHours(d.getHours() - hours);
  return d.toISOString();
}

function future(days) {
  const d = new Date();
  d.setDate(d.getDate() + days);
  return d.toISOString();
}

// ---- Main seed ---------------------------------------------

async function seed() {
  console.log("🌱  Starting demo seed...\n");

  // ---- Get user IDs from profiles ------------------------
  const { data: profiles, error: profileErr } = await admin
    .from("profiles")
    .select("id, email, role")
    .in("email", [
      "admin@koya-demo.com",
      "reviewer@koya-demo.com",
      "manager@koya-demo.com",
    ]);

  if (profileErr || !profiles?.length) {
    console.error(
      "❌  Demo users not found in profiles table.\n" +
      "   Please create the demo users in Supabase Auth first:\n" +
      "   admin@koya-demo.com / DemoAdmin2026!\n" +
      "   reviewer@koya-demo.com / DemoReview2026!\n" +
      "   manager@koya-demo.com / DemoManager2026!\n"
    );
    process.exit(1);
  }

  const manager = profiles.find((p) => p.email === "manager@koya-demo.com");
  const reviewer = profiles.find((p) => p.email === "reviewer@koya-demo.com");
  const adminUser = profiles.find((p) => p.email === "admin@koya-demo.com");

  if (!manager || !reviewer) {
    console.error("❌  Could not find manager or reviewer profile. Check user setup.");
    process.exit(1);
  }

  console.log(`✓  Found users: ${profiles.map((p) => p.email).join(", ")}`);

  // ---- Update roles if needed ----------------------------
  await admin.from("profiles").update({ role: "admin" }).eq("email", "admin@koya-demo.com");
  await admin.from("profiles").update({ role: "reviewer" }).eq("email", "reviewer@koya-demo.com");
  await admin.from("profiles").update({ role: "content_manager" }).eq("email", "manager@koya-demo.com");
  console.log("✓  Roles updated");

  // ---- SCENARIO 1: Published article (complete pipeline) --
  console.log("\n📝  Creating Scenario 1: Published article...");

  const req1Id = uuid();
  await admin.from("content_requests").insert({
    id: req1Id,
    user_id: manager.id,
    content_idea: "How AI is changing recruitment in 2026",
    target_audience: "HR managers and talent acquisition teams",
    primary_keyword: "AI recruitment",
    content_goal: "Educate HR teams about practical AI tools and their impact",
    source_url: "https://example.com/ai-recruitment-2026",
    tone: "professional",
    requested_channels: ["article", "linkedin", "newsletter"],
    status: "PUBLISHED",
    created_at: ago(14),
    updated_at: ago(2),
  });

  const run1Id = uuid();
  await admin.from("research_runs").insert({
    id: run1Id,
    content_request_id: req1Id,
    status: "complete",
    source_count: 3,
    selected_source_count: 2,
    started_at: ago(14, 2),
    completed_at: ago(14, 1),
    created_at: ago(14, 2),
    updated_at: ago(14, 1),
  });

  const src1aId = uuid();
  const src1bId = uuid();
  await admin.from("content_sources").insert([
    {
      id: src1aId,
      research_run_id: run1Id,
      content_request_id: req1Id,
      url: "https://example.com/ai-recruitment-2026",
      title: "AI Recruitment Trends 2026: What HR Leaders Need to Know",
      domain: "example.com",
      author: "Sarah Chen",
      published_at: ago(30),
      retrieved_at: ago(14, 2),
      content: "AI recruitment tools are transforming how companies source and screen talent...",
      summary: "Covers AI screening automation, bias risks, and implementation strategies for HR teams.",
      relevance_score: 9.2,
      selected: true,
      selection_reason: "Primary source covering all key AI recruitment topics directly relevant to the content brief.",
      retrieval_status: "retrieved",
      content_hash: "abc123def456",
      word_count: 1850,
      created_at: ago(14, 2),
      updated_at: ago(14, 2),
    },
    {
      id: src1bId,
      research_run_id: run1Id,
      content_request_id: req1Id,
      url: "https://blog.example.org/hr-tech-adoption",
      title: "HR Technology Adoption Report 2025",
      domain: "blog.example.org",
      author: "Koya Research Team",
      published_at: ago(60),
      retrieved_at: ago(14, 2),
      content: "Enterprise HR technology adoption increased by 34% in 2025...",
      summary: "Industry report on HR technology adoption rates and ROI data.",
      relevance_score: 7.5,
      selected: true,
      selection_reason: "Provides supporting data on HR technology adoption rates useful for the audience.",
      retrieval_status: "retrieved",
      content_hash: "xyz789uvw012",
      word_count: 920,
      created_at: ago(14, 2),
      updated_at: ago(14, 2),
    },
  ]);

  const plan1Id = uuid();
  await admin.from("content_plans").insert({
    id: plan1Id,
    content_request_id: req1Id,
    working_title: "AI Recruitment in 2026: A Practical Guide for HR Managers",
    primary_keyword: "AI recruitment",
    secondary_keywords: ["talent acquisition AI", "automated screening", "HR technology 2026"],
    search_intent: "informational",
    target_audience: "HR managers and talent acquisition professionals",
    content_goal: "Help HR teams understand and evaluate AI recruitment tools",
    outline: [
      { level: "h1", title: "AI Recruitment in 2026: A Practical Guide", notes: "Strong hook", source_ids: [] },
      { level: "h2", title: "What Has Changed in the Last 12 Months", notes: null, source_ids: [src1aId] },
      { level: "h2", title: "Key Applications for HR Teams", notes: null, source_ids: [src1aId, src1bId] },
      { level: "h2", title: "Risks and Challenges", notes: null, source_ids: [src1aId] },
      { level: "h2", title: "How to Evaluate AI Recruitment Tools", notes: null, source_ids: [src1bId] },
      { level: "h2", title: "Getting Started: A Practical Roadmap", notes: null, source_ids: [] },
    ],
    key_points: [
      "AI recruitment tools reduce time-to-screen by 40–70%",
      "Bias risk is real and must be actively managed",
      "Start with one use case before scaling",
      "Measure ROI from day one",
    ],
    source_mapping: [
      { source_id: src1aId, usage: "Primary evidence for AI adoption trends and applications", sections: ["What Has Changed", "Key Applications"] },
      { source_id: src1bId, usage: "Supporting statistics on HR tech adoption", sections: ["Key Applications", "How to Evaluate"] },
    ],
    recommended_links: [
      { url: "/content", anchor_text: "Browse all content", type: "internal" },
    ],
    recommended_image_description: "Illustration of HR manager reviewing AI-assisted candidate shortlist",
    created_at: ago(13),
    updated_at: ago(13),
  });

  const draft1aId = uuid();
  await admin.from("content_drafts").insert({
    id: draft1aId,
    content_request_id: req1Id,
    content_plan_id: plan1Id,
    version_number: 1,
    parent_version_id: null,
    title: "AI Recruitment in 2026: A Practical Guide for HR Managers",
    summary: "A comprehensive guide helping HR managers understand and evaluate AI recruitment tools, covering key applications, risks, and a practical implementation roadmap.",
    article: `# AI Recruitment in 2026: A Practical Guide for HR Managers

AI recruitment is no longer a futuristic concept — it is actively reshaping how companies find, screen, and hire talent. For HR managers navigating this shift, understanding what these tools can and cannot do is no longer optional.

## What Has Changed in the Last 12 Months

The pace of adoption has accelerated sharply. According to the HR Technology Adoption Report 2025, enterprise adoption of AI-assisted recruitment tools grew by 34% over the prior year. The tools themselves have also matured: early-generation keyword-matching systems have given way to more contextual screening capabilities that consider role requirements, career trajectory, and skill adjacencies.

## Key Applications for HR Teams

**Automated Resume Screening**
AI systems can process thousands of applications against structured criteria, surfacing the most relevant candidates for recruiter review. Teams using these tools report reducing initial screening time by 40–70%, though the quality of output depends heavily on how well the criteria are defined.

**Interview Scheduling and Coordination**
Coordination overhead — a significant time sink for many recruitment teams — can be substantially reduced through AI-driven scheduling tools that handle candidate communication, rescheduling, and logistics automatically.

**Candidate Sourcing**
Proactive sourcing tools can identify passive candidates matching specific profiles across professional networks. These work best when combined with strong recruiter judgement about cultural fit and long-term potential.

## Risks and Challenges

No implementation guide would be complete without an honest assessment of the risks:

**Bias amplification.** AI models trained on historical hiring data may encode and amplify existing biases. Regular audits of shortlisting patterns are essential.

**Candidate experience.** Poorly implemented automation can feel impersonal and damage employer brand. The best implementations keep AI in the background and maintain human touchpoints where they matter.

**Integration complexity.** Connecting AI tools to existing ATS platforms requires technical and operational effort that is frequently underestimated at the evaluation stage.

## How to Evaluate AI Recruitment Tools

When evaluating vendors, focus on three areas: explainability (can you understand why a candidate was shortlisted or rejected?), bias testing (has the vendor conducted independent audits?), and integration depth (how well does it connect to your existing stack?).

## Getting Started: A Practical Roadmap

1. **Audit your current workflow.** Identify where time is lost and where errors occur most frequently.
2. **Define success criteria.** Set specific, measurable targets before you evaluate any tool.
3. **Pilot on one role type.** Avoid broad rollout before you have evidence it works for your context.
4. **Involve your team.** Practitioners must be part of the design and rollout — not just the recipients.
5. **Review regularly.** Treat AI recruitment as an ongoing programme, not a one-time deployment.

AI recruitment tools are powerful complements to experienced recruiters — not replacements for them.`,
    primary_keyword: "AI recruitment",
    secondary_keywords: ["talent acquisition AI", "automated screening", "HR technology 2026"],
    source_ids: [src1aId, src1bId],
    key_claims: [
      { claim: "Enterprise adoption grew by 34%", source_ids: [src1bId], supported: true, flag: false },
      { claim: "Screening time reduced by 40–70%", source_ids: [src1aId], supported: true, flag: false },
    ],
    word_count: 512,
    reading_time_minutes: 3,
    change_summary: null,
    created_by: "ai",
    created_by_user_id: null,
    created_at: ago(13, 1),
  });

  const eval1Id = uuid();
  await admin.from("draft_evaluations").insert({
    id: eval1Id,
    draft_id: draft1aId,
    content_request_id: req1Id,
    overall_status: "PASS",
    scores: {
      topic_relevance: 9.0, source_grounding: 8.5, factual_consistency: 8.5,
      audience_fit: 9.0, tone: 8.5, seo_fit: 8.0, channel_fit: 8.5, clarity: 9.0,
      completeness: 8.5, overall: 8.6,
    },
    unsupported_claims: [],
    weak_sections: [],
    recommended_changes: ["Consider adding a brief case study in the Key Applications section"],
    summary: "Strong draft well-grounded in reviewed sources. Clear structure with appropriate tone for HR managers. Minor improvement possible in the Applications section but not required before publication.",
    model: "mock-claude",
    input_tokens: 2100,
    output_tokens: 580,
    estimated_cost_usd: 0.0150,
    created_at: ago(13, 0),
  });

  const review1Id = uuid();
  await admin.from("human_reviews").insert({
    id: review1Id,
    content_request_id: req1Id,
    draft_id: draft1aId,
    draft_version: 1,
    reviewer_id: reviewer.id,
    decision: "approved",
    feedback: "Well-structured article with strong source grounding. Practical roadmap section is particularly useful for the target audience. Approved for publication.",
    revision_instructions: null,
    created_at: ago(12),
  });

  const cc1aId = uuid();
  const cc1bId = uuid();
  await admin.from("channel_content").insert([
    {
      id: cc1aId,
      content_request_id: req1Id,
      approved_draft_id: draft1aId,
      channel: "linkedin",
      content: `🤔 Most HR managers are still approaching AI recruitment the wrong way.

They buy a tool. They roll it out broadly. They measure it six months later.

Here's what the teams actually seeing results do differently:

→ They start with ONE use case
→ They define success metrics before they start
→ They involve the practitioners who do the work
→ They treat it as an ongoing programme, not a project

The AI isn't the hard part. The change management is.

I wrote a practical guide on this — covering what's actually changed in the last 12 months, which applications work, and how to evaluate vendors without getting burned.

Link in comments 👇`,
      hashtags: ["AIRecruitment", "HRTech", "TalentAcquisition"],
      cta: "Read the full guide in the comments →",
      word_count: 103,
      character_count: 612,
      validation_status: "valid",
      validation_errors: [],
      generation_model: "mock-claude",
      revision_count: 0,
      created_at: ago(11),
      updated_at: ago(11),
    },
    {
      id: cc1bId,
      content_request_id: req1Id,
      approved_draft_id: draft1aId,
      channel: "newsletter",
      subject_line: "AI Recruitment in 2026 — What HR Teams Need to Know",
      content: `Hi there,

This week we're looking at something that's generating a lot of questions in HR circles right now: what AI recruitment tools actually deliver versus what vendors promise.

The short answer: they can genuinely help with screening volume and scheduling overhead — but only if you implement them carefully.

**What we cover in this week's guide:**

Enterprise adoption of AI-assisted recruitment tools grew 34% last year. The tools have also matured significantly. But the teams seeing real ROI are doing something most teams aren't: they're starting small, measuring carefully, and treating it as an ongoing programme rather than a one-time deployment.

**The practical takeaway:**

Before evaluating any tool, write down what "working" means for your specific context. Time saved? Cost per hire? Screening error rate? Pick a number. Measure it. Only then should you consider expanding.

**Read the full guide:** [Link]

What's your biggest challenge with AI recruitment right now? Hit reply — I read every response.

Until next week,
The Koya Team`,
      cta: "Read the full guide →",
      hashtags: [],
      word_count: 193,
      character_count: 1089,
      validation_status: "valid",
      validation_errors: [],
      generation_model: "mock-claude",
      revision_count: 0,
      created_at: ago(11),
      updated_at: ago(11),
    },
  ]);

  const pq1Id = uuid();
  await admin.from("publishing_queue").insert([
    {
      id: pq1Id,
      content_request_id: req1Id,
      channel_content_id: cc1aId,
      channel: "linkedin",
      approved_draft_id: draft1aId,
      approved_version: 1,
      idempotency_key: `${req1Id}__linkedin__v1`,
      status: "PUBLISHED",
      scheduled_at: null,
      published_at: ago(10),
      error_message: null,
      retry_count: 0,
      provider: "mock",
      provider_post_id: `demo_linkedin_${Date.now()}`,
      created_at: ago(11),
      updated_at: ago(10),
    },
    {
      id: uuid(),
      content_request_id: req1Id,
      channel_content_id: cc1bId,
      channel: "newsletter",
      approved_draft_id: draft1aId,
      approved_version: 1,
      idempotency_key: `${req1Id}__newsletter__v1`,
      status: "PUBLISHED",
      scheduled_at: null,
      published_at: ago(10),
      error_message: null,
      retry_count: 0,
      provider: "mock",
      provider_post_id: `demo_newsletter_${Date.now()}`,
      created_at: ago(11),
      updated_at: ago(10),
    },
  ]);

  // ---- SCENARIO 2: Awaiting review -----------------------
  console.log("📝  Creating Scenario 2: Awaiting review...");

  const req2Id = uuid();
  await admin.from("content_requests").insert({
    id: req2Id,
    user_id: manager.id,
    content_idea: "The hidden costs of bad hires and how to prevent them",
    target_audience: "CFOs and finance directors at growth-stage companies",
    primary_keyword: "cost of bad hire",
    content_goal: "Build awareness of financial risk and position our solution",
    tone: "authoritative",
    requested_channels: ["article", "linkedin"],
    status: "AWAITING_REVIEW",
    created_at: ago(3),
    updated_at: ago(1),
  });

  const run2Id = uuid();
  await admin.from("research_runs").insert({
    id: run2Id,
    content_request_id: req2Id,
    status: "complete",
    source_count: 2,
    selected_source_count: 2,
    started_at: ago(3, 2),
    completed_at: ago(3, 1),
    created_at: ago(3, 2),
    updated_at: ago(3, 1),
  });

  await admin.from("content_sources").insert({
    id: uuid(),
    research_run_id: run2Id,
    content_request_id: req2Id,
    url: "https://shrm.org/bad-hire-cost-2025",
    title: "The True Cost of a Bad Hire: 2025 Research",
    domain: "shrm.org",
    summary: "Research indicating bad hires cost between 30-150% of annual salary depending on seniority.",
    relevance_score: 9.0,
    selected: true,
    selection_reason: "Direct evidence supporting the cost claims in the content brief.",
    retrieval_status: "retrieved",
    word_count: 1200,
    created_at: ago(3, 2),
    updated_at: ago(3, 2),
  });

  const plan2Id = uuid();
  await admin.from("content_plans").insert({
    id: plan2Id,
    content_request_id: req2Id,
    working_title: "The Hidden Costs of Bad Hires: What Your Finance Team Isn't Measuring",
    primary_keyword: "cost of bad hire",
    secondary_keywords: ["hiring mistakes cost", "recruitment ROI", "talent risk"],
    search_intent: "informational",
    target_audience: "CFOs and finance directors",
    content_goal: "Quantify the financial risk of bad hires and introduce prevention strategies",
    outline: [
      { level: "h1", title: "The Hidden Costs of Bad Hires", notes: null, source_ids: [] },
      { level: "h2", title: "What the Research Shows", notes: null, source_ids: [] },
      { level: "h2", title: "The Categories of Cost", notes: null, source_ids: [] },
      { level: "h2", title: "Why Finance Teams Underestimate the Risk", notes: null, source_ids: [] },
      { level: "h2", title: "Prevention: Where to Invest", notes: null, source_ids: [] },
    ],
    key_points: ["Bad hires cost 30–150% of annual salary", "Most costs are hidden", "Prevention ROI is strong"],
    source_mapping: [],
    recommended_links: [],
    recommended_image_description: null,
    created_at: ago(2),
    updated_at: ago(2),
  });

  const draft2Id = uuid();
  await admin.from("content_drafts").insert({
    id: draft2Id,
    content_request_id: req2Id,
    content_plan_id: plan2Id,
    version_number: 2,
    parent_version_id: null,
    title: "The Hidden Costs of Bad Hires: What Your Finance Team Isn't Measuring",
    summary: "Quantifies the financial risk of bad hires and outlines practical prevention strategies for finance leaders.",
    article: `# The Hidden Costs of Bad Hires: What Your Finance Team Isn't Measuring

The cost of a bad hire is almost certainly not in your budget model. Most finance teams account for direct recruitment costs — agency fees, advertising, interview time. Very few account for what comes after a hire goes wrong.

## What the Research Shows

Research indicates that bad hires cost between 30% and 150% of annual salary, depending on seniority and role complexity. For a mid-level manager at £80,000, that is a potential cost of £24,000 to £120,000 — from a single poor hiring decision.

## The Categories of Cost

The direct costs are the visible part: severance, re-recruitment, agency fees, and onboarding time for the replacement. The hidden costs are larger: the productivity loss during the hire's tenure, the management time spent managing performance issues, the team disruption, and in some cases the downstream impact on client relationships or product quality.

## Why Finance Teams Underestimate the Risk

These costs do not appear on a single line in a management account. They are distributed across headcount costs, management time, project delays, and customer metrics. Without a deliberate effort to track them, they remain invisible.

## Prevention: Where to Invest

The best ROI in talent acquisition comes from structured assessment processes, clearly defined role success profiles, and reference checking that goes beyond the perfunctory. The cost of a more rigorous process at the front end is a fraction of the cost of a remediation process at the back end.`,
    primary_keyword: "cost of bad hire",
    secondary_keywords: ["hiring mistakes cost", "recruitment ROI"],
    source_ids: [],
    key_claims: [
      { claim: "Bad hires cost 30–150% of annual salary", source_ids: [], supported: false, flag: true },
    ],
    word_count: 310,
    reading_time_minutes: 2,
    change_summary: "Revised to improve source grounding and expand the Prevention section.",
    created_by: "ai_revision",
    created_by_user_id: null,
    created_at: ago(1),
  });

  await admin.from("draft_evaluations").insert({
    id: uuid(),
    draft_id: draft2Id,
    content_request_id: req2Id,
    overall_status: "PASS",
    scores: {
      topic_relevance: 8.5, source_grounding: 7.0, factual_consistency: 7.5,
      audience_fit: 9.0, tone: 9.0, seo_fit: 7.5, channel_fit: 8.0, clarity: 9.0,
      completeness: 7.0, overall: 8.1,
    },
    unsupported_claims: [
      {
        claim: "Bad hires cost 30–150% of annual salary",
        location: "Introduction and What the Research Shows section",
        recommendation: "The figure is widely cited but the specific source should be referenced directly.",
      },
    ],
    weak_sections: [],
    recommended_changes: ["Add inline source reference for the 30–150% cost figure"],
    summary: "Well-written article with strong audience fit. One key claim needs clearer source attribution before publication.",
    model: "mock-claude",
    input_tokens: 1800,
    output_tokens: 520,
    estimated_cost_usd: 0.0134,
    created_at: ago(1),
  });

  // ---- SCENARIO 3: Draft in progress ---------------------
  console.log("📝  Creating Scenario 3: Draft in progress (GENERATING)...");

  const req3Id = uuid();
  await admin.from("content_requests").insert({
    id: req3Id,
    user_id: manager.id,
    content_idea: "Building high-performing remote engineering teams in 2026",
    target_audience: "CTOs and engineering leaders at scale-up companies",
    primary_keyword: "remote engineering team",
    tone: "conversational",
    requested_channels: ["article", "linkedin", "x"],
    status: "GENERATING",
    created_at: ago(0),
    updated_at: ago(0),
  });

  // ---- SCENARIO 4: Scheduled -----------------------------
  console.log("📝  Creating Scenario 4: Scheduled for publishing...");

  const req4Id = uuid();
  await admin.from("content_requests").insert({
    id: req4Id,
    user_id: manager.id,
    content_idea: "Why most onboarding programmes fail new hires in the first 90 days",
    target_audience: "HR directors and people operations leaders",
    primary_keyword: "employee onboarding",
    tone: "educational",
    requested_channels: ["article", "newsletter"],
    status: "SCHEDULED",
    created_at: ago(7),
    updated_at: ago(2),
  });

  const run4Id = uuid();
  await admin.from("research_runs").insert({
    id: run4Id,
    content_request_id: req4Id,
    status: "complete",
    source_count: 2,
    selected_source_count: 2,
    started_at: ago(7, 2),
    completed_at: ago(7, 1),
    created_at: ago(7, 2),
    updated_at: ago(7, 1),
  });

  const draft4Id = uuid();
  await admin.from("content_drafts").insert({
    id: draft4Id,
    content_request_id: req4Id,
    content_plan_id: null,
    version_number: 1,
    parent_version_id: null,
    title: "Why Most Onboarding Programmes Fail (And How to Fix Yours)",
    summary: "An evidence-based analysis of why new hire onboarding underperforms and a practical framework for improvement.",
    article: "# Why Most Onboarding Programmes Fail\n\nOnboarding failure is expensive...",
    primary_keyword: "employee onboarding",
    secondary_keywords: ["new hire onboarding", "people operations"],
    source_ids: [],
    key_claims: [],
    word_count: 620,
    reading_time_minutes: 4,
    change_summary: null,
    created_by: "ai",
    created_by_user_id: null,
    created_at: ago(6),
  });

  await admin.from("human_reviews").insert({
    id: uuid(),
    content_request_id: req4Id,
    draft_id: draft4Id,
    draft_version: 1,
    reviewer_id: reviewer.id,
    decision: "approved",
    feedback: "Solid structure and well-grounded argument. Approved for scheduling.",
    revision_instructions: null,
    created_at: ago(5),
  });

  const cc4Id = uuid();
  await admin.from("channel_content").insert({
    id: cc4Id,
    content_request_id: req4Id,
    approved_draft_id: draft4Id,
    channel: "newsletter",
    subject_line: "Why Most Onboarding Programmes Fail New Hires",
    content: "Hi there,\n\nThis week: why most onboarding programmes are set up to fail...",
    cta: "Read the full guide →",
    hashtags: [],
    word_count: 280,
    character_count: 1520,
    validation_status: "valid",
    validation_errors: [],
    generation_model: "mock-claude",
    revision_count: 0,
    created_at: ago(4),
    updated_at: ago(4),
  });

  await admin.from("publishing_queue").insert({
    id: uuid(),
    content_request_id: req4Id,
    channel_content_id: cc4Id,
    channel: "newsletter",
    approved_draft_id: draft4Id,
    approved_version: 1,
    idempotency_key: `${req4Id}__newsletter__v1`,
    status: "SCHEDULED",
    scheduled_at: future(3),
    published_at: null,
    error_message: null,
    retry_count: 0,
    provider: "mock",
    provider_post_id: null,
    created_at: ago(4),
    updated_at: ago(4),
  });

  // ---- SCENARIO 5: Rejected ------------------------------
  console.log("📝  Creating Scenario 5: Rejected...");

  const req5Id = uuid();
  await admin.from("content_requests").insert({
    id: req5Id,
    user_id: manager.id,
    content_idea: "10 ways AI will replace all HR professionals by 2027",
    target_audience: "HR professionals",
    primary_keyword: "AI replacing HR",
    tone: "persuasive",
    requested_channels: ["article"],
    status: "REJECTED",
    created_at: ago(10),
    updated_at: ago(8),
  });

  const draft5Id = uuid();
  await admin.from("content_drafts").insert({
    id: draft5Id,
    content_request_id: req5Id,
    content_plan_id: null,
    version_number: 1,
    parent_version_id: null,
    title: "10 Ways AI Will Replace HR Professionals by 2027",
    summary: "Provocative argument for full AI replacement of HR roles.",
    article: "# 10 Ways AI Will Replace HR Professionals\n\nThe robots are coming for HR...",
    primary_keyword: "AI replacing HR",
    secondary_keywords: [],
    source_ids: [],
    key_claims: [],
    word_count: 400,
    reading_time_minutes: 2,
    change_summary: null,
    created_by: "ai",
    created_by_user_id: null,
    created_at: ago(9),
  });

  await admin.from("human_reviews").insert({
    id: uuid(),
    content_request_id: req5Id,
    draft_id: draft5Id,
    draft_version: 1,
    reviewer_id: reviewer.id,
    decision: "rejected",
    feedback: "The premise is not supported by evidence and is likely to be off-putting to our core audience of HR professionals. The tone is unnecessarily alarmist. This content idea should be reframed as 'how AI augments HR roles' rather than replaces them.",
    revision_instructions: null,
    created_at: ago(8),
  });

  // ---- SCENARIO 6: Failed --------------------------------
  console.log("📝  Creating Scenario 6: Failed (research error)...");

  const req6Id = uuid();
  await admin.from("content_requests").insert({
    id: req6Id,
    user_id: manager.id,
    content_idea: "Salary benchmarking strategies for competitive hiring",
    target_audience: "Total rewards and compensation managers",
    source_url: "https://paywalled-source.example.com/salary-data-2026",
    requested_channels: ["article"],
    status: "FAILED",
    created_at: ago(2),
    updated_at: ago(2),
  });

  await admin.from("research_runs").insert({
    id: uuid(),
    content_request_id: req6Id,
    status: "failed",
    error_message: "The primary source URL returned a paywall response (HTTP 402). No usable content could be retrieved. Please provide the article text directly in Supporting Material, or use a different public source URL.",
    source_count: 0,
    selected_source_count: 0,
    started_at: ago(2, 1),
    completed_at: ago(2, 0),
    created_at: ago(2, 1),
    updated_at: ago(2, 0),
  });

  await admin.from("failure_events").insert({
    id: uuid(),
    content_request_id: req6Id,
    operation: "research",
    error_type: "RESEARCH_FAILED",
    message: "Source URL returned paywall (HTTP 402): https://paywalled-source.example.com/salary-data-2026",
    stack_trace: null,
    retry_count: 1,
    max_retries: 3,
    is_retryable: false,
    metadata: { url: "https://paywalled-source.example.com/salary-data-2026", http_status: 402 },
    created_at: ago(2, 0),
  });

  // ---- Audit log entries ---------------------------------
  console.log("📝  Writing audit log entries...");

  await admin.from("audit_logs").insert([
    {
      actor_id: manager.id,
      actor_email: "manager@koya-demo.com",
      action: "content_created",
      entity_type: "content_request",
      entity_id: req1Id,
      content_request_id: req1Id,
      metadata: { content_idea: "How AI is changing recruitment in 2026" },
      created_at: ago(14),
    },
    {
      actor_id: null,
      actor_email: null,
      action: "research_started",
      entity_type: "research_run",
      entity_id: run1Id,
      content_request_id: req1Id,
      metadata: {},
      created_at: ago(14, 2),
    },
    {
      actor_id: null,
      actor_email: null,
      action: "research_completed",
      entity_type: "research_run",
      entity_id: run1Id,
      content_request_id: req1Id,
      metadata: { sources_found: 3, sources_selected: 2 },
      created_at: ago(14, 1),
    },
    {
      actor_id: null,
      actor_email: null,
      action: "draft_generated",
      entity_type: "content_draft",
      entity_id: draft1aId,
      content_request_id: req1Id,
      metadata: { version: 1, word_count: 512 },
      created_at: ago(13, 1),
    },
    {
      actor_id: null,
      actor_email: null,
      action: "draft_evaluated",
      entity_type: "draft_evaluation",
      entity_id: eval1Id,
      content_request_id: req1Id,
      metadata: { overall_status: "PASS", overall_score: 8.6 },
      created_at: ago(13, 0),
    },
    {
      actor_id: reviewer.id,
      actor_email: "reviewer@koya-demo.com",
      action: "review_approved",
      entity_type: "human_review",
      entity_id: review1Id,
      content_request_id: req1Id,
      metadata: { draft_version: 1 },
      created_at: ago(12),
    },
    {
      actor_id: manager.id,
      actor_email: "manager@koya-demo.com",
      action: "published",
      entity_type: "publishing_queue",
      entity_id: pq1Id,
      content_request_id: req1Id,
      metadata: { channel: "linkedin", provider: "mock", is_demo: true },
      created_at: ago(10),
    },
    {
      actor_id: reviewer.id,
      actor_email: "reviewer@koya-demo.com",
      action: "review_rejected",
      entity_type: "human_review",
      entity_id: req5Id,
      content_request_id: req5Id,
      metadata: { draft_version: 1, reason: "Off-brand content premise" },
      created_at: ago(8),
    },
  ]);

  console.log("\n✅  Demo seed complete!\n");
  console.log("Demo scenarios created:");
  console.log("  1. Published article (AI recruitment) — 2 channels published");
  console.log("  2. Awaiting review (bad hire costs) — ready for reviewer");
  console.log("  3. Generating (remote teams) — simulates in-progress");
  console.log("  4. Scheduled (onboarding) — newsletter scheduled in 3 days");
  console.log("  5. Rejected (AI replaces HR) — shows rejection workflow");
  console.log("  6. Failed (salary benchmarking) — shows paywall failure\n");
  console.log("Sign in at http://localhost:3000");
  console.log("  Admin   : admin@koya-demo.com    / DemoAdmin2026!");
  console.log("  Reviewer: reviewer@koya-demo.com / DemoReview2026!");
  console.log("  Manager : manager@koya-demo.com  / DemoManager2026!\n");
}

seed().catch((err) => {
  console.error("❌  Seed failed:", err);
  process.exit(1);
});
