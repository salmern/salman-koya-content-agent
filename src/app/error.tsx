"use client";

import { useEffect } from "react";
import Link from "next/link";

export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error("[App Error]", error);
  }, [error]);

  return (
    <div className="min-h-screen bg-slate-50 flex items-center justify-center p-4">
      <div className="text-center max-w-md">
        <div className="text-6xl font-bold text-slate-200 mb-4">!</div>
        <h1 className="text-xl font-semibold text-slate-900 mb-2">Something went wrong</h1>
        <p className="text-slate-500 text-sm mb-6">
          An unexpected error occurred. If the problem persists, please contact support.
        </p>
        <div className="flex items-center justify-center gap-3">
          <button
            onClick={reset}
            className="px-4 py-2 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700 transition-colors"
          >
            Try again
          </button>
          <Link
            href="/dashboard"
            className="px-4 py-2 border border-slate-300 text-slate-600 rounded-lg text-sm font-medium hover:bg-slate-100 transition-colors"
          >
            Back to dashboard
          </Link>
        </div>
        {error.digest && (
          <p className="text-xs text-slate-400 mt-4">Error ID: {error.digest}</p>
        )}
      </div>
    </div>
  );
}
