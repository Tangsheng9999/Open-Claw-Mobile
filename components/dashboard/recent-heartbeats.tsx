"use client"

import { AlertTriangle, Info, ShieldAlert } from "lucide-react"
import { useHeartbeats } from "@/lib/hooks"
import { formatRelative } from "@/lib/format"
import { cn } from "@/lib/utils"

export function RecentHeartbeats() {
  const { data: hbs } = useHeartbeats()
  const items = hbs ?? []

  return (
    <div className="overflow-hidden rounded-xl border border-border bg-card">
      <ul className="divide-y divide-border">
        {items.length === 0 ? (
          <li className="p-4 text-center text-[12px] text-muted-foreground">暂无心跳</li>
        ) : (
          items.slice(0, 5).map((h) => {
            const Icon = h.level === "error" ? ShieldAlert : h.level === "warn" ? AlertTriangle : Info
            const tone =
              h.level === "error"
                ? "text-destructive"
                : h.level === "warn"
                  ? "text-warning"
                  : "text-muted-foreground"
            return (
              <li key={h.id} className="flex items-start gap-3 p-3.5">
                <Icon className={cn("mt-0.5 h-4 w-4 shrink-0", tone)} />
                <div className="min-w-0 flex-1">
                  <div className="flex items-center justify-between gap-2">
                    <span className="font-mono text-[11px] uppercase tracking-wide text-muted-foreground">
                      {h.source}
                    </span>
                    <span className="text-[11px] text-muted-foreground">{formatRelative(h.timestamp)}</span>
                  </div>
                  <p className="mt-0.5 text-[13px] leading-snug text-foreground">{h.message}</p>
                </div>
              </li>
            )
          })
        )}
      </ul>
    </div>
  )
}
