import type { Metadata } from "next";
import Link from "next/link";
import { ChevronLeft } from "lucide-react";
import { NewContentForm } from "@/components/content/new-content-form";

export const metadata: Metadata = { title: "New Content" };

export default function NewContentPage() {
  return (
    <div className="max-w-2xl mx-auto">
      <div className="mb-5">
        <Link
          href="/content"
          className="flex items-center gap-1 text-[12px] text-muted-foreground hover:text-foreground transition-colors mb-3"
        >
          <ChevronLeft size={13} /> Back to content
        </Link>
        <h1 className="text-lg font-semibold text-foreground">New Content Request</h1>
        <p className="text-[13px] text-muted-foreground mt-0.5">
          Describe what you want to create. AI will research, plan, and draft it.
        </p>
      </div>
      <NewContentForm />
    </div>
  );
}
