/**
 * Author / Sender Name Configuration
 *
 * Generated content (newsletters, articles, social posts) must never contain
 * invented or placeholder author or sender names. Any byline or sign-off must
 * use the exact brand/author name configured via CONTENT_AUTHOR_NAME. When no
 * name is configured, generated content must omit the sign-off entirely.
 */

const PLACEHOLDER_VALUE_PATTERNS: RegExp[] = [
  /^\[[^\]]*\]$/, // [Your Name], [Author Name], [Name]
  /^your\s+(name|brand|company|organization|sender)(\s+name)?(\s+here)?$/i,
  /^the\s+(name|brand|company|sender)$/i,
  /^(author|sender|publisher|brand|company|organization)\s+name$/i,
  /^insert\s+(your\s+)?(name|brand|company)(\s+here)?$/i,
  /^placeholder/i,
  /^name$/i,
];

/**
 * Read the configured brand/author name. Placeholder-looking values (e.g.
 * "Your Name", "[Name]") are treated as unset so they are never emitted as
 * a real sign-off.
 */
export function getConfiguredAuthorName(): string | null {
  const value = process.env.CONTENT_AUTHOR_NAME?.trim();
  if (!value) return null;
  const looksLikePlaceholder = PLACEHOLDER_VALUE_PATTERNS.some((re) => re.test(value));
  return looksLikePlaceholder ? null : value;
}

/**
 * Generic rule block injected into generation system prompts. Keeps the model
 * from inventing author names or emitting placeholder tokens.
 */
export function authorSystemRule(): string {
  return `AUTHOR / SENDER NAME RULES:
1. NEVER use placeholder author or sender names (e.g. "[Your Name]", "[Author Name]", "[Name]", "Your Name") in generated content.
2. Include an author byline or sender sign-off ONLY when the exact configured brand/author name is provided.
3. Never invent, guess, or fabricate a personal name, brand name, or signature.`;
}

/**
 * Newsletter-specific sign-off instruction: sign with the exact configured
 * name, or omit the sign-off entirely when none is configured.
 */
export function newsletterSignOffInstruction(): string {
  const author = getConfiguredAuthorName();
  if (author) {
    return `AUTHOR / SENDER SIGN-OFF:
The configured brand/author name is "${author}". Sign the newsletter using EXACTLY this name, e.g.:

Until next time,
${author}

Do not use any other name — no first names, initials, or invented aliases.`;
  }
  return `AUTHOR / SENDER SIGN-OFF:
No brand/author name is configured. Do NOT add a sign-off, byline, or invented sender name to the newsletter.`;
}

// Trailing-line placeholder signatures caught by the deterministic safety net
const PLACEHOLDER_SIGNATURE_PATTERN =
  /^(\s*[-*—]\s*)?(\[[^\]]+\]|(?:your|author|sender|publisher|brand|company|organization)(?:[\s-]+(?:name|brand|company|organization))+\b|insert\s+(?:your\s+)?(?:name|brand|company)(?:\s+here)?\b)$/i;

/**
 * Defensive post-processing for generated content. If the content ends with a
 * placeholder author/sender signature, it is replaced with the configured name
 * (when one exists) or removed entirely (when none is configured). Content
 * without a placeholder signature is returned unchanged.
 */
export function fixPlaceholderAuthorSignOff(
  content: string,
  authorName: string | null
): string {
  if (!content) return content;
  const author = authorName?.trim() || null;

  const lines = content.split("\n");
  let end = lines.length;
  while (end > 0 && lines[end - 1].trim() === "") end--;

  let consumed = 0;
  for (let i = end - 1; i >= 0; i--) {
    if (PLACEHOLDER_SIGNATURE_PATTERN.test(lines[i])) {
      consumed++;
    } else {
      break;
    }
  }

  if (consumed === 0) return content;

  const head = lines.slice(0, end - consumed);
  const tail = lines.slice(end);

  if (!author) {
    return head.concat(tail).join("\n").trimEnd();
  }

  const replacement = Array.from({ length: consumed }, () => author);
  return head.concat(replacement, tail).join("\n").trimEnd();
}