"use client";

import { useState } from "react";
import { toast } from "sonner";
import { RotateCcw } from "lucide-react";
import { formatRelativeTime } from "@/lib/utils";

interface AdminContentTableProps {
  content: any[];
}

export function AdminContentTable({ content: initial }: AdminContentTableProps) {
  const [items, setItems] = useState(initial);
  const [loading, setLoading] = useState<string | null>(null);

  async function handleRestore(id: string) {
    setLoading(id);
    try {
      const res = await fetch(`/api/admin/content/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "restore" }),
      });
      const json = await res.json();
      if (!res.ok) {
        toast.error("Restore failed", { description: json.error?.message });
        return;
      }
      setItems((p) => p.filter((c) => c.id !== id));
      toast.success("Content restored");
    } finally {
      setLoading(null);
    }
  }

  return (
    <table className="w-full text-[13px]">
      <thead>
        <tr className="border-b border-border">
          <th className="text-left px-4 py-2.5 text-[11px] font-medium text-muted-foreground uppercase tracking-wide">Content</th>
          <th className="text-left px-4 py-2.5 text-[11px] font-medium text-muted-foreground uppercase tracking-wide hidden sm:table-cell">Deleted</th>
          <th className="px-4 py-2.5" />
        </tr>
      </thead>
      <tbody>
        {items.map((item) => (
          <tr key={item.id} className="border-b border-border last:border-0 opacity-60">
            <td className="px-4 py-3">
              <p className="font-medium text-foreground line-clamp-1">{item.content_idea}</p>
              <p className="text-[11px] text-muted-foreground mt-0.5 capitalize">{item.status}</p>
            </td>
            <td className="px-4 py-3 text-muted-foreground hidden sm:table-cell">
              {formatRelativeTime(item.deleted_at)}
            </td>
            <td className="px-4 py-3">
              <button
                onClick={() => handleRestore(item.id)}
                disabled={loading === item.id}
                className="flex items-center gap-1 h-6 px-2 rounded text-[11px] font-medium text-muted-foreground hover:text-foreground hover:bg-secondary transition-colors"
              >
                <RotateCcw size={11} />Restore
              </button>
            </td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}
