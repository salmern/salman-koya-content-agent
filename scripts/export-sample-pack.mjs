/**
 * Sample Content Pack Exporter
 *
 * Exports a complete content piece as a structured document showing
 * the full pipeline: input → sources → article → evaluation → channels.
 *
 * Usage:
 *   node scripts/export-sample-pack.mjs <content_request_id>
 *
 * Or use the demo pipeline to generate one automatically:
 *   node scripts/export-sample-pack.mjs --demo
 */

import { createClient } from "@supabase/supabase-js";
import { readFileSync, writeFileSync } from "fs";
import { resolve, dirname } from "path";
import { fileURLToPath } from "url";

const __dirname = dirname(fileURLToPath(import.meta.url));

function loadEnv() {
  try {
    const envPath = resolve(__dirname, "../.env.local");
    const lines = readFileSync(envPath, "utf-8").split("\n");
    for (const line of lines) {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith("#")) continue;
      const [key, ...rest] = trimmed.split("=");
      if (key && rest.length) process.env[key.trim()] = rest.join("=").trim();
    }
  } catch {
    console.error("Could not load .env.local");
  }
}

loadEnv();

const contentRequestId = process.argv[2];
const isDemo = contentRequestId === "--demo";

if (!contentRequestId || (!isDemo && !contentRequestId.match(/^[0-9a-f-]{36}$/))) {
  console.error(
    "Usage: node scripts/export-sample-pack.mjs <content_request_id>\n" +
    "       node scripts/export-sample-pack.mjs --demo"
  );
  process.exit(1);
}

const admin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY,
  { auth: { autoRefreshToken: false, persistSession: false } }
);

