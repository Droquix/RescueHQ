import { cn } from "@/lib/utils";

export function Badge({
  children,
  variant = "default",
  className,
}: {
  children: React.ReactNode;
  variant?: "default" | "critical" | "warning" | "success" | "muted";
  className?: string;
}) {
  const variants = {
    default: "bg-accent/10 text-accent",
    critical: "bg-critical/10 text-critical",
    warning: "bg-warning/15 text-warning",
    success: "bg-success/10 text-success",
    muted: "bg-surface-muted text-muted",
  };

  return (
    <span
      className={cn(
        "inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium",
        variants[variant],
        className,
      )}
    >
      {children}
    </span>
  );
}
