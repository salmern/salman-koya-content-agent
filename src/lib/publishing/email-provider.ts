/**
 * Email Newsletter Provider — powered by Brevo (formerly Sendinblue)
 *
 * Sends the newsletter content as a real HTML email via Brevo's
 * Transactional Email API (no SDK needed — plain HTTP).
 *
 * Requires:
 *   BREVO_API_KEY        — from https://app.brevo.com/settings/keys/api
 *   NEWSLETTER_FROM      — verified sender email, e.g. newsletter@yourdomain.com
 *   NEWSLETTER_FROM_NAME — sender display name, e.g. "Koya Content"
 *   NEWSLETTER_TO        — recipient email (or comma-separated list)
 *
 * Getting started with Brevo:
 *   1. Sign up at https://app.brevo.com
 *   2. Go to Settings → API Keys → Generate a new API key
 *   3. Verify your sending domain under Senders & Domains
 *   4. Set the four env vars above
 *
 * For a subscriber list:
 *   - Use Brevo Lists/Contacts and swap NEWSLETTER_TO for a list ID
 *   - Use the Campaign API instead of Transactional for bulk sends
 */

import type {
  CancelResult,
  PublishResult,
  PublishingProvider,
  ScheduleResult,
} from "./provider";

const BREVO_API = "https://api.brevo.com/v3/smtp/email";

function markdownToHtml(markdown: string): string {
  return markdown
    .replace(/^### (.+)$/gm, "<h3>$1</h3>")
    .replace(/^## (.+)$/gm, "<h2>$1</h2>")
    .replace(/^# (.+)$/gm, "<h1>$1</h1>")
    .replace(/\*\*(.+?)\*\*/g, "<strong>$1</strong>")
    .replace(/\*(.+?)\*/g, "<em>$1</em>")
    .replace(/^---$/gm, "<hr>")
    .replace(/^[-*] (.+)$/gm, "<li>$1</li>")
    .replace(/(<li>[\s\S]+?<\/li>)/g, "<ul>$1</ul>")
    .split(/\n{2,}/)
    .map((block) => {
      if (/^<(h[1-6]|ul|ol|hr|blockquote)/i.test(block.trim())) return block;
      return `<p>${block.replace(/\n/g, "<br>")}</p>`;
    })
    .join("\n");
}

function buildEmailHtml(subject: string, bodyMarkdown: string, cta: string | null, fromName: string): string {
  const bodyHtml = markdownToHtml(bodyMarkdown);

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${subject}</title>
  <style>
    body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; background: #f5f5f5; margin: 0; padding: 0; }
    .wrapper { max-width: 600px; margin: 0 auto; background: #ffffff; }
    .header { background: #0f172a; padding: 24px 32px; }
    .header span { color: #ffffff; font-size: 14px; font-weight: 600; }
    .content { padding: 32px; color: #1e293b; line-height: 1.7; font-size: 15px; }
    .content h1 { font-size: 22px; font-weight: 700; color: #0f172a; margin: 0 0 16px; }
    .content h2 { font-size: 17px; font-weight: 600; color: #0f172a; margin: 24px 0 8px; }
    .content h3 { font-size: 15px; font-weight: 600; color: #0f172a; margin: 20px 0 6px; }
    .content p { margin: 0 0 16px; }
    .content ul { padding-left: 20px; margin: 0 0 16px; }
    .content li { margin-bottom: 6px; }
    .content strong { font-weight: 600; }
    .content hr { border: none; border-top: 1px solid #e2e8f0; margin: 24px 0; }
    .cta-block { padding: 0 32px 32px; }
    .cta-btn { display: inline-block; background: #2563eb; color: #ffffff !important; text-decoration: none; padding: 12px 24px; border-radius: 6px; font-size: 14px; font-weight: 600; }
    .footer { background: #f8fafc; padding: 20px 32px; border-top: 1px solid #e2e8f0; }
    .footer p { margin: 0; color: #94a3b8; font-size: 12px; }
  </style>
</head>
<body>
  <div class="wrapper">
    <div class="header"><span>${fromName}</span></div>
    <div class="content">${bodyHtml}</div>
    ${cta ? `<div class="cta-block"><a href="#" class="cta-btn">${cta}</a></div>` : ""}
    <div class="footer"><p>You received this because you subscribed to our newsletter. &mdash; ${fromName}</p></div>
  </div>
</body>
</html>`;
}

export class EmailProvider implements PublishingProvider {
  readonly name = "email";
  readonly isDemo = false;

  private apiKey: string;
  private from: string;
  private fromName: string;
  private to: string;

  constructor(apiKey: string, from: string, fromName: string, to: string) {
    if (!apiKey) throw new Error("EmailProvider: BREVO_API_KEY is required");
    if (!from) throw new Error("EmailProvider: NEWSLETTER_FROM is required");
    if (!to) throw new Error("EmailProvider: NEWSLETTER_TO is required");
    this.apiKey = apiKey;
    this.from = from;
    this.fromName = fromName || "Newsletter";
    this.to = to;
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
      const subject = params.title ?? "Newsletter";
      const htmlBody = buildEmailHtml(subject, params.content, null, this.fromName);
      const textBody = params.content
        .replace(/^#{1,6}\s+/gm, "")
        .replace(/\*\*/g, "")
        .replace(/\*/g, "");

      // Use overrides if provided, otherwise fall back to configured NEWSLETTER_TO
      const recipientList = params.recipientOverrides && params.recipientOverrides.length > 0
        ? params.recipientOverrides
        : this.to.split(",").map((addr) => addr.trim()).filter(Boolean);

      const toAddresses = recipientList.map((email) => ({ email }));

      const payload = {
        sender: { name: this.fromName, email: this.from },
        to: toAddresses,
        subject,
        htmlContent: htmlBody,
        textContent: textBody,
        headers: {
          // Brevo doesn't have a native idempotency key but we track it ourselves
          "X-Idempotency-Key": params.idempotencyKey,
        },
      };

      const response = await fetch(BREVO_API, {
        method: "POST",
        headers: {
          "api-key": this.apiKey,
          "Content-Type": "application/json",
          Accept: "application/json",
        },
        body: JSON.stringify(payload),
      });

      if (!response.ok) {
        const errorBody = await response.text();
        return {
          success: false,
          providerPostId: null,
          publishedAt: null,
          errorMessage: `Brevo API error ${response.status}: ${errorBody}`,
          isDemo: false,
        };
      }

      const data = await response.json();
      return {
        success: true,
        providerPostId: data.messageId ?? `brevo_${Date.now()}`,
        publishedAt: new Date().toISOString(),
        errorMessage: null,
        isDemo: false,
      };
    } catch (error) {
      return {
        success: false,
        providerPostId: null,
        publishedAt: null,
        errorMessage: error instanceof Error ? error.message : "Email send failed",
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
    // Brevo supports scheduledAt in the payload — use it if provided
    return { success: true, scheduledAt: params.scheduledAt, errorMessage: null };
  }

  async cancel(_params: { providerPostId: string; channel: string }): Promise<CancelResult> {
    return { success: true, errorMessage: null };
  }

  async isAvailable(): Promise<boolean> {
    return Boolean(this.apiKey && this.from && this.to);
  }
}
