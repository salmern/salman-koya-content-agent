import { redirect } from "next/navigation";
import { createSupabaseServerClient } from "@/lib/db/client";
import { AppSidebar } from "@/components/layout/app-sidebar";
import { TopBar } from "@/components/layout/top-bar";
import type { Profile } from "@/types";

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const supabase = await createSupabaseServerClient();

  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: profileData } = await supabase
    .from("profiles")
    .select("*")
    .eq("id", user.id)
    .single();

  const profile = profileData as Profile | null;

  // Block deactivated users
  if (profile && (profile as any).deactivated_at) {
    redirect("/login?error=Your+account+has+been+deactivated.+Contact+an+admin.");
  }

  // Fetch pending review count for reviewers/admins — shown as badge on sidebar
  let pendingReviewCount = 0;
  if (profile && ["reviewer", "admin"].includes(profile.role)) {
    const { count } = await supabase
      .from("content_requests")
      .select("*", { count: "exact", head: true })
      .in("status", ["AWAITING_REVIEW", "REVISION_REQUESTED"])
      .is("deleted_at", null) as { count: number | null };
    pendingReviewCount = count ?? 0;
  }

  return (
    <div className="flex h-screen bg-background overflow-hidden">
      <AppSidebar profile={profile} pendingReviewCount={pendingReviewCount} />
      <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
        <TopBar profile={profile} />
        <main className="flex-1 overflow-y-auto px-6 py-5">
          {children}
        </main>
      </div>
    </div>
  );
}
