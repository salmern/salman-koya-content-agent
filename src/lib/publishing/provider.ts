/**
 * Publishing Provider Abstraction
 */

export interface PublishResult {
  success: boolean;
  providerPostId: string | null;
  publishedAt: string | null;
  errorMessage: string | null;
  isDemo: boolean;
}

export interface ScheduleResult {
  success: boolean;
  scheduledAt: string;
  errorMessage: string | null;
}

export interface CancelResult {
  success: boolean;
  errorMessage: string | null;
}

export interface PublishingProvider {
  readonly name: string;
  readonly isDemo: boolean;

  publish(params: {
    channel: string;
    content: string;
    title: string | null;
    hashtags: string[];
    idempotencyKey: string;
    recipientOverrides?: string[];
  }): Promise<PublishResult>;

  schedule(params: {
    channel: string;
    content: string;
    title: string | null;
    hashtags: string[];
    scheduledAt: string;
    idempotencyKey: string;
  }): Promise<ScheduleResult>;

  cancel(params: {
    providerPostId: string;
    channel: string;
  }): Promise<CancelResult>;

  isAvailable(): Promise<boolean>;
}
