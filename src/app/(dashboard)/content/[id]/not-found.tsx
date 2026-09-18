import Link from "next/link";
import { FileText } from "lucide-react";

export default function ContentNotFound() {
  return (
    <div className="max-w-md mx-auto text-center py-20">
      <div className="h-12 w-12 rounded-full bg-slate-100 flex items-center justify-center mx-auto mb-4">
        <FileText size={20} className="text-slate-400" />
      </div>
      <h2 className="text-lg font-semibold text-slate-900 mb-2">Content not found</h2>
      <p className="text-slate-500 text-sm mb-6">
        This content request doesn&apos;t exist or you don&apos;t have access to it.
      </p>
      <Link
        href="/content"
        className="inline-flex items-center px-4 py-2 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700 transition-colors"
      >
        View all content
      </Link>
    </div>
  );
}
