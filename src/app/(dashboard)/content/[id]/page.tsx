import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";
import { createSupabaseServerClient } from "@/lib/db/client";
import { requireAuth } from "@/lib/auth/session";
import { ContentWorkspace } from "@/components/content/content-workspace";

export const metadata: Metadata = { title: "Content Workspace" };
export const dynamic = "force-dynamic";

export default async function ContentWorkspacePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const session = await requireAuth();
  const supabase = await createSupabaseServerClient();

  const { data: requestRaw, error } = await supabase
    .from("content_requests")
    .select("*")
    .eq("id", id)
    .single();

  const request = requestRaw as any;

  if (error || !request) notFound();

  const isReviewer = ["reviewer", "admin"].includes(session.profile.role);
  if (!isReviewer && request.user_id !== session.userId) {
    redirect("/content");
  }

  return (
    <ContentWorkspace
      contentRequestId={id}
      initialRequest={request}
      currentUserId={session.userId}
      currentUserRole={session.profile.role}
      currentUserEmail={session.email}
    />
  );
}
