/**
 * Mock AI Provider
 *
 * Returns realistic, deterministic outputs for development and testing.
 * Does NOT call the Claude API.
 */

import type {
  AiProvider,
  AiResult,
  AiUsage,
  ArticleDraftOutput,
  ContentPlanOutput,
  EvaluationOutput,
  LinkedInOutput,
  NewsletterOutput,
  SourceSummaryOutput,
  XOutput,
} from "./provider";
import type { ContentPlan } from "@/types";

function mockUsage(inputTokens = 1200, outputTokens = 800): AiUsage {
  return {
    model: "mock-claude",
    inputTokens,
    outputTokens,
    estimatedCostUsd: (inputTokens * 0.000003 + outputTokens * 0.000015),
  };
}

async function delay(ms = 600) {
  await new Promise((r) => setTimeout(r, ms + Math.random() * 400));
}

export class MockAiProvider implements AiProvider {
  readonly name = "mock";
  readonly model = "mock-claude";

  async generateContentPlan(params: {
    contentIdea: string;
    targetAudience: string;
    primaryKeyword: string | null;
    contentGoal: string | null;
    tone: string | null;
    sources: { id: string; url: string; summary: string; title: string | null }[];
  }): Promise<AiResult<ContentPlanOutput>> {
    await delay(800);
    const keyword = params.primaryKeyword ?? params.contentIdea.split(" ").slice(0, 3).join(" ");

    return {
      data: {
        working_title: `${params.contentIdea}: A Practical Guide for ${params.targetAudience}`,
        primary_keyword: keyword,
        secondary_keywords: [
          `${keyword} tools`,
          `${keyword} best practices`,
          `${keyword} implementation`,
          "future of work",
        ],
        search_intent: "informational",
        target_audience: params.targetAudience,
        content_goal: params.contentGoal ?? `Educate ${params.targetAudience} about ${params.contentIdea}`,
        outline: [
          { level: "h1", title: `${params.contentIdea}: A Practical Guide`, notes: "Hook with a striking statistic or question", source_ids: [] },
          { level: "h2", title: "What Is Happening Right Now", notes: "Set the context", source_ids: params.sources.slice(0, 1).map(s => s.id) },
          { level: "h2", title: "Key Applications and Use Cases", notes: "Cover 3-4 concrete examples", source_ids: params.sources.slice(0, 2).map(s => s.id) },
          { level: "h2", title: "Challenges and Considerations", notes: "Be honest about limitations", source_ids: params.sources.slice(0, 1).map(s => s.id) },
          { level: "h2", title: "How to Get Started", notes: "Actionable steps for the audience", source_ids: [] },
          { level: "h2", title: "What Comes Next", notes: "Forward-looking conclusion", source_ids: [] },
        ],
        key_points: [
          `${params.contentIdea} is reshaping how ${params.targetAudience} work`,
          "Early adoption provides competitive advantages",
          "Implementation requires planning and change management",
          "Human judgment remains essential alongside AI tools",
          "ROI is measurable with the right metrics",
        ],
        source_mapping: params.sources.map((s, i) => ({
          source_id: s.id,
          usage: `Used for ${["background context", "specific examples", "statistical evidence", "expert perspective"][i % 4]}`,
          sections: ["Key Applications and Use Cases", "Challenges and Considerations"],
        })),
        recommended_links: [
          { url: "https://example.com/related-guide", anchor_text: "Complete implementation guide", type: "external" },
          { url: "/resources", anchor_text: "Related resources", type: "internal" },
        ],
        recommended_image_description: `Illustration showing ${params.contentIdea.toLowerCase()} workflow with ${params.targetAudience} collaborating`,
      },
      usage: mockUsage(1500, 900),
    };
  }

