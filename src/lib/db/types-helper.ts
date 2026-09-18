/**
 * Type helpers for Supabase query results.
 * Since the generated Database type doesn't always thread through the SSR client,
 * we cast results to our domain types at the service boundary.
 */

import type {
  ContentRequest,
  ContentSource,
  ContentDraft,
  DraftEvaluation,
  HumanReview,
  ContentPlan,
  ChannelContent,
  PublishingQueueItem,
  AuditLog,
  Profile,
  ResearchRun,
} from "@/types";

export type DbContentRequest = ContentRequest;
export type DbContentSource = ContentSource;
export type DbContentDraft = ContentDraft;
export type DbDraftEvaluation = DraftEvaluation;
export type DbHumanReview = HumanReview;
export type DbContentPlan = ContentPlan;
export type DbChannelContent = ChannelContent;
export type DbPublishingQueueItem = PublishingQueueItem;
export type DbAuditLog = AuditLog;
export type DbProfile = Profile;
export type DbResearchRun = ResearchRun;