async function exportPack(id) {
  // Fetch all related data
  const [
    { data: request },
    { data: sources },
    { data: drafts },
    { data: evaluations },
    { data: reviews },
    { data: channels },
  ] = await Promise.all([
    admin.from("content_requests").select("*").eq("id", id).single(),
    admin.from("content_sources").select("*").eq("content_request_id", id).eq("selected", true),
    admin.from("content_drafts").select("*").eq("content_request_id", id).order("version_number"),
    admin.from("draft_evaluations").select("*").eq("content_request_id", id).order("created_at"),
    admin.from("human_reviews").select("*").eq("content_request_id", id).order("created_at"),
    admin.from("channel_content").select("*").eq("content_request_id", id),
  ]);

  if (!request) {
    console.error(`Content request ${id} not found.`);
    process.exit(1);
  }

  const latestDraft = drafts?.[drafts.length - 1];
  const latestEval = evaluations?.[evaluations.length - 1];
  const li = channels?.find((c) => c.channel === "linkedin");
  const xp = channels?.find((c) => c.channel === "x");
  const nl = channels?.find((c) => c.channel === "newsletter");

  const lines = [];
  const h = (n, t) => lines.push(`${"#".repeat(n)} ${t}\n`);
  const p = (...parts) => lines.push(parts.join("") + "\n");
  const hr = () => lines.push("---\n");

  h(1, "Content Sample Pack");
  p(`**Generated:** ${new Date().toISOString()}`);
  p(`**Content ID:** ${id}`);
  hr();

  // INPUT
  h(2, "INPUT");
  p(`**Content Idea:** ${request.content_idea}`);
  p(`**Target Audience:** ${request.target_audience}`);
  if (request.primary_keyword) p(`**Primary Keyword:** ${request.primary_keyword}`);
  if (request.content_goal) p(`**Content Goal:** ${request.content_goal}`);
  if (request.tone) p(`**Tone:** ${request.tone}`);
  if (request.source_url) p(`**Source URL:** ${request.source_url}`);
  p(`**Status:** ${request.status}`);
  hr();

  // SOURCES
  h(2, "RESEARCH SOURCES");
  if (sources?.length) {
    sources.forEach((s, i) => {
      p(`**${i + 1}. ${s.title ?? s.url}**`);
      p(`URL: ${s.url}`);
      if (s.relevance_score) p(`Relevance: ${Number(s.relevance_score).toFixed(1)}/10`);
      if (s.summary) p(`Summary: ${s.summary}`);
      if (s.selection_reason) p(`Why selected: ${s.selection_reason}`);
      p("");
    });
  } else {
    p("_No sources retrieved._");
  }
  hr();

  // ARTICLE
  h(2, "ARTICLE");
  if (latestDraft) {
    p(`**Version:** ${latestDraft.version_number}`);
    p(`**Word count:** ${latestDraft.word_count}`);
    p(`**Reading time:** ~${latestDraft.reading_time_minutes} min\n`);
    p(latestDraft.article);
  } else {
    p("_No draft generated yet._");
  }
  hr();

  // EVALUATION
  h(2, "EVALUATION");
  if (latestEval) {
    const s = latestEval.scores;
    p(`**Overall Status:** ${latestEval.overall_status}`);
    p(`**Overall Score:** ${Number(s.overall).toFixed(1)}/10\n`);
    h(3, "Dimension Scores");
    Object.entries(s)
      .filter(([k]) => k !== "overall")
      .forEach(([k, v]) => p(`- ${k.replace(/_/g, " ")}: ${Number(v).toFixed(1)}/10`));
    p("");
    p(`**Summary:** ${latestEval.summary}`);
    if (latestEval.unsupported_claims?.length) {
      h(3, "Unsupported Claims");
      latestEval.unsupported_claims.forEach((c) => {
        p(`- **Claim:** "${c.claim}"`);
        p(`  **Location:** ${c.location}`);
        p(`  **Recommendation:** ${c.recommendation}`);
        p("");
      });
    }
  } else {
    p("_Not evaluated yet._");
  }
  hr();

  // REVISION HISTORY
  h(2, "REVISION HISTORY");
  if (drafts?.length > 1) {
    drafts.forEach((d) => {
      p(`**v${d.version_number}** (${d.created_by}) — ${d.created_at}`);
      if (d.change_summary) p(`Changes: ${d.change_summary}`);
      p(`Word count: ${d.word_count}`);
      p("");
    });
  } else {
    p("_Single version — no revisions._");
  }

  // Human reviews
  if (reviews?.length) {
    h(3, "Human Review Decisions");
    reviews.forEach((r) => {
      p(`**${r.decision.toUpperCase()}** by reviewer on ${r.created_at}`);
      if (r.feedback) p(`Feedback: ${r.feedback}`);
      p("");
    });
  }
  hr();

  // LINKEDIN
  h(2, "LINKEDIN");
  if (li) {
    p(li.content);
    if (li.hashtags?.length) p(`\nHashtags: ${li.hashtags.map((h) => `#${h}`).join(" ")}`);
    p(`\n*Character count: ${li.character_count} · Validation: ${li.validation_status}*`);
  } else {
    p("_Not generated yet._");
  }
  hr();

  // X
  h(2, "X (TWITTER)");
  if (xp) {
    p(xp.content);
    if (xp.hashtags?.length) p(`\nHashtags: ${xp.hashtags.map((h) => `#${h}`).join(" ")}`);
    p(`\n*Character count: ${xp.character_count} · Validation: ${xp.validation_status}*`);
  } else {
    p("_Not generated yet._");
  }
  hr();

  // NEWSLETTER
  h(2, "EMAIL NEWSLETTER");
  if (nl) {
    if (nl.subject_line) p(`**Subject:** ${nl.subject_line}\n`);
    p(nl.content);
    if (nl.cta) p(`\n**CTA:** ${nl.cta}`);
    p(`\n*Word count: ${nl.word_count} · Validation: ${nl.validation_status}*`);
  } else {
    p("_Not generated yet._");
  }
  hr();

  // SOURCES LIST
  h(2, "SOURCE LIST");
  if (sources?.length) {
    sources.forEach((s, i) => {
      p(`${i + 1}. ${s.title ?? "Untitled"}`);
      p(`   ${s.url}`);
      if (s.author) p(`   Author: ${s.author}`);
      if (s.published_at) p(`   Published: ${new Date(s.published_at).toLocaleDateString()}`);
      p("");
    });
  }

  const output = lines.join("\n");
  const filename = `sample-pack-${id.slice(0, 8)}-${Date.now()}.md`;
  const outPath = resolve(__dirname, "../", filename);
  writeFileSync(outPath, output, "utf-8");

  console.log(`✅  Sample pack exported to: ${filename}`);
  console.log(`    Article: ${latestDraft?.word_count ?? 0} words`);
  console.log(`    Sources: ${sources?.length ?? 0}`);
  console.log(`    Evaluation: ${latestEval?.overall_status ?? "none"}`);
  console.log(`    Channels: ${channels?.map((c) => c.channel).join(", ") || "none"}`);
}

// If --demo, find the first suitable request in the DB
if (isDemo) {
  const { data: requests } = await admin
    .from("content_requests")
    .select("id, status")
    .in("status", ["PUBLISHED", "READY_TO_SCHEDULE", "APPROVED"])
    .order("updated_at", { ascending: false })
    .limit(1);

  if (!requests?.length) {
    console.error("No published/approved content found. Run seed-demo.mjs first.");
    process.exit(1);
  }
  await exportPack(requests[0].id);
} else {
  await exportPack(contentRequestId);
}
