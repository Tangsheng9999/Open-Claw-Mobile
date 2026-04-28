import type * as React from "react"
import { cn } from "@/lib/utils"

export function MetricTile({
  label,
  value,
  hint,
  icon,
  tone = "default",
  className,
}: {
  label: string
  value: React.ReactNode
  hint?: React.ReactNode
  icon?: React.ReactNode
  tone?: "default" | "primary" | "success" | "warn" | "danger"
  className?: string
}) {
  const toneCls =
    tone === "primary"
      ? "text-primary"
      : tone === "success"
        ? "text-success"
        : tone === "warn"
          ? "text-warning"
          : tone === "danger"
            ? "text-destructive"
            : "text-foreground"
  return (
    <div className={cn("rounded-xl border border-border bg-card p-3.5", className)}>
      <div className="flex items-center justify-between gap-2">
        <span className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">{label}</span>
        {icon ? <span className="text-muted-foreground">{icon}</span> : null}
      </div>
      <div className={cn("mt-1.5 font-mono text-xl font-semibold leading-none", toneCls)}>{value}</div>
      {hint ? <div className="mt-1.5 text-[11px] text-muted-foreground">{hint}</div> : null}
    </div>
  )
}
