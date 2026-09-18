import { describe, it, expect } from "vitest";
import { CreateContentRequestSchema, SourceUrlSchema } from "@/schemas/content-request";

describe("CreateContentRequestSchema", () => {
  const validInput = {
    content_idea: "How AI is changing recruitment practices",
    target_audience: "HR managers and recruitment teams",
    primary_keyword: "AI recruitment",
    content_goal: "Educate HR teams",
    source_url: "https://example.com/article",
    tone: "professional" as const,
    requested_channels: ["article", "linkedin"] as ("article" | "linkedin")[],
    additional_instructions: null,
    supporting_material: null,
  };

  it("passes with all valid fields", () => {
    const result = CreateContentRequestSchema.safeParse(validInput);
    expect(result.success).toBe(true);
  });

  it("passes with only required fields", () => {
    const result = CreateContentRequestSchema.safeParse({
      content_idea: "AI in healthcare",
      target_audience: "Hospital administrators",
      requested_channels: ["article"],
    });
    expect(result.success).toBe(true);
  });

  it("fails when content_idea is too short", () => {
    const result = CreateContentRequestSchema.safeParse({
      ...validInput,
      content_idea: "AI",
    });
    expect(result.success).toBe(false);
  });

  it("fails when target_audience is missing", () => {
    const result = CreateContentRequestSchema.safeParse({
      ...validInput,
      target_audience: "",
    });
    expect(result.success).toBe(false);
  });

  it("fails when source_url is not a valid URL", () => {
    const result = CreateContentRequestSchema.safeParse({
      ...validInput,
      source_url: "not-a-url",
    });
    expect(result.success).toBe(false);
  });

  it("fails when source_url uses localhost", () => {
    const result = CreateContentRequestSchema.safeParse({
      ...validInput,
      source_url: "http://localhost:3000/page",
    });
    expect(result.success).toBe(false);
  });

  it("passes with null source_url", () => {
    const result = CreateContentRequestSchema.safeParse({
      ...validInput,
      source_url: null,
    });
    expect(result.success).toBe(true);
  });

  it("fails when no channels are selected", () => {
    const result = CreateContentRequestSchema.safeParse({
      ...validInput,
      requested_channels: [],
    });
    expect(result.success).toBe(false);
  });

  it("fails with invalid channel type", () => {
    const result = CreateContentRequestSchema.safeParse({
      ...validInput,
      requested_channels: ["instagram"],
    });
    expect(result.success).toBe(false);
  });
});

describe("SourceUrlSchema", () => {
  it("passes valid https URL", () => {
    expect(SourceUrlSchema.safeParse("https://example.com/article").success).toBe(true);
  });

  it("passes valid http URL", () => {
    expect(SourceUrlSchema.safeParse("http://example.com/article").success).toBe(true);
  });

  it("fails empty string", () => {
    expect(SourceUrlSchema.safeParse("").success).toBe(false);
  });

  it("fails localhost URL", () => {
    expect(SourceUrlSchema.safeParse("http://localhost:3000").success).toBe(false);
  });

  it("fails 127.0.0.1 URL", () => {
    expect(SourceUrlSchema.safeParse("http://127.0.0.1/page").success).toBe(false);
  });

  it("fails URL without protocol", () => {
    expect(SourceUrlSchema.safeParse("example.com/page").success).toBe(false);
  });
});
