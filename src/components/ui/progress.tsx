import { cn } from "@/lib/utils";

interface ProgressProps {
  value: number;
  className?: string;
  barClassName?: string;
  label?: string;
  showValue?: boolean;
}

export function Progress({ value, className, barClassName, label, showValue: _showValue }: ProgressProps) {
  const pct = Math.min(100, Math.max(0, value));
  return (
    <div
      role="progressbar"
      aria-valuenow={pct}
      aria-valuemin={0}
      aria-valuemax={100}
      aria-label={label}
      className={cn("h-1 w-full bg-secondary rounded-full overflow-hidden", className)}
    >
      <div
        className={cn(
          "h-full rounded-full transition-all duration-700 ease-out",
          barClassName ?? "bg-primary"
        )}
        style={{ width: `${pct}%` }}
      />
    </div>
  );
}
