"use client"

import { Activity, AlertTriangle, Heart, MessageSquare, MonitorCog, Box } from "lucide-react"
import { MetricTile } from "@/components/metric-tile"
import { useMetrics, useStatus } from "@/lib/hooks"
import { formatBytes, clamp } from "@/lib/format"

export function QuickMetrics() {
  const { data: status } = useStatus()
  const { data: m } = useMetrics()

  const memPct = m ? clamp((m.memUsedMb / m.memTotalMb) * 100) : 0
  const diskPct = m ? clamp((m.diskUsedGb / m.diskTotalGb) * 100) : 0

  return (
    <div className="grid grid-cols-2 gap-2.5">
      <MetricTile
        label="活跃对话"
        value={status?.activeConversations ?? 0}
        hint={`${status?.pendingHeartbeats ?? 0} 个心跳待处理`}
        icon={<MessageSquare className="h-4 w-4" />}
        tone="primary"
      />
      <MetricTile
        label="活跃项目"
        value={status?.activeProjects ?? 0}
        hint={status?.gateway.requestsPerMin ? `${status.gateway.requestsPerMin} req/min` : "网关空闲"}
        icon={<Box className="h-4 w-4" />}
      />
      <MetricTile
        label="CPU"
        value={`${(m?.cpuPercent ?? 0).toFixed(0)}%`}
        hint={`load ${m?.loadAvg.map((n) => n.toFixed(2)).join(" ") ?? "—"}`}
        icon={<Activity className="h-4 w-4" />}
        tone={m && m.cpuPercent > 85 ? "warn" : "default"}
      />
      <MetricTile
        label="内存"
        value={`${memPct.toFixed(0)}%`}
        hint={m ? `${formatBytes(m.memUsedMb)} / ${formatBytes(m.memTotalMb)}` : "—"}
        icon={<MonitorCog className="h-4 w-4" />}
        tone={memPct > 85 ? "warn" : "default"}
      />
      <MetricTile
        label="磁盘"
        value={`${diskPct.toFixed(0)}%`}
        hint={m ? `${m.diskUsedGb.toFixed(1)} / ${m.diskTotalGb} GB` : "—"}
        icon={<MonitorCog className="h-4 w-4" />}
        tone={diskPct > 85 ? "warn" : "default"}
      />
      <MetricTile
        label="网关错误"
        value={`${status?.gateway.errorsPerMin ?? 0}`}
        hint={status?.gateway.running ? `:${status.gateway.port} 监听中` : "网关未运行"}
        icon={status && status.gateway.errorsPerMin > 0 ? <AlertTriangle className="h-4 w-4" /> : <Heart className="h-4 w-4" />}
        tone={status && status.gateway.errorsPerMin > 0 ? "danger" : "success"}
      />
    </div>
  )
}
