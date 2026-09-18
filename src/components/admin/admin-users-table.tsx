"use client";

import { useState } from "react";
import { toast } from "sonner";
import { Trash2, UserCheck, UserX } from "lucide-react";
import { formatDate, cn } from "@/lib/utils";

const ROLE_OPTIONS = ["content_manager", "reviewer", "admin"] as const;
type Role = (typeof ROLE_OPTIONS)[number];

const ROLE_LABELS: Record<Role, string> = {
  content_manager: "Content Manager",
  reviewer: "Reviewer",
  admin: "Admin",
};

interface Profile {
  id: string;
  email: string;
  full_name: string | null;
  role: Role;
  deactivated_at: string | null;
  created_at: string;
}

interface AdminUsersTableProps {
  profiles: Profile[];
  currentUserId: string;
}

export function AdminUsersTable({ profiles: initial, currentUserId }: AdminUsersTableProps) {
  const [profiles, setProfiles] = useState(initial);
  const [loading, setLoading] = useState<string | null>(null);
  const [confirmDelete, setConfirmDelete] = useState<string | null>(null);

  async function updateUser(id: string, body: Record<string, unknown>) {
    setLoading(id);
    try {
      const res = await fetch(`/api/admin/users/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const json = await res.json();
      if (!res.ok) {
        toast.error("Update failed", { description: json.error?.message });
        return false;
      }
      return true;
    } finally {
      setLoading(null);
    }
  }

  async function handleRoleChange(id: string, role: Role) {
    const ok = await updateUser(id, { role });
    if (ok) {
      setProfiles((p) => p.map((u) => u.id === id ? { ...u, role } : u));
      toast.success("Role updated");
    }
  }

  async function handleToggleDeactivate(user: Profile) {
    const deactivate = !user.deactivated_at;
    const ok = await updateUser(user.id, { deactivated: deactivate });
    if (ok) {
      setProfiles((p) =>
        p.map((u) => u.id === user.id
          ? { ...u, deactivated_at: deactivate ? new Date().toISOString() : null }
          : u
        )
      );
      toast.success(deactivate ? "User deactivated" : "User reactivated");
    }
  }

  async function handleDelete(id: string) {
    setLoading(id);
    try {
      const res = await fetch(`/api/admin/users/${id}`, { method: "DELETE" });
      const json = await res.json();
      if (!res.ok) {
        toast.error("Delete failed", { description: json.error?.message });
        return;
      }
      setProfiles((p) => p.filter((u) => u.id !== id));
      toast.success("User deleted");
    } finally {
      setLoading(null);
      setConfirmDelete(null);
    }
  }

  const selectCls = "h-6 px-1.5 rounded border border-border bg-background text-[12px] text-foreground focus:outline-none focus:ring-1 focus:ring-ring";
  const actionBtnCls = "flex items-center gap-1 h-6 px-2 rounded text-[11px] font-medium transition-colors";

  return (
    <table className="w-full text-[13px]">
      <thead>
        <tr className="border-b border-border">
          <th className="text-left px-4 py-2.5 text-[11px] font-medium text-muted-foreground uppercase tracking-wide">Name</th>
          <th className="text-left px-4 py-2.5 text-[11px] font-medium text-muted-foreground uppercase tracking-wide hidden sm:table-cell">Email</th>
          <th className="text-left px-4 py-2.5 text-[11px] font-medium text-muted-foreground uppercase tracking-wide">Role</th>
          <th className="text-left px-4 py-2.5 text-[11px] font-medium text-muted-foreground uppercase tracking-wide hidden md:table-cell">Joined</th>
          <th className="px-4 py-2.5" />
        </tr>
      </thead>
      <tbody>
        {profiles.map((user) => {
          const isSelf = user.id === currentUserId;
          const isLoading = loading === user.id;

          return (
            <tr key={user.id} className={cn("border-b border-border last:border-0", user.deactivated_at && "opacity-50")}>
              <td className="px-4 py-3">
                <div className="flex items-center gap-2">
                  <div className="h-6 w-6 rounded-full bg-secondary flex items-center justify-center flex-shrink-0 ring-1 ring-border">
                    <span className="text-[11px] font-semibold text-muted-foreground">
                      {(user.full_name?.[0] ?? user.email[0]).toUpperCase()}
                    </span>
                  </div>
                  <div>
                    <p className="font-medium text-foreground leading-tight">
                      {user.full_name ?? "—"}
                      {isSelf && <span className="ml-1.5 text-[10px] text-muted-foreground">(you)</span>}
                    </p>
                    {user.deactivated_at && (
                      <p className="text-[10px] text-red-500">Deactivated</p>
                    )}
                  </div>
                </div>
              </td>
              <td className="px-4 py-3 text-muted-foreground hidden sm:table-cell">{user.email}</td>
              <td className="px-4 py-3">
                <select
                  value={user.role}
                  disabled={isSelf || isLoading}
                  onChange={(e) => handleRoleChange(user.id, e.target.value as Role)}
                  className={selectCls}
                >
                  {ROLE_OPTIONS.map((r) => (
                    <option key={r} value={r}>{ROLE_LABELS[r]}</option>
                  ))}
                </select>
              </td>
              <td className="px-4 py-3 text-muted-foreground hidden md:table-cell">
                {formatDate(user.created_at)}
              </td>
              <td className="px-4 py-3">
                {!isSelf && (
                  confirmDelete === user.id ? (
                    <div className="flex items-center gap-1.5">
                      <button
                        onClick={() => handleDelete(user.id)}
                        disabled={isLoading}
                        className={cn(actionBtnCls, "bg-destructive text-white hover:bg-destructive/90")}
                      >
                        Confirm delete
                      </button>
                      <button
                        onClick={() => setConfirmDelete(null)}
                        className={cn(actionBtnCls, "text-muted-foreground hover:text-foreground hover:bg-secondary")}
                      >
                        Cancel
                      </button>
                    </div>
                  ) : (
                    <div className="flex items-center gap-1">
                      <button
                        onClick={() => handleToggleDeactivate(user)}
                        disabled={isLoading}
                        className={cn(actionBtnCls,
                          user.deactivated_at
                            ? "text-green-600 hover:bg-[hsl(var(--success-subtle))]"
                            : "text-muted-foreground hover:bg-secondary hover:text-foreground"
                        )}
                        title={user.deactivated_at ? "Reactivate" : "Deactivate"}
                      >
                        {user.deactivated_at ? <UserCheck size={13} /> : <UserX size={13} />}
                      </button>
                      <button
                        onClick={() => setConfirmDelete(user.id)}
                        disabled={isLoading}
                        className={cn(actionBtnCls, "text-muted-foreground hover:text-red-600 hover:bg-[hsl(var(--danger-subtle))]")}
                        title="Delete user"
                      >
                        <Trash2 size={13} />
                      </button>
                    </div>
                  )
                )}
              </td>
            </tr>
          );
        })}
      </tbody>
    </table>
  );
}
