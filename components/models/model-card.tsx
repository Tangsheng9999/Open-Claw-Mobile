"use client"

import * as React from "react"
import { Check, Cloud, Cpu, Download, Loader2, Play, Star, Trash2 } from "lucide-react"
import { toast } from "sonner"
import { mutate } from "swr"
import { Button } from "@/components/ui/button"
import { Progress } from "@/components/ui/progress"
import { agentApi } from "@/lib/agent-client"
import type { ModelInfo, ModelTestResult } from "@/lib/types"
import { formatBytes, formatRelative } from "@/lib/format"
import { cn } from "@/lib/utils"

export function ModelCard({ m }: { m: ModelInfo }) {
  const [testing, setTesting] = React.useState(false)
  const [pulling, setPulling] = React.useState(false)
  const [setting, setSetting] = React.useState(false)
  const [removing, setRemoving] = React.useState(false)
  const [test, setTest] = React.useState<ModelTestResult | null>(null)

  async function onSetDefault() {
    setSetting(true)
    try {
      await agentApi.setDefaultModel(m.id)
      toast.success(`已切换默认模型到 ${m.name}`)
      mutate("agent.models")
      mutate("agent.status")
    } catch (err) {
      toast.error("切换失败", { description: err instanceof Error ? err.message : String(err) })
    } finally {
      setSetting(false)
    }
  }

  async function onPull() {
    setPulling(true)
    try {
      await agentApi.pullModel(m.id)
      toast.success(`已开始拉取 ${m.name}`, { description: "可在卡片上查看进度" })
      mutate("agent.models")
    } catch (err) {
      toast.error("拉取失败", { description: err instanceof Error ? err.message : String(err) })
    } finally {
      setPulling(false)
    }
  }

  async function onTest() {
    setTesting(true)
    setTest(null)
    try {
      const r = await agentApi.testModel(m.id)
      setTest(r)
      if (r.ok) toast.success(`测试通过 · ${r.latencyMs} ms`)
      else toast.error("测试失败", { description: r.error })
    } catch (err) {
      toast.error("测试失败", { description: err instanceof Error ? err.message : String(err) })
    } finally {
      setTesting(false)
    }
  }

  async function onRemove() {
    if (!confirm(`确定要移除 ${m.name} 吗？`)) return
    setRemoving(true)
    try {
      await agentApi.removeModel(m.id)
      toast.message("已移除")
      mutate("agent.models")
    } catch (err) {
      toast.error("移除失败", { description: err instanceof Error ? err.message : String(err) })
    } finally {
      setRemoving(false)
    }
  }

  return (
    <li
      className={cn(
        "rounded-xl border bg-card p-3.5",
        m.isDefault ? "border-primary/50 ring-1 ring-primary/20" : "border-border",
      )}
    >
      <div className="flex items-start gap-3">
        <span
          className={cn(
            "inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-md",
            m.isLocal ? "bg-success/15 text-success" : "bg-primary/15 text-primary",
          )}
        >
          {m.isLocal ? <Cpu className="h-4.5 w-4.5" /> : <Cloud className="h-4.5 w-4.5" />}
        </span>
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <span className="truncate text-[14px] font-medium">{m.name}</span>
            {m.isDefault ? (
              <span className="inline-flex items-center gap-1 rounded-full bg-primary/15 px-1.5 py-0.5 text-[10px] font-medium text-primary">
                <Star className="h-2.5 w-2.5" />
                默认
              </span>
            ) : null}
          </div>
          <p className="mt-0.5 break-all font-mono text-[11px] text-muted-foreground">{m.id}</p>
          <div className="mt-1.5 flex flex-wrap items-center gap-x-3 gap-y-0.5 text-[11px] text-muted-foreground">
            <span>{m.provider}</span>
            <span>{m.contextWindow.toLocaleString()} ctx</span>
            {m.sizeMb ? <span>{formatBytes(m.sizeMb)}</span> : null}
            {m.lastUsedAt ? <span>最近：{formatRelative(m.lastUsedAt)}</span> : null}
          </div>

          {m.status === "downloading" && typeof m.pullProgress === "number" ? (
            <div className="mt-2 flex items-center gap-2">
              <Progress value={m.pullProgress} className="h-1.5 flex-1" />
              <span className="font-mono text-[11px] text-muted-foreground">{m.pullProgress}%</span>
            </div>
          ) : null}

          {test ? (
            <div
              className={cn(
                "mt-2 rounded-md border p-2 text-[11.5px] leading-snug",
                test.ok ? "border-success/30 bg-success/5" : "border-destructive/30 bg-destructive/5",
              )}
            >
              <div className="flex items-center gap-2 font-mono text-[11px]">
                <span className={test.ok ? "text-success" : "text-destructive"}>
                  {test.ok ? "PASS" : "FAIL"}
                </span>
                <span className="text-muted-foreground">{test.latencyMs} ms</span>
                {test.tokensPerSec ? (
                  <span className="text-muted-foreground">{test.tokensPerSec.toFixed(1)} tok/s</span>
                ) : null}
              </div>
              {test.sample ? <p className="mt-1 text-foreground">{test.sample}</p> : null}
              {test.error ? <p className="mt-1 text-destructive">{test.error}</p> : null}
            </div>
          ) : null}
        </div>
      </div>

      <div className="mt-3 flex flex-wrap items-center gap-2">
        {m.status === "not_pulled" ? (
          <Button size="sm" variant="outline" onClick={onPull} disabled={pulling}>
            {pulling ? <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" /> : <Download className="mr-1.5 h-3.5 w-3.5" />}
            拉取
          </Button>
        ) : null}

        {m.status === "ready" && !m.isDefault ? (
          <Button size="sm" variant="outline" onClick={onSetDefault} disabled={setting}>
            {setting ? <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" /> : <Check className="mr-1.5 h-3.5 w-3.5" />}
            设为默认
          </Button>
        ) : null}

        {m.status === "ready" ? (
          <Button size="sm" variant="outline" onClick={onTest} disabled={testing}>
            {testing ? <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" /> : <Play className="mr-1.5 h-3.5 w-3.5" />}
            测试
          </Button>
        ) : null}

        <Button
          size="sm"
          variant="ghost"
          onClick={onRemove}
          disabled={removing || m.isDefault}
          className="ml-auto text-muted-foreground hover:text-destructive"
        >
          {removing ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Trash2 className="h-3.5 w-3.5" />}
        </Button>
      </div>
    </li>
  )
}
</content>
<parameter name="taskNameActive">模型卡片
