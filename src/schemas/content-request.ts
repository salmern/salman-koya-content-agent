import { z } from "zod";

export const ContentToneSchema = z.enum([
  "professional",
  "conversational",
  "authoritative",
  "friendly",
  "educational",
  "persuasive",
]);

export const ContentChannelSchema = z.enum([
  "article",
  "linkedin",
  "x",
  "newsletter",
]);

const URL_PATTERN =
  /^https?:\/\/(www\.)?[-a-zA-Z0-9@:%._+~#=]{1,256}\.[a-zA-Z0-9()]{1,6}\b([-a-zA-Z0-9()@:%_+.~#?&/=]*)$/;

export const CreateContentRequestSchema = z.object({
  content_idea: z
    .string()
    .min(10, "Content idea must be at least 10 characters")
    .max(500, "Content idea must be under 500 characters")
    .trim(),

  target_audience: z
    .string()
    .min(5, "Target audience must be at least 5 characters")
    .max(300, "Target audience must be under 300 characters")
    .trim(),

  primary_keyword: z
    .string()
    .max(100, "Primary keyword must be under 100 characters")
    .trim()
    .optional()
    .nullable(),

  content_goal: z
    .string()
    .max(500, "Content goal must be under 500 characters")
    .trim()
    .optional()
    .nullable(),

  source_url: z
    .string()
    .trim()
    .refine(
      (val) => !val || URL_PATTERN.test(val),
      "Source URL must be a valid HTTP or HTTPS URL"
    )
    .refine(
      (val) => !val || !val.includes("localhost"),
      "Localhost URLs are not allowed as sources"
    )
    .optional()
    .nullable(),

  supporting_material: z
    .string()
    .max(50000, "Supporting material must be under 50,000 characters")
    .trim()
    .optional()
    .nullable(),

  tone: ContentToneSchema.optional().nullable(),

  additional_instructions: z
    .string()
    .max(1000, "Additional instructions must be under 1000 characters")
    .trim()
    .optional()
    .nullable(),

  requested_channels: z
    .array(ContentChannelSchema)
    .min(1, "Select at least one channel")
    .max(4, "Maximum 4 channels"),
});

export type CreateContentRequestInput = z.infer<typeof CreateContentRequestSchema>;

// ---- Review Action Schema -----------------------------------

export const ReviewActionSchema = z.discriminatedUnion("decision", [
  z.object({
    decision: z.literal("approved"),
    // feedback is genuinely optional on approval — accepts string, empty string, undefined, or null
    feedback: z.string().max(2000).optional().nullable().transform((v) => v ?? null),
  }),
  z.object({
    decision: z.literal("revision_requested"),
    feedback: z
      .string()
      .max(2000)
      .optional()
      .nullable()
      .transform((v) => v ?? null),
    revision_instructions: z
      .string()
      .min(10, "Please provide specific revision instructions")
      .max(2000),
  }),
  z.object({
    decision: z.literal("rejected"),
    feedback: z.string().min(10, "Please explain why this is being rejected").max(2000),
  }),
]);

export type ReviewActionInput = z.infer<typeof ReviewActionSchema>;

// ---- URL Validation -----------------------------------------

export const SourceUrlSchema = z
  .string()
  .trim()
  .min(1, "URL is required")
  .refine((val) => URL_PATTERN.test(val), "Must be a valid HTTP or HTTPS URL")
  .refine(
    (val) => val.startsWith("https://") || val.startsWith("http://"),
    "URL must start with http:// or https://"
  )
  .refine(
    (val) => !val.includes("localhost") && !val.match(/127\.\d+\.\d+\.\d+/),
    "Internal/localhost URLs are not allowed"
  );

// ---- Channel Validation Schemas -----------------------------

export const PublishScheduleSchema = z.object({
  channel_content_id: z.string().uuid("Invalid channel content ID"),
  scheduled_at: z
    .string()
    .datetime("Invalid datetime format")
    .refine(
      (val) => new Date(val) > new Date(),
      "Scheduled time must be in the future"
    )
    .optional()
    .nullable(),
});

export type PublishScheduleInput = z.infer<typeof PublishScheduleSchema>;
