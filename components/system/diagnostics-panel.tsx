"use client"

import * as React from "react"
import { AlertCircle, CheckCircle2, Loader2, Stethoscope, XCircle } from "lucide-react"
import { mutate } from "swr"
import { toast } from "sonner"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { agentApi } from "@/lib/agent-client"
import { useDiagnostics } from "@/lib/hooks"
import { cn } from "@/lib/utils"

const STATUS_CONFIG = {
  pass: { icon: CheckCircle2, color: "text-success", label: "通过" },
  warn: { icon: AlertCircle, color: "text-warning", label: "警告" },
  fail: { icon: XCircle, color: "text-destructive", label: "失败" },
  running: { icon: Loader2, color: "text-muted-foreground animate-spin", label: "运行中" },
} as const

export function DiagnosticsPanel() {
  const { data: checks = [], isLoading } = useDiagnostics()
  const [running, setRunning] = React.useState(false)
  const [lastRun, setLastRun] = React.useState<string | null>(null)

  async function runDiagnostics() {
    setRunning(true)
    try {
      const next = await agentApi.diagnostics()
      mutate("agent.diagnostics", next, { revalidate: false })
      setLastRun(new Date().toLocaleTimeString("zh-CN"))
      toast.success("诊断完成", { description: `共 ${next.length} 项检查` })
    } catch (e) {
      const msg = e instanceof Error ? e.message : "未知错误"
      toast.error("诊断失败", { description: msg })
    } finally {
      setRunning(false)
    }
  }

  return (
    <div className="overflow-hidden rounded-2xl border border-border bg-card">
      <div className="flex items-center justify-between gap-3 border-b border-border p-4">
        <div className="flex items-center gap-3">
          <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-primary/10 text-primary">
            <Stethoscope className="h-4 w-4" />
          </div>
          <div>
            <h2 className="text-sm font-semibold leading-tight">系统诊断</h2>
            <p className="mt-0.5 text-xs text-muted-foreground">
              {lastRun ? `上次运行 ${lastRun}` : isLoading ? "加载中…" : "已自动加载"}
            </p>
          </div>
        </div>
        <Button size="sm" onClick={runDiagnostics} disabled={running}>
          {running ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
          重新运行
        </Button>
      </div>

      <ul className="divide-y divide-border">
        {checks.length === 0 && !isLoading ? (
          <li className="p-6 text-center text-[12px] text-muted-foreground">没有可用的诊断结果</li>
        ) : null}
        {checks.map((c) => {
          const cfg = STATUS_CONFIG[c.status]
          const Icon = cfg.icon
          return (
            <li key={c.id} className="flex items-start gap-3 p-4">
              <Icon className={cn("mt-0.5 h-5 w-5 shrink-0", cfg.color)} />
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2">
                  <span className="text-sm font-medium">{c.label}</span>
                  <Badge variant="outline" className="text-[10px]">
                    {cfg.label}
                  </Badge>
                </div>
                <p className="mt-1 text-xs leading-relaxed text-muted-foreground">{c.detail}</p>
                {c.fixHint ? (
                  <p className="mt-1 text-[11px] leading-relaxed text-warning">建议：{c.fixHint}</p>
                ) : null}
              </div>
            </li>
          )
        })}
      </ul>
    </div>
  )
}
