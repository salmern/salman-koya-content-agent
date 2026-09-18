import type { Metadata } from "next";
import { createSupabaseServerClient } from "@/lib/db/client";
import { requireRole } from "@/lib/auth/session";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

import { AdminUsersTable } from "@/components/admin/admin-users-table";
import { AdminContentTable } from "@/components/admin/admin-content-table";

export const metadata: Metadata = { title: "Settings" };
export const dynamic = "force-dynamic";

export default async function SettingsPage() {
  const session = await requireRole(["admin"]);
  const supabase = await createSupabaseServerClient();

  const [{ data: rawProfiles }, { data: rawDeleted }] = await Promise.all([
    supabase.from("profiles").select("*").order("created_at", { ascending: false }),
    // Soft-deleted content — admins can see it
    supabase
      .from("content_requests")
      .select("id, content_idea, status, deleted_at, created_at, user_id")
      .not("deleted_at", "is", null)
      .order("deleted_at", { ascending: false })
      .limit(50),
  ]);

  const profiles = (rawProfiles as any[]) ?? [];
  const deletedContent = (rawDeleted as any[]) ?? [];

  const config = {
    aiProvider: process.env.AI_PROVIDER ?? "mock",
    researchProvider: process.env.RESEARCH_PROVIDER ?? "mock",
    publishingProvider: process.env.PUBLISHING_PROVIDER ?? "mock",
    maxRevisions: process.env.MAX_AUTO_REVISIONS ?? "3",
    separationOfDuties: process.env.ENFORCE_SEPARATION_OF_DUTIES !== "false",
    model: process.env.ANTHROPIC_MODEL ?? "claude-sonnet-4-5",
  };

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      <div>
        <h1 className="text-lg font-semibold text-foreground">Settings</h1>
        <p className="text-[13px] text-muted-foreground mt-0.5">System configuration and team management</p>
      </div>

      {/* System config */}
      <Card>
        <CardHeader><CardTitle>System Configuration</CardTitle></CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
            {[
              { label: "AI Provider", value: config.aiProvider },
              { label: "AI Model", value: config.model },
              { label: "Research Provider", value: config.researchProvider },
              { label: "Publishing Provider", value: config.publishingProvider },
              { label: "Max Auto-Revisions", value: config.maxRevisions },
              { label: "Separation of Duties", value: config.separationOfDuties ? "Enabled" : "Disabled" },
            ].map(({ label, value }) => (
              <div key={label} className="p-3 rounded-md bg-secondary border border-border">
                <p className="text-[11px] text-muted-foreground mb-0.5">{label}</p>
                <p className="text-[13px] font-medium text-foreground capitalize">{value}</p>
              </div>
            ))}
          </div>
          <p className="text-[11px] text-muted-foreground mt-3">
            Configuration is managed via environment variables. See <code className="font-mono text-[11px]">.env.example</code> for the full list.
          </p>
        </CardContent>
      </Card>

      {/* Publishing integrations */}
      <Card>
        <CardHeader><CardTitle>Publishing Integrations</CardTitle></CardHeader>
        <CardContent>
          <div className="space-y-3">
            {/* LinkedIn */}
            <div className="flex items-center justify-between p-3 rounded-md border border-border bg-secondary/30">
              <div>
                <p className="text-[13px] font-medium text-foreground">LinkedIn</p>
                <p className="text-[11px] text-muted-foreground mt-0.5">
                  {process.env.LINKEDIN_ACCESS_TOKEN && !process.env.LINKEDIN_ACCESS_TOKEN.includes("placeholder")
                    ? "✓ Access token configured"
                    : "Not connected — access token missing"}
                </p>
              </div>
              <a
                href="/auth/linkedin"
                className="flex items-center gap-1.5 h-7 px-3 rounded-md border border-border bg-background text-[12px] font-medium text-foreground hover:bg-secondary transition-colors"
              >
                {process.env.LINKEDIN_ACCESS_TOKEN && !process.env.LINKEDIN_ACCESS_TOKEN.includes("placeholder")
                  ? "Reconnect"
                  : "Connect LinkedIn"}
              </a>
            </div>

            {/* X */}
            <div className="flex items-center justify-between p-3 rounded-md border border-border bg-secondary/30">
              <div>
                <p className="text-[13px] font-medium text-foreground">X (Twitter)</p>
                <p className="text-[11px] text-muted-foreground mt-0.5">
                  {process.env.TWITTER_ACCESS_TOKEN && !process.env.TWITTER_ACCESS_TOKEN.includes("placeholder")
                    ? "✓ Access token configured"
                    : "Not connected — set TWITTER_* credentials in .env.local"}
                </p>
              </div>
              <a
                href="https://developer.twitter.com/en/portal/projects-and-apps"
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-1.5 h-7 px-3 rounded-md border border-border bg-background text-[12px] font-medium text-foreground hover:bg-secondary transition-colors"
              >
                Twitter Dev Portal ↗
              </a>
            </div>

            {/* Email */}
            <div className="flex items-center justify-between p-3 rounded-md border border-border bg-secondary/30">
              <div>
                <p className="text-[13px] font-medium text-foreground">Newsletter (Email via Brevo)</p>
                <p className="text-[11px] text-muted-foreground mt-0.5">
                  {process.env.BREVO_API_KEY && !process.env.BREVO_API_KEY.includes("placeholder")
                    ? `✓ Sending from ${process.env.NEWSLETTER_FROM ?? "unknown"}`
                    : "Not connected — set BREVO_API_KEY in .env.local"}
                </p>
              </div>
              <a
                href="https://app.brevo.com/settings/keys/api"
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-1.5 h-7 px-3 rounded-md border border-border bg-background text-[12px] font-medium text-foreground hover:bg-secondary transition-colors"
              >
                Brevo Dashboard ↗
              </a>
            </div>
          </div>
          <p className="text-[11px] text-muted-foreground mt-3">
            Set <code className="font-mono text-[11px]">PUBLISHING_PROVIDER=real</code> in .env.local to activate real publishing.
          </p>
        </CardContent>
      </Card>

      {/* User management */}
      <Card>
        <CardHeader>
          <CardTitle>Team Members</CardTitle>
          <p className="text-[12px] text-muted-foreground">{profiles.length} member{profiles.length !== 1 ? "s" : ""}</p>
        </CardHeader>
        <CardContent className="p-0">
          <AdminUsersTable profiles={profiles} currentUserId={session.userId} />
        </CardContent>
      </Card>

      {/* Deleted content */}
      {deletedContent.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Deleted Content</CardTitle>
            <p className="text-[12px] text-muted-foreground">Soft-deleted items — can be restored</p>
          </CardHeader>
          <CardContent className="p-0">
            <AdminContentTable content={deletedContent} />
          </CardContent>
        </Card>
      )}
    </div>
  );
}
