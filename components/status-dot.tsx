import { cn } from "@/lib/utils"

type Variant = "online" | "warn" | "down" | "idle"

export function StatusDot({
  variant = "online",
  pulse = true,
  className,
}: {
  variant?: Variant
  pulse?: boolean
  className?: string
}) {
  const color =
    variant === "online"
      ? "bg-success"
      : variant === "warn"
        ? "bg-warning"
        : variant === "down"
          ? "bg-destructive"
          : "bg-muted-foreground"
  return (
    <span className={cn("relative inline-flex h-2.5 w-2.5", className)}>
      <span className={cn("absolute inset-0 rounded-full opacity-60", color, pulse && "claw-pulse")} />
      <span className={cn("relative inline-flex h-2.5 w-2.5 rounded-full", color)} />
    </span>
  )
}
