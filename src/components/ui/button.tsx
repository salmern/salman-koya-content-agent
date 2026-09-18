import { cn } from "@/lib/utils";
import { Loader2 } from "lucide-react";
import type { ButtonHTMLAttributes } from "react";

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: "primary" | "secondary" | "outline" | "ghost" | "destructive";
  size?: "xs" | "sm" | "md" | "lg";
  loading?: boolean;
  children: React.ReactNode;
}

export function Button({
  variant = "primary",
  size = "md",
  loading = false,
  disabled,
  children,
  className,
  ...props
}: ButtonProps) {
  return (
    <button
      disabled={disabled || loading}
      className={cn(
        "inline-flex items-center justify-center gap-1.5 rounded-md font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:opacity-50 disabled:pointer-events-none",
        // Variants — clean, no gradients
        variant === "primary" &&
          "bg-primary text-white hover:bg-primary/90 shadow-sm",
        variant === "secondary" &&
          "bg-secondary text-foreground hover:bg-secondary/80 border border-border",
        variant === "outline" &&
          "border border-border bg-transparent text-foreground hover:bg-secondary",
        variant === "ghost" &&
          "bg-transparent text-muted-foreground hover:text-foreground hover:bg-secondary",
        variant === "destructive" &&
          "bg-destructive text-white hover:bg-destructive/90 shadow-sm",
        // Sizes
        size === "xs" && "h-6 px-2 text-[11px]",
        size === "sm" && "h-7 px-2.5 text-[12px]",
        size === "md" && "h-8 px-3 text-[13px]",
        size === "lg" && "h-9 px-4 text-sm",
        className
      )}
      {...props}
    >
      {loading && <Loader2 size={12} className="animate-spin" />}
      {children}
    </button>
  );
}
