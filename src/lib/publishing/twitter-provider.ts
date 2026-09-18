/**
 * X (Twitter) Publishing Provider
 *
 * Posts tweets or threads using the Twitter API v2.
 *
 * Requires:
 *   TWITTER_ACCESS_TOKEN        — OAuth 2.0 user access token
 *   TWITTER_ACCESS_TOKEN_SECRET — OAuth 1.0a token secret (needed for v1.1 compat)
 *   TWITTER_API_KEY             — App API key (consumer key)
 *   TWITTER_API_SECRET          — App API secret (consumer secret)
 *
 * Getting credentials:
 *   1. Create a project at https://developer.twitter.com/
 *   2. Set App permissions to "Read and Write"
 *   3. Generate "Access Token and Secret" for your own account
 *      under Keys and Tokens → Authentication Tokens
 *
 * Thread format:
 *   If content contains "---" separators, each part becomes a separate tweet
 *   in a threaded reply chain.
 */

import type {
  CancelResult,
  PublishResult,
  PublishingProvider,
  ScheduleResult,
} from "./provider";

export class TwitterProvider implements PublishingProvider {
  readonly name = "x";
  readonly isDemo = false;

  private apiKey: string;
  private apiSecret: string;
  private accessToken: string;
  private accessTokenSecret: string;

  constructor(
    apiKey: string,
    apiSecret: string,
    accessToken: string,
    accessTokenSecret: string
  ) {
    if (!apiKey || !apiSecret || !accessToken || !accessTokenSecret) {
      throw new Error("TwitterProvider: all four credential env vars are required");
    }
    this.apiKey = apiKey;
    this.apiSecret = apiSecret;
    this.accessToken = accessToken;
    this.accessTokenSecret = accessTokenSecret;
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
      const { TwitterApi } = await import("twitter-api-v2");

      const client = new TwitterApi({
        appKey: this.apiKey,
        appSecret: this.apiSecret,
        accessToken: this.accessToken,
        accessSecret: this.accessTokenSecret,
      });
      const rwClient = client.readWrite;

      // Detect thread format (parts separated by "---" on its own line)
      const THREAD_SEP = /^---$/m;
      const isThread = THREAD_SEP.test(params.content);

      if (isThread) {
        const parts = params.content
          .split(/\n---\n/)
          .map((p) => p.trim())
          .filter(Boolean);

        if (parts.length === 0) {
          return {
            success: false,
            providerPostId: null,
            publishedAt: null,
            errorMessage: "Thread content is empty after splitting",
            isDemo: false,
          };
        }

        // Post first tweet, then reply to it for each subsequent part
        const firstTweet = await rwClient.v2.tweet(parts[0]);
        let lastTweetId = firstTweet.data.id;

        for (let i = 1; i < parts.length; i++) {
          const reply = await rwClient.v2.tweet(parts[i], {
            reply: { in_reply_to_tweet_id: lastTweetId },
          });
          lastTweetId = reply.data.id;
        }

        return {
          success: true,
          providerPostId: firstTweet.data.id,
          publishedAt: new Date().toISOString(),
          errorMessage: null,
          isDemo: false,
        };
      }

      // Single tweet
      // Append hashtags if content doesn't already contain them
      const existingHashtags = (params.content.match(/#\w+/g) ?? []).length;
      let tweetText = params.content;

      if (existingHashtags === 0 && params.hashtags.length > 0) {
        const tags = params.hashtags
          .slice(0, 2) // X recommends max 2 hashtags
          .map((h) => (h.startsWith("#") ? h : `#${h}`))
          .join(" ");
        tweetText = `${tweetText}\n\n${tags}`;
      }

      // Truncate to 280 chars if somehow over limit
      if (tweetText.length > 280) {
        tweetText = tweetText.slice(0, 277) + "…";
      }

      const tweet = await rwClient.v2.tweet(tweetText);

      return {
        success: true,
        providerPostId: tweet.data.id,
        publishedAt: new Date().toISOString(),
        errorMessage: null,
        isDemo: false,
      };
    } catch (error) {
      const message = error instanceof Error ? error.message : "Unknown Twitter error";
      return {
        success: false,
        providerPostId: null,
        publishedAt: null,
        errorMessage: message,
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
    // Twitter API v2 Free/Basic tier does not support scheduled tweets via API.
    // Scheduling is handled by our DB + publishing queue — we publish at the right time.
    return {
      success: true,
      scheduledAt: params.scheduledAt,
      errorMessage: null,
    };
  }

  async cancel(params: { providerPostId: string; channel: string }): Promise<CancelResult> {
    try {
      const { TwitterApi } = await import("twitter-api-v2");
      const client = new TwitterApi({
        appKey: this.apiKey,
        appSecret: this.apiSecret,
        accessToken: this.accessToken,
        accessSecret: this.accessTokenSecret,
      });
      await client.readWrite.v2.deleteTweet(params.providerPostId);
      return { success: true, errorMessage: null };
    } catch (error) {
      return {
        success: false,
        errorMessage: error instanceof Error ? error.message : "Delete failed",
      };
    }
  }

  async isAvailable(): Promise<boolean> {
    try {
      const { TwitterApi } = await import("twitter-api-v2");
      const client = new TwitterApi({
        appKey: this.apiKey,
        appSecret: this.apiSecret,
        accessToken: this.accessToken,
        accessSecret: this.accessTokenSecret,
      });
      const me = await client.readWrite.v2.me();
      return Boolean(me.data.id);
    } catch {
      return false;
    }
  }
}
