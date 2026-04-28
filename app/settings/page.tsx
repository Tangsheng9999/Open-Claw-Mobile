"use client"

import * as React from "react"
import { CheckCircle2, ExternalLink, Loader2, Plug, ShieldCheck, Trash2 } from "lucide-react"
import { toast } from "sonner"
import { AppShell } from "@/components/app-shell"
import { SectionHeader } from "@/components/section-header"
import { useConnection } from "@/components/connection-provider"
import { agentApi } from "@/lib/agent-client"
import { normalizeAgentUrl } from "@/lib/connection"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"

export default function SettingsPage() {
  const { config, setConfig, disconnect, hydrated } = useConnection()
  const [agentUrl, setAgentUrl] = React.useState(config?.agentUrl ?? "")
  const [token, setToken] = React.useState(config?.token ?? "")
  const [label, setLabel] = React.useState(config?.label ?? "")
  const [probing, setProbing] = React.useState(false)

  React.useEffect(() => {
    if (!hydrated) return
    setAgentUrl(config?.agentUrl ?? "")
    setToken(config?.token ?? "")
    setLabel(config?.label ?? "")
  }, [config, hydrated])

  async function onProbeAndSave() {
    if (!agentUrl || !token) {
      toast.error("请填写 Agent 地址和 Token")
      return
    }
    const url = normalizeAgentUrl(agentUrl)
    setProbing(true)
    try {
      await agentApi.probe(url, token)
      setConfig({ agentUrl: url, token, label: label || undefined })
      toast.success("连接成功，已保存")
    } catch (err) {
      toast.error("无法连接到 Agent", {
        description: err instanceof Error ? err.message : String(err),
      })
    } finally {
      setProbing(false)
    }
  }

  function onDisconnect() {
    disconnect()
    setAgentUrl("")
    setToken("")
    setLabel("")
    toast.message("已断开连接")
  }

  return (
    <AppShell>
      <div className="flex flex-col gap-4">
        <section className="rounded-2xl border border-border bg-card p-4">
          <div className="flex items-start gap-3">
            <span className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-md bg-primary/15 text-primary ring-1 ring-primary/30">
              <Plug className="h-5 w-5" />
            </span>
            <div>
              <h1 className="text-lg font-semibold tracking-tight">Bridge Agent 连接</h1>
              <p className="text-[12px] leading-relaxed text-muted-foreground">
                监控台只是前端 — 数据来自跑在你 VPS / macOS 上的 Bridge Agent。安装方法见
                <a
                  href="https://github.com/your-org/open-claw-monitor#bridge-agent-installation"
                  target="_blank"
                  rel="noreferrer"
                  className="ml-1 inline-flex items-center gap-0.5 text-primary underline-offset-2 hover:underline"
                >
                  README
                  <ExternalLink className="h-3 w-3" />
                </a>
              </p>
            </div>
          </div>
        </section>

        <section className="flex flex-col gap-2">
          <SectionHeader title="连接配置" hint="保存在设备本地 · 不会上传到任何地方" />
          <div className="rounded-xl border border-border bg-card p-4">
            <div className="flex flex-col gap-3.5">
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="agentUrl" className="text-[12px] text-muted-foreground">
                  Agent 地址
                </Label>
                <Input
                  id="agentUrl"
                  placeholder="https://claw.example.com  或  http://192.168.1.10:7878"
                  value={agentUrl}
                  onChange={(e) => setAgentUrl(e.target.value)}
                  autoCapitalize="off"
                  autoCorrect="off"
                  inputMode="url"
                  className="font-mono text-[13px]"
                />
              </div>
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="token" className="text-[12px] text-muted-foreground">
                  访问 Token
                </Label>
                <Input
                  id="token"
                  placeholder="启动 Agent 时打印在终端"
                  value={token}
                  onChange={(e) => setToken(e.target.value)}
                  autoCapitalize="off"
                  autoCorrect="off"
                  type="password"
                  className="font-mono text-[13px]"
                />
              </div>
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="label" className="text-[12px] text-muted-foreground">
                  备注（可选）
                </Label>
                <Input
                  id="label"
                  placeholder="例如：家里的 Mac mini"
                  value={label}
                  onChange={(e) => setLabel(e.target.value)}
                  className="text-[13px]"
                />
              </div>
              <div className="flex items-center gap-2 pt-1">
                <Button onClick={onProbeAndSave} disabled={probing} className="flex-1">
                  {probing ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <ShieldCheck className="mr-2 h-4 w-4" />}
                  {probing ? "正在验证…" : config ? "更新连接" : "测试并保存"}
                </Button>
                {config ? (
                  <Button variant="outline" onClick={onDisconnect}>
                    <Trash2 className="mr-2 h-4 w-4" />
                    断开
                  </Button>
                ) : null}
              </div>
            </div>
          </div>
        </section>

        {config ? (
          <section className="rounded-xl border border-success/40 bg-success/5 p-4">
            <div className="flex items-start gap-3">
              <CheckCircle2 className="mt-0.5 h-5 w-5 text-success" />
              <div className="text-[12px]">
                <p className="font-medium text-foreground">已连接到 {config.label || config.agentUrl}</p>
                <p className="mt-1 break-all font-mono text-[11px] text-muted-foreground">{config.agentUrl}</p>
              </div>
            </div>
          </section>
        ) : null}

        <section className="flex flex-col gap-2">
          <SectionHeader title="关于" />
          <div className="rounded-xl border border-border bg-card p-4 text-[12px] leading-relaxed text-muted-foreground">
            <p>
              Open Claw Monitor 是一个开源的 PWA + Node.js Bridge，用来在手机上监控运行在你自己机器上的{" "}
              <span className="font-medium text-foreground">OpenClaw</span> 实例。所有数据保留在你自己的设备上。
            </p>
            <p className="mt-2">
              支持 安卓 / iOS / 鸿蒙 — 浏览器打开后选择「添加到主屏幕」即可像原生 App 一样使用。
            </p>
          </div>
        </section>
      </div>
    </AppShell>
  )
}
</content>
<parameter name="taskNameActive">设置页
