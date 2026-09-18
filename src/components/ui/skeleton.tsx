import { cn } from "@/lib/utils";

interface SkeletonProps { className?: string }

export function Skeleton({ className }: SkeletonProps) {
  return <div className={cn("rounded skeleton", className)} aria-hidden="true" />;
}

export function CardSkeleton() {
  return (
    <div className="bg-card rounded-lg border border-border p-4 space-y-3">
      <Skeleton className="h-3.5 w-1/3" />
      <Skeleton className="h-6 w-2/3" />
      <Skeleton className="h-3 w-1/2" />
    </div>
  );
}

export function TableRowSkeleton({ cols = 4 }: { cols?: number }) {
  return (
    <tr className="border-b border-border">
      {Array.from({ length: cols }).map((_, i) => (
        <td key={i} className="px-4 py-3">
          <Skeleton className="h-3.5 w-full" />
        </td>
      ))}
    </tr>
  );
}
