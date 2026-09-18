import { cn } from "@/lib/utils";

interface CardProps {
  children: React.ReactNode;
  className?: string;
}

export function Card({ children, className }: CardProps) {
  return (
    <div
      className={cn(
        "bg-card text-card-foreground rounded-lg border border-border shadow-sm",
        className
      )}
    >
      {children}
    </div>
  );
}

export function CardHeader({ children, className }: CardProps) {
  return (
    <div className={cn("flex items-center justify-between px-4 py-3 border-b border-border", className)}>
      {children}
    </div>
  );
}

export function CardTitle({ children, className }: CardProps) {
  return (
    <h2 className={cn("text-[13px] font-semibold text-foreground", className)}>{children}</h2>
  );
}

export function CardContent({ children, className }: CardProps) {
  return <div className={cn("px-4 py-4", className)}>{children}</div>;
}

export function CardFooter({ children, className }: CardProps) {
  return (
    <div
      className={cn(
        "px-4 py-3 border-t border-border bg-secondary/30 rounded-b-lg",
        className
      )}
    >
      {children}
    </div>
  );
}
