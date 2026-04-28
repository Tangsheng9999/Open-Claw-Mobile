"use client"

import { Cpu, Server } from "lucide-react"
import { useStatus, useAgentInfo } from "@/lib/hooks"
import { StatusDot } from "@/components/status-dot"
import { formatUptime } from "@/lib/format"

export function StatusHero() {
  const { data: status } = useStatus()
  const { data: info } = useAgentInfo()

  const variant =
    !status?.running ? "down" : status.health === "healthy" ? "online" : status.health === "degraded" ? "warn" : "down"

  return (
    <section className="rounded-2xl border border-border bg-gradient-to-b from-card to-card/40 p-4">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <StatusDot variant={variant} />
            <span className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
              {status?.running ? "运行中" : "已停止"}
            </span>
          </div>
          <h1 className="mt-2 truncate text-2xl font-semibold tracking-tight text-balance">
            {info?.hostname ?? "—"}
          </h1>
          <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-[12px] text-muted-foreground">
            <span className="inline-flex items-center gap-1">
              <Server className="h-3.5 w-3.5" />
              {info?.platform ?? "—"} · {info?.arch ?? "—"}
            </span>
            <span>OpenClaw {info?.openclawVersion ?? "—"}</span>
            <span>已运行 {info ? formatUptime(info.uptimeSec) : "—"}</span>
          </div>
        </div>
        <div className="shrink-0 rounded-lg border border-border bg-background/40 p-2 text-right">
          <div className="text-[10px] uppercase tracking-wide text-muted-foreground">当前模型</div>
          <div className="mt-0.5 flex items-center justify-end gap-1.5 font-mono text-[12px]">
            <Cpu className="h-3.5 w-3.5 text-primary" />
            <span className="truncate">{status?.currentModel ?? "—"}</span>
          </div>
        </div>
      </div>
    </section>
  )
}
</content>
<parameter name="taskNameActive">状态头部
