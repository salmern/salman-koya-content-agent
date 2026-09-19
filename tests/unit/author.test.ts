/**
 * Author / Sender Name Rules
 *
 * Generated content must never contain invented or placeholder author/sender
 * names. Sign-offs use the exact configured CONTENT_AUTHOR_NAME when set, and
 * are omitted entirely when no name is configured.
 */

import { describe, it, expect, afterEach } from "vitest";
import {
  getConfiguredAuthorName,
  authorSystemRule,
  newsletterSignOffInstruction,
  fixPlaceholderAuthorSignOff,
} from "@/lib/ai/author";

const ORIGINAL = process.env.CONTENT_AUTHOR_NAME;

afterEach(() => {
  if (ORIGINAL === undefined) {
    delete process.env.CONTENT_AUTHOR_NAME;
  } else {
    process.env.CONTENT_AUTHOR_NAME = ORIGINAL;
  }
});

describe("getConfiguredAuthorName", () => {
  it("returns null when unset", () => {
    delete process.env.CONTENT_AUTHOR_NAME;
    expect(getConfiguredAuthorName()).toBeNull();
  });

  it("returns null for empty / whitespace values", () => {
    process.env.CONTENT_AUTHOR_NAME = "   ";
    expect(getConfiguredAuthorName()).toBeNull();
  });

  it.each([
    "[Your Name]",
    "[Author Name]",
    "[Name]",
    "Your Name",
    "Your Brand Name",
    "Author Name",
    "Insert your name here",
    "placeholder-author",
  ])("treats '%s' as a placeholder (returns null)", (value) => {
    process.env.CONTENT_AUTHOR_NAME = value;
    expect(getConfiguredAuthorName()).toBeNull();
  });

  it("returns a real configured name trimmed", () => {
    process.env.CONTENT_AUTHOR_NAME = "  Koya Content  ";
    expect(getConfiguredAuthorName()).toBe("Koya Content");
  });
});

describe("newsletterSignOffInstruction", () => {
  it("instructs to sign with the configured name when set", () => {
    process.env.CONTENT_AUTHOR_NAME = "Koya Content";
    const instruction = newsletterSignOffInstruction();
    expect(instruction).toContain('"Koya Content"');
    expect(instruction).toContain("Until next time,");
  });

  it("instructs to omit the sign-off when no name is configured", () => {
    delete process.env.CONTENT_AUTHOR_NAME;
    expect(newsletterSignOffInstruction()).toContain("No brand/author name is configured");
  });
});

describe("authorSystemRule", () => {
  it("forbids placeholders and invented names", () => {
    const rule = authorSystemRule();
    expect(rule).toMatch(/NEVER use placeholder/i);
    expect(rule).toContain("[Your Name]");
    expect(rule).toMatch(/never invent/i);
  });
});

describe("fixPlaceholderAuthorSignOff", () => {
  it("replaces a trailing placeholder sign-off with the configured name", () => {
    const content = "Great insights this week.\n\nUntil next time,\n[Your Name]";
    expect(fixPlaceholderAuthorSignOff(content, "Koya Content")).toBe(
      "Great insights this week.\n\nUntil next time,\nKoya Content"
    );
  });

  it("strips a trailing placeholder sign-off when no name is configured", () => {
    const content = "Great insights this week.\n\nUntil next time,\n[Your Name]";
    expect(fixPlaceholderAuthorSignOff(content, null)).toBe(
      "Great insights this week.\n\nUntil next time,"
    );
  });

  it("replaces bare placeholder names too", () => {
    const content = "See you soon,\nYour Name";
    expect(fixPlaceholderAuthorSignOff(content, "Koya Content")).toBe(
      "See you soon,\nKoya Content"
    );
  });

  it("leaves content without a placeholder signature unchanged", () => {
    const content = "Signing off,\nThe Koya Content Team";
    expect(fixPlaceholderAuthorSignOff(content, "Koya Content")).toBe(content);
    expect(fixPlaceholderAuthorSignOff(content, null)).toBe(content);
  });

  it("returns empty content unchanged", () => {
    expect(fixPlaceholderAuthorSignOff("", "Koya Content")).toBe("");
  });
});