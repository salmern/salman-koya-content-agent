/**
 * URL validation and sanitization.
 *
 * SECURITY: Prevents SSRF (Server-Side Request Forgery) by blocking
 * requests to internal/private network addresses.
 */

// Private/reserved IP ranges that must never be fetched
const BLOCKED_PATTERNS = [
  /^localhost$/i,
  /^127\.\d+\.\d+\.\d+$/,
  /^0\.0\.0\.0$/,
  /^10\.\d+\.\d+\.\d+$/,
  /^172\.(1[6-9]|2\d|3[01])\.\d+\.\d+$/,
  /^192\.168\.\d+\.\d+$/,
  /^169\.254\.\d+\.\d+$/, // link-local
  /^::1$/, // IPv6 loopback
  /^fc00:/i, // IPv6 private
  /^fe80:/i, // IPv6 link-local
  /\.internal$/i,
  /\.local$/i,
];

export interface UrlValidationResult {
  valid: boolean;
  reason?: string;
  normalizedUrl?: string;
}

export function validateAndNormalizeUrl(rawUrl: string): UrlValidationResult {
  if (!rawUrl || typeof rawUrl !== "string") {
    return { valid: false, reason: "URL is required" };
  }

  const trimmed = rawUrl.trim();

  if (trimmed.length === 0) {
    return { valid: false, reason: "URL cannot be empty" };
  }

  if (trimmed.length > 2048) {
    return { valid: false, reason: "URL exceeds maximum length of 2048 characters" };
  }

  let parsed: URL;
  try {
    parsed = new URL(trimmed);
  } catch {
    // Try adding https:// if no protocol
    try {
      parsed = new URL("https://" + trimmed);
    } catch {
      return { valid: false, reason: "URL is not valid" };
    }
  }

  // Only allow HTTP and HTTPS
  if (!["http:", "https:"].includes(parsed.protocol)) {
    return {
      valid: false,
      reason: `Protocol "${parsed.protocol}" is not allowed. Use http:// or https://`,
    };
  }

  const hostname = parsed.hostname;

  // Block internal/private addresses (SSRF protection)
  for (const pattern of BLOCKED_PATTERNS) {
    if (pattern.test(hostname)) {
      return {
        valid: false,
        reason: "Internal and private network URLs are not allowed",
      };
    }
  }

  // Must have a recognizable TLD
  if (!hostname.includes(".")) {
    return {
      valid: false,
      reason: "URL must point to a public domain",
    };
  }

  return {
    valid: true,
    normalizedUrl: parsed.toString(),
  };
}

/**
 * Get a user-friendly error message for research failures.
 */
export function getResearchErrorMessage(
  url: string,
  status: string,
  httpStatus?: number
): { title: string; description: string; suggestions: string[] } {
  const suggestions = [
    "Try another URL from the same site",
    "Paste the relevant text directly into Supporting Material",
    "Retry later if the site may be temporarily unavailable",
  ];

  switch (status) {
    case "paywall":
      return {
        title: "Content behind a paywall",
        description: `The article at ${url} requires a subscription and could not be retrieved.`,
        suggestions: [
          "Paste the article text directly into Supporting Material",
          "Use a different public source on the same topic",
        ],
      };
    case "empty":
      return {
        title: "No content found",
        description: `The page at ${url} was retrieved but contained no usable text.`,
        suggestions,
      };
    case "too_large":
      return {
        title: "Page too large",
        description: `The page at ${url} was very long. Only the first portion was used.`,
        suggestions: ["Try linking to a specific section or article instead of a homepage"],
      };
    case "failed":
      if (httpStatus === 403) {
        return {
          title: "Access denied (HTTP 403)",
          description: `The website returned a 403 Forbidden error for ${url}.`,
          suggestions,
        };
      }
      if (httpStatus === 404) {
        return {
          title: "Page not found (HTTP 404)",
          description: `The page at ${url} does not exist.`,
          suggestions: ["Check the URL for typos", ...suggestions.slice(1)],
        };
      }
      if (httpStatus === 429) {
        return {
          title: "Rate limited (HTTP 429)",
          description: `The server at ${url} is rate limiting requests.`,
          suggestions: ["Wait a few minutes and retry", ...suggestions.slice(1)],
        };
      }
      return {
        title: "Retrieval failed",
        description: `Could not retrieve content from ${url}.`,
        suggestions,
      };
    default:
      return {
        title: "Retrieval failed",
        description: `Could not retrieve content from ${url}.`,
        suggestions,
      };
  }
}
