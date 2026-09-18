import { cn } from "@/lib/utils";
import type { WorkflowStatus } from "@/types";

interface BadgeProps {
  children: React.ReactNode;
  variant?: "default" | "secondary" | "outline" | "success" | "warning" | "danger" | "info";
  className?: string;
}

export function Badge({ children, variant = "default", className }: BadgeProps) {
  return (
    <span
      className={cn(
        "inline-flex items-center rounded px-1.5 py-0.5 text-[11px] font-medium ring-1 ring-inset",
        variant === "default" &&
          "bg-[hsl(var(--info-subtle))] text-primary ring-[hsl(var(--info-border))]",
        variant === "secondary" && "bg-secondary text-muted-foreground ring-border",
        variant === "outline" && "bg-transparent text-foreground ring-border",
        variant === "success" &&
          "bg-[hsl(var(--success-subtle))] text-green-700 dark:text-green-400 ring-[hsl(var(--success-border))]",
        variant === "warning" &&
          "bg-[hsl(var(--warning-subtle))] text-amber-700 dark:text-amber-400 ring-[hsl(var(--warning-border))]",
        variant === "danger" &&
          "bg-[hsl(var(--danger-subtle))] text-red-700 dark:text-red-400 ring-[hsl(var(--danger-border))]",
        variant === "info" &&
          "bg-[hsl(var(--info-subtle))] text-blue-700 dark:text-blue-400 ring-[hsl(var(--info-border))]",
        className
      )}
    >
      {children}
    </span>
  );
}

// Status → visual config: only 3 colours (blue=active, green=good, amber=waiting, red=problem)
const STATUS_CONFIG: Record<
  WorkflowStatus,
  { label: string; variant: BadgeProps["variant"]; dot: string }
> = {
  DRAFT: { label: "Draft", variant: "secondary", dot: "bg-muted-foreground" },
  RESEARCHING: { label: "Researching", variant: "info", dot: "bg-primary animate-pulse" },
  RESEARCH_COMPLETE: { label: "Research Complete", variant: "info", dot: "bg-primary" },
  PLANNING: { label: "Planning", variant: "info", dot: "bg-primary animate-pulse" },
  GENERATING: { label: "Generating", variant: "info", dot: "bg-primary animate-pulse" },
  EVALUATING: { label: "Evaluating", variant: "info", dot: "bg-primary animate-pulse" },
  REVISING: { label: "Revising", variant: "warning", dot: "bg-amber-500 animate-pulse" },
  AWAITING_REVIEW: { label: "Awaiting Review", variant: "warning", dot: "bg-amber-500" },
  REVISION_REQUESTED: { label: "Revision Requested", variant: "warning", dot: "bg-amber-500" },
  APPROVED: { label: "Approved", variant: "success", dot: "bg-green-500" },
  REJECTED: { label: "Rejected", variant: "danger", dot: "bg-red-500" },
  CHANNEL_ADAPTATION: { label: "Adapting Channels", variant: "info", dot: "bg-primary animate-pulse" },
  READY_TO_SCHEDULE: { label: "Ready to Schedule", variant: "success", dot: "bg-green-500" },
  SCHEDULED: { label: "Scheduled", variant: "info", dot: "bg-primary" },
  PUBLISHING: { label: "Publishing", variant: "info", dot: "bg-primary animate-pulse" },
  PUBLISHED: { label: "Published", variant: "success", dot: "bg-green-500" },
  FAILED: { label: "Failed", variant: "danger", dot: "bg-red-500" },
};

export function StatusBadge({ status }: { status: WorkflowStatus }) {
  const config = STATUS_CONFIG[status] ?? STATUS_CONFIG.DRAFT;
  return (
    <Badge variant={config.variant} className="flex items-center gap-1">
      <span className={cn("h-1.5 w-1.5 rounded-full flex-shrink-0", config.dot)} />
      {config.label}
    </Badge>
  );
}

export { STATUS_CONFIG };