  async generateArticleDraft(params: {
    plan: ContentPlan;
    sources: { id: string; url: string; content: string; title: string | null; summary: string }[];
    tone: string | null;
    additionalInstructions: string | null;
    revisionInstructions?: string | null;
    previousDraft?: string | null;
  }): Promise<AiResult<ArticleDraftOutput>> {
    await delay(1200);
    const { plan } = params;
    const isRevision = Boolean(params.revisionInstructions && params.previousDraft);

    const article = `# ${plan.working_title}

${plan.target_audience.includes("manager") ? "As an HR manager" : `As a ${plan.target_audience}`}, understanding ${plan.primary_keyword} is no longer optional—it's a competitive necessity.

## What Is Happening Right Now

${plan.primary_keyword} is fundamentally changing how organizations operate. Recent developments have accelerated adoption across industries, with forward-thinking teams using these tools to work faster, make better decisions, and deliver stronger results.

The shift is driven by three forces: improved model capabilities, reduced implementation costs, and growing evidence of measurable ROI from early adopters.

## Key Applications and Use Cases

**Automated Screening and Triage**
${plan.primary_keyword} tools can process high volumes of inputs in seconds, surfacing the most relevant items for human attention. Teams report spending 40-60% less time on initial filtering tasks.

**Predictive Analytics**
By analyzing historical patterns, AI systems can identify trends before they become obvious. This allows ${plan.target_audience} to act proactively rather than reactively.

**Communication and Reporting**
Drafting reports, summaries, and routine communications can be accelerated significantly, freeing practitioners to focus on higher-value strategic work.

## Challenges and Considerations

Adopting ${plan.primary_keyword} tools is not without friction:

- **Data quality**: AI is only as good as the data it learns from
- **Change management**: Teams need time and support to adapt their workflows
- **Bias and fairness**: Careful review is needed to avoid embedding historical biases
- **Integration complexity**: Connecting new tools to existing systems takes planning

These challenges are real but manageable. Organizations that address them systematically report higher satisfaction and better outcomes than those that rush adoption.

## How to Get Started

A phased approach works best:

1. **Audit current workflows** — identify repetitive, high-volume tasks
2. **Start small** — pilot with one use case before expanding
3. **Measure from day one** — define success metrics before you begin
4. **Involve the team** — practitioners who use the tools must help design the rollout
5. **Review and iterate** — plan for ongoing refinement, not a one-time deployment

## What Comes Next

${plan.primary_keyword} capabilities will continue to improve rapidly. ${plan.target_audience} who build institutional knowledge now will be better positioned to take advantage of future advances.

The goal is not to replace human expertise—it is to amplify it. The most effective teams will be those that combine strong human judgment with powerful AI capabilities.

*Sources referenced in this article include ${params.sources.slice(0, 3).map(s => s.title ?? s.url).join(", ")}.*
${isRevision ? "\n\n*This is a revised version incorporating reviewer feedback.*" : ""}`;

    const wordCount = article.split(/\s+/).filter(Boolean).length;

    return {
      data: {
        title: plan.working_title,
        summary: `A practical guide to ${plan.primary_keyword} for ${plan.target_audience}, covering key applications, implementation challenges, and actionable next steps.`,
        article,
        primary_keyword: plan.primary_keyword,
        secondary_keywords: plan.secondary_keywords,
        source_ids: params.sources.map(s => s.id),
        key_claims: [
          {
            claim: `${plan.primary_keyword} tools can reduce screening time by 40-60%`,
            source_ids: params.sources.slice(0, 1).map(s => s.id),
            supported: params.sources.length > 0,
            flag: params.sources.length === 0,
          },
          {
            claim: "AI amplifies rather than replaces human expertise",
            source_ids: [],
            supported: true,
            flag: false,
          },
        ],
        word_count: wordCount,
        reading_time_minutes: Math.ceil(wordCount / 200),
        change_summary: isRevision ? `Revised based on feedback: ${params.revisionInstructions}` : null,
      },
      usage: mockUsage(2000, 1500),
    };
  }

  async evaluateDraft(params: {
    draft: ArticleDraftOutput;
    sources: { id: string; url: string; summary: string; title: string | null }[];
    targetAudience: string;
    contentGoal: string | null;
    primaryKeyword: string;
    requestedChannels: string[];
  }): Promise<AiResult<EvaluationOutput>> {
    await delay(900);

    // Simulate a realistic but imperfect first evaluation that may require revision
    const hasGoodSources = params.sources.length >= 2;
    const hasKeyword = params.draft.article.toLowerCase().includes(params.primaryKeyword.toLowerCase());
    const wordCount = params.draft.word_count;
    const isLongEnough = wordCount >= 400;

    const sourceGrounding = hasGoodSources ? 7.5 : 5.0;
    const seoFit = hasKeyword ? 8.0 : 5.5;
    const completeness = isLongEnough ? 8.0 : 6.0;
    const overall = (sourceGrounding + seoFit + completeness + 8.0 + 7.5 + 7.5 + 8.0 + 8.0 + 7.5) / 9;

    const status: "PASS" | "REVISE" | "REJECT" =
      overall >= 7.5 ? "PASS" : overall >= 5.5 ? "REVISE" : "REJECT";

    const unsupportedClaims = hasGoodSources
      ? []
      : [
          {
            claim: "AI tools reduce screening time by 40-60%",
            location: "Key Applications section, paragraph 1",
            recommendation: "Add a citation or rephrase as an industry estimate. No reviewed source directly supports this specific figure.",
          },
        ];

    const weakSections = isLongEnough
      ? []
      : [
          {
            section: "How to Get Started",
            issue: "The section is brief and lacks specific, actionable detail for the target audience.",
            recommendation: "Expand with 2-3 concrete examples relevant to the audience's specific context.",
          },
        ];

    return {
      data: {
        overall_status: status,
        scores: {
          topic_relevance: 8.5,
          source_grounding: sourceGrounding,
          factual_consistency: hasGoodSources ? 8.0 : 6.5,
          audience_fit: 8.0,
          tone: 7.5,
          seo_fit: seoFit,
          channel_fit: 7.5,
          clarity: 8.0,
          completeness,
          overall: parseFloat(overall.toFixed(1)),
        },
        unsupported_claims: unsupportedClaims,
        weak_sections: weakSections,
        recommended_changes: [
          ...(hasGoodSources ? [] : ["Add citations for specific statistical claims"]),
          ...(hasKeyword ? [] : [`Include primary keyword "${params.primaryKeyword}" in the introduction`]),
          ...(isLongEnough ? [] : ["Expand the 'How to Get Started' section with more specific guidance"]),
          "Consider adding a brief case study or example",
        ],
        summary: status === "PASS"
          ? `The draft is well-structured and appropriate for ${params.targetAudience}. Source grounding is ${hasGoodSources ? "adequate" : "needs improvement"}. Minor improvements recommended before publication.`
          : `The draft requires revision before review. Key issues: ${[
              !hasGoodSources ? "insufficient source grounding" : null,
              !hasKeyword ? "primary keyword missing from introduction" : null,
              !isLongEnough ? "content too brief for the topic" : null,
            ]
              .filter(Boolean)
              .join(", ")}.`,
      },
      usage: mockUsage(1800, 600),
    };
  }

