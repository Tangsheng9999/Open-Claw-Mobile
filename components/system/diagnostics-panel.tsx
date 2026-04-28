"use client"

import { Card } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Spinner } from "@/components/ui/spinner"
import { Badge } from "@/components/ui/badge"
import { agentRequest } from "@/lib/agent-client"
import { useConnection } from "@/components/connection-provider"
import { toast } from "@/hooks/use-toast"
import { useState } from "react"
import { CheckCircle2, XCircle, AlertCircle, Stethoscope } from "lucide-react"
import { mockDiagnostics } from "@/lib/mock-data"
import type { DiagnosticCheck } from "@/lib/types"

const STATUS_CONFIG = {
  pass: { icon: CheckCircle2, color: "text-emerald-500", label: "通过" },
  warn: { icon: AlertCircle, color: "text-amber-500", label: "警告" },
  fail: { icon: XCircle, color: "text-destructive", label: "失败" },
}

export function DiagnosticsPanel() {
  const { connection } = useConnection()
  const [running, setRunning] = useState(false)
  const [checks, setChecks] = useState<DiagnosticCheck[]>(mockDiagnostics)
  const [lastRun, setLastRun] = useState<string | null>(null)

  async function runDiagnostics() {
    setRunning(true)
    try {
      if (connection) {
        const res = await agentRequest<{ checks: DiagnosticCheck[] }>(connection, "/api/diagnostics/run", {
          method: "POST",
        })
        setChecks(res.checks)
      } else {
        await new Promise((r) => setTimeout(r, 800))
      }
      setLastRun(new Date().toLocaleTimeString("zh-CN"))
      toast({ title: "诊断完成", description: "已刷新所有检查项" })
    } catch (e) {
      const msg = e instanceof Error ? e.message : "未知错误"
      toast({ title: "诊断失败", description: msg, variant: "destructive" })
    } finally {
      setRunning(false)
    }
  }

  return (
    <Card className="overflow-hidden">
      <div className="flex items-center justify-between gap-3 border-b border-border p-4">
        <div className="flex items-center gap-3">
          <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-primary/10 text-primary">
            <Stethoscope className="h-4 w-4" />
          </div>
          <div>
            <h2 className="text-sm font-semibold leading-tight">系统诊断</h2>
            <p className="mt-0.5 text-xs text-muted-foreground">
              {lastRun ? `上次运行 ${lastRun}` : "尚未运行"}
            </p>
          </div>
        </div>
        <Button size="sm" onClick={runDiagnostics} disabled={running}>
          {running ? <Spinner className="mr-2" /> : null}
          运行
        </Button>
      </div>

      <ul className="divide-y divide-border">
        {checks.map((c) => {
          const cfg = STATUS_CONFIG[c.status]
          const Icon = cfg.icon
          return (
            <li key={c.id} className="flex items-start gap-3 p-4">
              <Icon className={`mt-0.5 h-5 w-5 shrink-0 ${cfg.color}`} />
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2">
                  <span className="text-sm font-medium">{c.name}</span>
                  <Badge variant="outline" className="text-[10px]">
                    {cfg.label}
                  </Badge>
                </div>
                <p className="mt-1 text-xs leading-relaxed text-muted-foreground">{c.detail}</p>
                {c.latencyMs !== undefined ? (
                  <p className="mt-1 font-mono text-[11px] text-muted-foreground">{c.latencyMs} ms</p>
                ) : null}
              </div>
            </li>
          )
        })}
      </ul>
    </Card>
  )
}
