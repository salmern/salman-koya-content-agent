/**
 * Real Publishing Provider (Router)
 *
 * Routes each publish call to the correct platform provider based on channel.
 * Falls back to the mock provider for any channel that is not configured.
 *
 * This is what gets returned by getPublishingProvider() when
 * PUBLISHING_PROVIDER=real is set.
 */

import type {
  CancelResult,
  PublishResult,
  PublishingProvider,
  ScheduleResult,
} from "./provider";
import { MockPublishingProvider } from "./mock-provider";

export class RealPublishingProvider implements PublishingProvider {
  readonly name = "real";
  readonly isDemo = false;

  private providers: Record<string, PublishingProvider> = {};
  private fallback = new MockPublishingProvider();

  registerChannel(channel: string, provider: PublishingProvider): void {
    this.providers[channel] = provider;
  }

  private getProvider(channel: string): PublishingProvider {
    return this.providers[channel] ?? this.fallback;
  }

  async publish(params: {
    channel: string;
    content: string;
    title: string | null;
    hashtags: string[];
    idempotencyKey: string;
    recipientOverrides?: string[];
  }): Promise<PublishResult> {
    const provider = this.getProvider(params.channel);
    const result = await provider.publish(params);

    // Tag as demo if fallback was used
    if (provider === this.fallback) {
      return { ...result, isDemo: true };
    }
    return result;
  }

  async schedule(params: {
    channel: string;
    content: string;
    title: string | null;
    hashtags: string[];
    scheduledAt: string;
    idempotencyKey: string;
  }): Promise<ScheduleResult> {
    return this.getProvider(params.channel).schedule(params);
  }

  async cancel(params: {
    providerPostId: string;
    channel: string;
  }): Promise<CancelResult> {
    return this.getProvider(params.channel).cancel(params);
  }

  async isAvailable(): Promise<boolean> {
    return true;
  }
}
