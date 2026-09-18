/**
 * Publishing Provider Factory
 *
 * Returns a provider based on the PUBLISHING_PROVIDER env var:
 *   mock  — no real API calls (default / development)
 *   real  — routes to LinkedIn, X, Resend based on channel and available credentials
 *
 * Each real channel is registered only if its credentials are present.
 * Channels without credentials fall back to the mock provider automatically.
 */

import type { PublishingProvider } from "./provider";
import { MockPublishingProvider } from "./mock-provider";
import { RealPublishingProvider } from "./real-provider";
import { LinkedInProvider } from "./linkedin-provider";
import { TwitterProvider } from "./twitter-provider";
import { EmailProvider } from "./email-provider";

export { type PublishingProvider } from "./provider";
export { MockPublishingProvider } from "./mock-provider";
export { LinkedInProvider } from "./linkedin-provider";
export { TwitterProvider } from "./twitter-provider";
export { EmailProvider } from "./email-provider";

let _cachedProvider: PublishingProvider | null = null;

export function getPublishingProvider(): PublishingProvider {
  if (_cachedProvider) return _cachedProvider;

  const providerType = process.env.PUBLISHING_PROVIDER ?? "mock";

  if (providerType !== "real") {
    _cachedProvider = new MockPublishingProvider();
    return _cachedProvider;
  }

  // Build the real router — register whichever channels have credentials
  const router = new RealPublishingProvider();
  const warnings: string[] = [];

  // ---- LinkedIn -------------------------------------------
  const liToken = process.env.LINKEDIN_ACCESS_TOKEN;
  const liUrn = process.env.LINKEDIN_AUTHOR_URN;

  if (liToken && liUrn && !liToken.startsWith("placeholder")) {
    try {
      router.registerChannel("linkedin", new LinkedInProvider(liToken, liUrn));
    } catch (e) {
      warnings.push(`LinkedIn: ${(e as Error).message}`);
    }
  } else {
    warnings.push(
      "LinkedIn: LINKEDIN_ACCESS_TOKEN or LINKEDIN_AUTHOR_URN not set — using mock"
    );
  }

  // ---- X (Twitter) ----------------------------------------
  const twApiKey = process.env.TWITTER_API_KEY;
  const twApiSecret = process.env.TWITTER_API_SECRET;
  const twToken = process.env.TWITTER_ACCESS_TOKEN;
  const twTokenSecret = process.env.TWITTER_ACCESS_TOKEN_SECRET;
  const twProviderOverride = process.env.TWITTER_PROVIDER;

  if (twProviderOverride === "mock") {
    warnings.push("X/Twitter: TWITTER_PROVIDER=mock — skipping real posting (Twitter Basic plan required)");
  } else if (
    twApiKey && twApiSecret && twToken && twTokenSecret &&
    !twApiKey.startsWith("placeholder")
  ) {
    try {
      router.registerChannel(
        "x",
        new TwitterProvider(twApiKey, twApiSecret, twToken, twTokenSecret)
      );
    } catch (e) {
      warnings.push(`X/Twitter: ${(e as Error).message}`);
    }
  } else {
    warnings.push("X/Twitter: credentials not set — using mock");
  }

  // ---- Email / Newsletter ---------------------------------
  const brevoKey = process.env.BREVO_API_KEY;
  const newsletterFrom = process.env.NEWSLETTER_FROM;
  const newsletterFromName = process.env.NEWSLETTER_FROM_NAME ?? "Newsletter";
  const newsletterTo = process.env.NEWSLETTER_TO;

  if (
    brevoKey && newsletterFrom && newsletterTo &&
    !brevoKey.startsWith("placeholder")
  ) {
    try {
      router.registerChannel(
        "newsletter",
        new EmailProvider(brevoKey, newsletterFrom, newsletterFromName, newsletterTo)
      );
    } catch (e) {
      warnings.push(`Email: ${(e as Error).message}`);
    }
  } else {
    warnings.push(
      "Newsletter: BREVO_API_KEY / NEWSLETTER_FROM / NEWSLETTER_TO not set — using mock"
    );
  }

  if (warnings.length > 0) {
    console.warn("[PublishingProvider] Some channels using mock provider:", warnings);
  }

  _cachedProvider = router;
  return _cachedProvider;
}

/** Reset cached provider — useful in tests or when env changes */
export function resetPublishingProvider(): void {
  _cachedProvider = null;
}
