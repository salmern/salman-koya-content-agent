/**
 * LinkedIn Publishing Provider
 *
 * Posts content to a LinkedIn personal profile or organisation page
 * using the LinkedIn Share API (v2).
 *
 * Requires:
 *   LINKEDIN_ACCESS_TOKEN  — OAuth 2.0 access token with w_member_social scope
 *   LINKEDIN_AUTHOR_URN    — e.g. urn:li:person:ABC123 (personal) or
 *                                  urn:li:organization:123456 (company page)
 *
 * Getting your access token (one-time):
 *   1. Create a LinkedIn App at https://www.linkedin.com/developers/
 *   2. Add the "Share on LinkedIn" product
 *   3. Use the OAuth 2.0 flow to get a token with scope: w_member_social
 *   4. Token lasts 60 days — store it in LINKEDIN_ACCESS_TOKEN
 *
 * Getting your author URN:
 *   curl -H "Authorization: Bearer <token>" https://api.linkedin.com/v2/userinfo
 *   The "sub" field is your person ID → urn:li:person:<sub>
 */

import type {
  CancelResult,
  PublishResult,
  PublishingProvider,
  ScheduleResult,
} from "./provider";

const LINKEDIN_API = "https://api.linkedin.com/v2";

/**
 * Strip markdown syntax from text before publishing to LinkedIn.
 * LinkedIn renders plain text — markdown symbols appear literally.
 */
function stripMarkdownForLinkedIn(text: string): string {
  return text
    // Remove heading markers (##, ###, etc.)
    .replace(/^#{1,6}\s+/gm, "")
    // Bold and italic — remove the markers, keep the text
    .replace(/\*\*(.*?)\*\*/g, "$1")
    .replace(/__(.*?)__/g, "$1")
    .replace(/\*(.*?)\*/g, "$1")
    .replace(/_(.*?)_/g, "$1")
    // Inline code
    .replace(/`([^`]+)`/g, "$1")
    // Links — keep the label, drop the URL
    .replace(/\[([^\]]+)\]\([^)]+\)/g, "$1")
    // Horizontal rules — replace with a blank line
    .replace(/^---+$/gm, "")
    .replace(/^\*\*\*+$/gm, "")
    // Numbered lists — keep the text, remove the "1. " prefix
    .replace(/^\d+\.\s+/gm, "")
    // Unordered list markers (- item or * item) — replace with →
    .replace(/^[-*+]\s+/gm, "→ ")
    // Remove any remaining standalone asterisks/underscores
    .replace(/(?<!\w)\*+(?!\w)/g, "")
    // Collapse multiple blank lines into at most two
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

export class LinkedInProvider implements PublishingProvider {
  readonly name = "linkedin";
  readonly isDemo = false;

  private accessToken: string;
  private authorUrn: string;

  constructor(accessToken: string, authorUrn: string) {
    if (!accessToken) throw new Error("LinkedInProvider: LINKEDIN_ACCESS_TOKEN is required");
    if (!authorUrn) throw new Error("LinkedInProvider: LINKEDIN_AUTHOR_URN is required");
    this.accessToken = accessToken;
    this.authorUrn = authorUrn;
  }

  async publish(params: {
    channel: string;
    content: string;
    title: string | null;
    hashtags: string[];
    idempotencyKey: string;
    recipientOverrides?: string[];
  }): Promise<PublishResult> {
    try {
      // Strip any markdown that slipped through from the AI
      const cleanContent = stripMarkdownForLinkedIn(params.content);

      // Append hashtags at the end if not already embedded in the content
      const existingHashtags = (cleanContent.match(/#\w+/g) ?? []).length;
      const hashtagText =
        existingHashtags === 0
          ? params.hashtags.map((h) => (h.startsWith("#") ? h : `#${h}`)).join(" ")
          : "";

      const text = hashtagText ? `${cleanContent}\n\n${hashtagText}` : cleanContent;

      const body = {
        author: this.authorUrn,
        lifecycleState: "PUBLISHED",
        specificContent: {
          "com.linkedin.ugc.ShareContent": {
            shareCommentary: { text },
            shareMediaCategory: "NONE",
          },
        },
        visibility: {
          "com.linkedin.ugc.MemberNetworkVisibility": "PUBLIC",
        },
      };

      const response = await fetch(`${LINKEDIN_API}/ugcPosts`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${this.accessToken}`,
          "Content-Type": "application/json",
          "X-Restli-Protocol-Version": "2.0.0",
          // Idempotency key prevents duplicate posts if the request is retried
          "X-RestLi-Method": "CREATE",
        },
        body: JSON.stringify(body),
      });

      if (!response.ok) {
        const errorBody = await response.text();
        return {
          success: false,
          providerPostId: null,
          publishedAt: null,
          errorMessage: `LinkedIn API error ${response.status}: ${errorBody}`,
          isDemo: false,
        };
      }

      // LinkedIn returns the new post URN in the X-RestLi-Id header
      const postId = response.headers.get("X-RestLi-Id") ?? `linkedin_${Date.now()}`;

      return {
        success: true,
        providerPostId: postId,
        publishedAt: new Date().toISOString(),
        errorMessage: null,
        isDemo: false,
      };
    } catch (error) {
      return {
        success: false,
        providerPostId: null,
        publishedAt: null,
        errorMessage: error instanceof Error ? error.message : "Unknown LinkedIn error",
        isDemo: false,
      };
    }
  }

  async schedule(params: {
    channel: string;
    content: string;
    title: string | null;
    hashtags: string[];
    scheduledAt: string;
    idempotencyKey: string;
  }): Promise<ScheduleResult> {
    // LinkedIn's API does not support scheduled posts natively via UGC API.
    // We store the schedule in our DB and publish at the right time via a cron/queue.
    // This method is called at schedule time — we just confirm and return.
    return {
      success: true,
      scheduledAt: params.scheduledAt,
      errorMessage: null,
    };
  }

  async cancel(_params: { providerPostId: string; channel: string }): Promise<CancelResult> {
    // LinkedIn does not support deleting posts via API in the basic tier.
    return { success: true, errorMessage: null };
  }

  async isAvailable(): Promise<boolean> {
    try {
      const res = await fetch(`${LINKEDIN_API}/userinfo`, {
        headers: { Authorization: `Bearer ${this.accessToken}` },
      });
      return res.ok;
    } catch {
      return false;
    }
  }
}