  async generateLinkedIn(params: {
    article: string;
    title: string;
    summary: string;
    targetAudience: string;
    sources: { url: string; title: string | null }[];
  }): Promise<AiResult<LinkedInOutput>> {
    await delay(600);

    return {
      data: {
        content: `🤔 Most ${params.targetAudience} are still figuring out how to make AI work for them.

Here's what the ones getting it right have in common:

They don't try to automate everything at once.

Instead, they:
→ Start with one high-volume, repetitive task
→ Measure the impact rigorously
→ Expand only when they have evidence

The result? Less friction, better adoption, and real ROI.

${params.summary}

The full breakdown is in the article below. What's your experience been?`,
        hashtags: ["AI", "FutureOfWork", "Productivity"],
        cta: "Read the full guide in the comments →",
        image_suggestion: "Carousel showing the 5-step implementation framework from the article",
      },
      usage: mockUsage(800, 400),
    };
  }

  async generateX(params: {
    article: string;
    title: string;
    summary: string;
  }): Promise<AiResult<XOutput>> {
    await delay(400);

    return {
      data: {
        content: `The ${params.title.split(":")[0]} playbook nobody talks about:

Most teams jump straight to automation.

The ones winning start with measurement.

You can't improve what you haven't tracked.

Full breakdown: [link]`,
        hashtags: ["AI", "Productivity"],
      },
      usage: mockUsage(600, 200),
    };
  }

  async generateNewsletter(params: {
    article: string;
    title: string;
    summary: string;
    targetAudience: string;
  }): Promise<AiResult<NewsletterOutput>> {
    await delay(700);

    return {
      data: {
        subject_line: `${params.title} — What You Need to Know`,
        content: `Hi there,

This week we're covering something that's generating a lot of questions from ${params.targetAudience}: how to actually get value from AI tools without getting burned by hype.

**What we cover this week:**

${params.summary}

Here's the short version of what actually works based on what we're seeing from teams in the field:

Start with a single, measurable use case. Don't try to automate everything at once — pick the highest-volume, most repetitive workflow your team does and test AI there first. The teams seeing real results aren't the ones with the most sophisticated tools. They're the ones with the most disciplined approach to measurement and iteration.

Set success criteria before you begin. Seriously — write down what "working" means before you touch any tool. Time saved? Cost reduced? Error rate down? Pick a number and track it.

Involve the people doing the work in the rollout. AI adoption fails most often not because of the technology, but because practitioners were cut out of the decision. The people closest to the workflow know where the friction is.

Plan for iteration, not a one-time deployment. Every team we've spoken to who saw strong ROI treated their AI rollout as an ongoing programme, not a project with an end date.

**The bottom line:** AI augments human judgment — it doesn't replace it. The most effective teams combine strong domain expertise with powerful AI capabilities.

**Read the full guide here:** [Insert link]

---

What's one AI tool or workflow your team has actually found useful? Hit reply — I read every response.

Until next week,
The Koya Content Team`,
        cta: "Read the full guide →",
      },
      usage: mockUsage(900, 500),
    };
  }

  async summarizeSource(params: {
    url: string;
    content: string;
    contentIdea: string;
    targetAudience: string;
  }): Promise<AiResult<SourceSummaryOutput>> {
    await delay(500);

    const isRelevant = params.content.length > 100;

    return {
      data: {
        summary: `This source from ${new URL(params.url).hostname} covers ${params.contentIdea} with a focus on practical applications and real-world examples. It discusses implementation challenges, adoption strategies, and emerging trends relevant to ${params.targetAudience}.`,
        key_points: [
          `${params.contentIdea} adoption is accelerating across industries`,
          "Early adopters report measurable productivity improvements",
          "Change management is a critical success factor",
          "ROI timelines vary by organization size and use case",
        ],
        relevance_score: isRelevant ? 7.5 : 3.0,
        selection_reason: isRelevant
          ? `Contains directly relevant evidence about ${params.contentIdea} with actionable insights for ${params.targetAudience}.`
          : "Source content is too sparse to provide meaningful grounding.",
        is_relevant: isRelevant,
      },
      usage: mockUsage(600, 300),
    };
  }

  async isAvailable(): Promise<boolean> {
    return true;
  }
}
