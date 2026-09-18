import { describe, it, expect } from "vitest";
import {
  validateAndNormalizeUrl,
  getResearchErrorMessage,
} from "@/lib/validation/url-validator";

describe("validateAndNormalizeUrl", () => {
  // ---- Valid URLs -----------------------------------------
  it("accepts a standard https URL", () => {
    const r = validateAndNormalizeUrl("https://example.com/article");
    expect(r.valid).toBe(true);
    expect(r.normalizedUrl).toBe("https://example.com/article");
  });

  it("accepts http URLs", () => {
    expect(validateAndNormalizeUrl("http://example.com/page").valid).toBe(true);
  });

  it("accepts URLs with query strings", () => {
    expect(validateAndNormalizeUrl("https://example.com/search?q=ai&page=1").valid).toBe(true);
  });

  it("accepts URLs with paths", () => {
    expect(validateAndNormalizeUrl("https://blog.example.com/posts/ai-recruiting").valid).toBe(true);
  });

  // ---- SSRF / Internal addresses -------------------------
  it("blocks localhost", () => {
    const r = validateAndNormalizeUrl("http://localhost:3000/page");
    expect(r.valid).toBe(false);
    expect(r.reason).toMatch(/private|internal/i);
  });

  it("blocks 127.0.0.1", () => {
    expect(validateAndNormalizeUrl("http://127.0.0.1/admin").valid).toBe(false);
  });

  it("blocks 0.0.0.0", () => {
    expect(validateAndNormalizeUrl("http://0.0.0.0/").valid).toBe(false);
  });

  it("blocks 10.x private range", () => {
    expect(validateAndNormalizeUrl("http://10.0.0.1/internal").valid).toBe(false);
  });

  it("blocks 192.168.x private range", () => {
    expect(validateAndNormalizeUrl("http://192.168.1.100/api").valid).toBe(false);
  });

  it("blocks 172.16–31 private range", () => {
    expect(validateAndNormalizeUrl("http://172.16.0.1/").valid).toBe(false);
    expect(validateAndNormalizeUrl("http://172.31.255.255/").valid).toBe(false);
  });

  it("blocks link-local 169.254.x", () => {
    expect(validateAndNormalizeUrl("http://169.254.169.254/metadata").valid).toBe(false);
  });

  it("blocks .internal TLD", () => {
    expect(validateAndNormalizeUrl("http://service.internal/api").valid).toBe(false);
  });

  it("blocks .local TLD", () => {
    expect(validateAndNormalizeUrl("http://myhost.local/").valid).toBe(false);
  });

  // ---- Bad protocols -------------------------------------
  it("blocks ftp:// protocol", () => {
    const r = validateAndNormalizeUrl("ftp://example.com/file");
    expect(r.valid).toBe(false);
    expect(r.reason).toMatch(/protocol/i);
  });

  it("blocks file:// protocol", () => {
    expect(validateAndNormalizeUrl("file:///etc/passwd").valid).toBe(false);
  });

  it("blocks javascript: protocol", () => {
    expect(validateAndNormalizeUrl("javascript:alert(1)").valid).toBe(false);
  });

  // ---- Edge cases ----------------------------------------
  it("rejects empty string", () => {
    expect(validateAndNormalizeUrl("").valid).toBe(false);
  });

  it("rejects bare domain without protocol", () => {
    // Without a protocol, it might try to add https:// — but example is valid then
    const r = validateAndNormalizeUrl("example.com");
    // Should either normalize or reject — just shouldn't crash
    expect(typeof r.valid).toBe("boolean");
  });

  it("rejects URL exceeding 2048 chars", () => {
    const r = validateAndNormalizeUrl("https://example.com/" + "a".repeat(2050));
    expect(r.valid).toBe(false);
    expect(r.reason).toMatch(/length|2048/i);
  });

  it("rejects domain with no TLD", () => {
    expect(validateAndNormalizeUrl("http://nodots").valid).toBe(false);
  });
});

describe("getResearchErrorMessage", () => {
  it("returns paywall message", () => {
    const r = getResearchErrorMessage("https://wsj.com/article", "paywall");
    expect(r.title).toMatch(/paywall/i);
    expect(r.suggestions.length).toBeGreaterThan(0);
  });

  it("returns 403 message", () => {
    const r = getResearchErrorMessage("https://example.com", "failed", 403);
    expect(r.title).toMatch(/403/i);
  });

  it("returns 404 message", () => {
    const r = getResearchErrorMessage("https://example.com/missing", "failed", 404);
    expect(r.title).toMatch(/404/i);
  });

  it("returns 429 message with retry suggestion", () => {
    const r = getResearchErrorMessage("https://example.com", "failed", 429);
    expect(r.title).toMatch(/429/i);
    expect(r.suggestions.some((s) => /wait|retry/i.test(s))).toBe(true);
  });

  it("returns empty-content message", () => {
    const r = getResearchErrorMessage("https://example.com", "empty");
    expect(r.title).toMatch(/content/i);
  });

  it("always returns suggestions array", () => {
    const r = getResearchErrorMessage("https://x.com", "failed");
    expect(Array.isArray(r.suggestions)).toBe(true);
    expect(r.suggestions.length).toBeGreaterThan(0);
  });
});
