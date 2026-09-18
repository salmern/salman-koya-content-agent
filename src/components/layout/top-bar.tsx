"use client";

import { useRouter } from "next/navigation";
import { LogOut } from "lucide-react";
import { createSupabaseBrowserClient } from "@/lib/db/browser-client";
import { toast } from "sonner";
import type { Profile } from "@/types";

interface TopBarProps {
  profile: Profile | null;
}

export function TopBar({ profile }: TopBarProps) {
  const router = useRouter();

  async function handleSignOut() {
    const supabase = createSupabaseBrowserClient();
    await supabase.auth.signOut();
    toast.success("Signed out successfully");
    router.push("/login");
    router.refresh();
  }

  return (
    <header className="h-14 border-b border-border bg-background flex items-center justify-between px-6 flex-shrink-0">
      <div />
      <div className="flex items-center gap-2">
        {profile && (
          <span className="text-[13px] text-muted-foreground hidden sm:block">
            {profile.full_name ?? profile.email}
          </span>
        )}
        <button
          type="button"
          onClick={handleSignOut}
          className="flex items-center gap-1.5 h-8 px-3 text-[13px] text-muted-foreground hover:text-foreground hover:bg-secondary rounded-md transition-colors"
        >
          <LogOut size={13} />
          Sign out
        </button>
      </div>
    </header>
  );
}
