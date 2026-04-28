import Link from "next/link"
import { ChevronRight } from "lucide-react"
import { cn } from "@/lib/utils"

export function SectionHeader({
  title,
  hint,
  href,
  className,
}: {
  title: string
  hint?: string
  href?: string
  className?: string
}) {
  const inner = (
    <>
      <div className="flex flex-col">
        <span className="text-sm font-semibold tracking-tight">{title}</span>
        {hint ? <span className="text-[11px] text-muted-foreground">{hint}</span> : null}
      </div>
      {href ? <ChevronRight className="h-4 w-4 text-muted-foreground" /> : null}
    </>
  )
  if (href)
    return (
      <Link href={href} className={cn("flex items-center justify-between py-1", className)}>
        {inner}
      </Link>
    )
  return <div className={cn("flex items-center justify-between py-1", className)}>{inner}</div>
}
</content>
<parameter name="taskNameActive">区块标题
