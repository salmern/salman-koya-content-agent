import { cn } from "@/lib/utils";
import { AlertCircle, CheckCircle2, Info, AlertTriangle, type LucideIcon } from "lucide-react";

type AlertVariant = "info" | "success" | "warning" | "error";

interface AlertProps {
  variant?: AlertVariant;
  title?: string;
  children: React.ReactNode;
  className?: string;
  icon?: LucideIcon;
}

const VARIANT_CONFIG: Record<
  AlertVariant,
  { container: string; iconClass: string; icon: LucideIcon }
> = {
  info: {
    container: "bg-[hsl(var(--info-subtle))] border-[hsl(var(--info-border))] text-foreground",
    iconClass: "text-primary",
    icon: Info,
  },
  success: {
    container:
      "bg-[hsl(var(--success-subtle))] border-[hsl(var(--success-border))] text-foreground",
    iconClass: "text-green-600 dark:text-green-400",
    icon: CheckCircle2,
  },
  warning: {
    container:
      "bg-[hsl(var(--warning-subtle))] border-[hsl(var(--warning-border))] text-foreground",
    iconClass: "text-amber-600 dark:text-amber-400",
    icon: AlertTriangle,
  },
  error: {
    container:
      "bg-[hsl(var(--danger-subtle))] border-[hsl(var(--danger-border))] text-foreground",
    iconClass: "text-red-600 dark:text-red-400",
    icon: AlertCircle,
  },
};

export function Alert({ variant = "info", title, children, className, icon }: AlertProps) {
  const { container, iconClass, icon: DefaultIcon } = VARIANT_CONFIG[variant];
  const Icon = icon ?? DefaultIcon;

  return (
    <div
      role="alert"
      className={cn("flex gap-3 rounded-lg border p-3.5 text-[13px]", container, className)}
    >
      <Icon size={14} className={cn("flex-shrink-0 mt-0.5", iconClass)} />
      <div className="min-w-0 leading-relaxed">
        {title && <p className="font-medium mb-0.5 text-[13px]">{title}</p>}
        <div className="text-[13px] text-muted-foreground">{children}</div>
      </div>
    </div>
  );
}
