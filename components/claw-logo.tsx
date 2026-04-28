import { cn } from "@/lib/utils"

export function ClawLogo({ className }: { className?: string }) {
  return (
    <span
      className={cn(
        "inline-flex h-8 w-8 items-center justify-center rounded-md bg-primary/15 text-primary ring-1 ring-primary/30",
        className,
      )}
      aria-label="Claw"
    >
      <svg viewBox="0 0 24 24" className="h-4.5 w-4.5" fill="none" stroke="currentColor" strokeWidth="2">
        {/* simplified claw / pincer */}
        <path
          d="M4 14c0-3 2-5 5-5h1V6l4 4-4 4v-3H9c-1.7 0-3 1.3-3 3v0"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
        <path
          d="M20 10c0 3-2 5-5 5h-1v3l-4-4 4-4v3h1c1.7 0 3-1.3 3-3v0"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </svg>
    </span>
  )
}
</content>
<parameter name="taskNameActive">Logo 组件
