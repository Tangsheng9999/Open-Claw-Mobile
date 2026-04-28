"use client"

import { Activity, AlertTriangle, ShieldAlert } from "lucide-react"
import { useLogs } from "@/lib/hooks"
import { useRealtime } from "@/lib/realtime"
import { cn } from "@/lib/utils"

export function LogStream() {
  const { data: logs = [] } = useLogs(150)
  const rt = useRealtime()
  const live = rt.status === "open"

  return (
    <div className="overflow-hidden rounded-2xl border border-border bg-card">
      <div className="flex items-center justify-between border-b border-border px-3.5 py-2.5 text-[11px] uppercase tracking-wide text-muted-foreground">
        <span className="flex items-center gap-1.5">
          <Activity className={cn("h-3 w-3", live ? "text-success" : "text-muted-foreground")} />
          {live ? "实时日志（WebSocket 已连接）" : "日志（WebSocket 未连接，仅显示快照）"}
        </span>
        <span className="font-mono text-foreground/70">{logs.length}</span>
      </div>
      {logs.length === 0 ? (
        <div className="p-6 text-center text-[12px] text-muted-foreground">暂无日志</div>
      ) : (
        <ul className="max-h-96 divide-y divide-border overflow-auto font-mono text-[11.5px]">
          {logs.map((l, i) => {
            const tone =
              l.level === "error"
                ? "text-destructive"
                : l.level === "warn"
                  ? "text-warning"
                  : l.level === "debug"
                    ? "text-muted-foreground/80"
                    : "text-foreground"
            const Icon = l.level === "error" ? ShieldAlert : l.level === "warn" ? AlertTriangle : Activity
            return (
              <li key={`${l.ts}-${i}`} className="flex items-start gap-2 px-3.5 py-2">
                <Icon className={cn("mt-0.5 h-3 w-3 shrink-0", tone)} />
                <span className="shrink-0 text-muted-foreground/70">
                  {new Date(l.ts).toLocaleTimeString("zh-CN", { hour12: false })}
                </span>
                <span className="shrink-0 text-muted-foreground">[{l.source}]</span>
                <span className={cn("min-w-0 break-all", tone)}>{l.message}</span>
              </li>
            )
          })}
        </ul>
      )}
    </div>
  )
}
