"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  LayoutDashboard,
  FileText,
  ClipboardCheck,
  Send,
  History,
  Settings,
  Plus,
  PenLine,
} from "lucide-react";
import { cn } from "@/lib/utils";
import type { Profile } from "@/types";
import { canCreateContent } from "@/lib/auth/permissions";

interface NavItem {
  href: string;
  label: string;
  icon: React.ElementType;
  roles?: string[];
  /** Key used to look up a badge count from the `badges` prop */
  badgeKey?: string;
}

const NAV_ITEMS: NavItem[] = [
  { href: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
  { href: "/content", label: "Content", icon: FileText },
  {
    href: "/review",
    label: "Review Queue",
    icon: ClipboardCheck,
    roles: ["reviewer", "admin"],
    badgeKey: "pendingReview",
  },
  { href: "/publishing", label: "Publishing", icon: Send },
  { href: "/audit", label: "Audit Log", icon: History, roles: ["admin"] },
  { href: "/settings", label: "Settings", icon: Settings, roles: ["admin"] },
];

const ROLE_LABELS: Record<string, string> = {
  content_manager: "Content Manager",
  reviewer: "Reviewer",
  admin: "Admin",
};

interface AppSidebarProps {
  profile: Profile | null;
  pendingReviewCount?: number;
}

export function AppSidebar({ profile, pendingReviewCount = 0 }: AppSidebarProps) {
  const pathname = usePathname();

  const badges: Record<string, number> = {
    pendingReview: pendingReviewCount,
  };

  const visibleNav = NAV_ITEMS.filter(
    (item) => !item.roles || (profile && item.roles.includes(profile.role))
  );

  const initials = profile
    ? (profile.full_name?.split(" ").map((n) => n[0]).join("").slice(0, 2).toUpperCase() ??
       profile.email[0].toUpperCase())
    : "?";

  return (
    <aside className="w-[220px] flex-shrink-0 bg-sidebar flex flex-col h-full border-r border-sidebar-border">
      {/* Wordmark */}
      <div className="flex items-center gap-2 px-4 h-14 border-b border-sidebar-border flex-shrink-0">
        <div className="flex h-6 w-6 items-center justify-center rounded bg-primary flex-shrink-0">
          <PenLine size={12} className="text-white" strokeWidth={2.5} />
        </div>
        <span className="text-sidebar-primary text-[13px] font-semibold tracking-tight">
          Content Agent
        </span>
      </div>

      {/* New content button */}
      {canCreateContent(profile?.role) && (
        <div className="px-3 pt-3 pb-1">
          <Link
            href="/content/new"
            className="flex items-center gap-2 w-full h-8 px-3 rounded-md bg-primary text-white text-[13px] font-medium hover:bg-primary/90 transition-colors"
          >
            <Plus size={13} strokeWidth={2.5} />
            New Content
          </Link>
        </div>
      )}

      {/* Navigation */}
      <nav className="flex-1 px-2 py-2 space-y-0.5 overflow-y-auto" aria-label="Main navigation">
        <p className="px-2 pb-1 pt-1 text-[11px] font-medium text-sidebar-foreground/40 uppercase tracking-widest">
          Navigation
        </p>
        {visibleNav.map((item) => {
          const Icon = item.icon;
          const isActive =
            pathname === item.href ||
            (item.href !== "/dashboard" && pathname.startsWith(item.href));
          const badgeCount = item.badgeKey ? (badges[item.badgeKey] ?? 0) : 0;

          return (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                "flex items-center gap-2.5 h-8 px-2 rounded-md text-[13px] transition-colors",
                isActive
                  ? "bg-sidebar-accent text-sidebar-primary font-medium"
                  : "text-sidebar-foreground/60 hover:text-sidebar-foreground hover:bg-sidebar-accent/60"
              )}
              aria-current={isActive ? "page" : undefined}
            >
              <Icon size={14} className="flex-shrink-0" strokeWidth={isActive ? 2.5 : 2} />
              <span className="flex-1 truncate">{item.label}</span>

              {/* Pending badge — only when count > 0 */}
              {badgeCount > 0 && (
                <span
                  className="flex-shrink-0 h-4 min-w-4 px-1 rounded-full bg-amber-500 text-white text-[10px] font-bold flex items-center justify-center tabular-nums"
                  aria-label={`${badgeCount} pending`}
                >
                  {badgeCount > 99 ? "99+" : badgeCount}
                </span>
              )}
            </Link>
          );
        })}
      </nav>

      {/* User row */}
      {profile && (
        <div className="px-3 py-3 border-t border-sidebar-border flex-shrink-0">
          <div className="flex items-center gap-2.5">
            <div className="h-7 w-7 rounded-full bg-sidebar-accent flex items-center justify-center flex-shrink-0 ring-1 ring-sidebar-border">
              <span className="text-sidebar-foreground/80 text-[11px] font-semibold">
                {initials}
              </span>
            </div>
            <div className="min-w-0 flex-1">
              <p className="text-sidebar-primary text-[12px] font-medium truncate leading-tight">
                {profile.full_name ?? profile.email.split("@")[0]}
              </p>
              <p className="text-sidebar-foreground/40 text-[11px] truncate leading-tight">
                {ROLE_LABELS[profile.role] ?? profile.role}
              </p>
            </div>
          </div>
        </div>
      )}
    </aside>
  );
}
