/**
 * Mock Publishing Provider
 *
 * Simulates publishing without calling real platform APIs.
 * Always labelled as demo — never pretends content was actually published.
 */

import type {
  CancelResult,
  PublishResult,
  PublishingProvider,
  ScheduleResult,
} from "./provider";

export class MockPublishingProvider implements PublishingProvider {
  readonly name = "mock";
  readonly isDemo = true;

  async publish(params: {
    channel: string;
    content: string;
    title: string | null;
    hashtags: string[];
    idempotencyKey: string;
    recipientOverrides?: string[];
  }): Promise<PublishResult> {
    // Simulate network latency
    await new Promise((r) => setTimeout(r, 800 + Math.random() * 400));

    // Simulate occasional failure for realistic testing
    if (params.idempotencyKey.includes("fail")) {
      return {
        success: false,
        providerPostId: null,
        publishedAt: null,
        errorMessage: "Simulated publishing failure for testing purposes.",
        isDemo: true,
      };
    }

    return {
      success: true,
      providerPostId: `demo_${params.channel}_${Date.now()}`,
      publishedAt: new Date().toISOString(),
      errorMessage: null,
      isDemo: true,
    };
  }

  async schedule(params: {
    channel: string;
    content: string;
    title: string | null;
    hashtags: string[];
    scheduledAt: string;
    idempotencyKey: string;
  }): Promise<ScheduleResult> {
    await new Promise((r) => setTimeout(r, 400));

    return {
      success: true,
      scheduledAt: params.scheduledAt,
      errorMessage: null,
    };
  }

  async cancel(_params: {
    providerPostId: string;
    channel: string;
  }): Promise<CancelResult> {
    await new Promise((r) => setTimeout(r, 200));
    return { success: true, errorMessage: null };
  }

  async isAvailable(): Promise<boolean> {
    return true;
  }
}
