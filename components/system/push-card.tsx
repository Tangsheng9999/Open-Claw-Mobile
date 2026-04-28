"use client"

import * as React from "react"
import { Bell, BellOff, Loader2, Send } from "lucide-react"
import { toast } from "sonner"
import { Button } from "@/components/ui/button"
import {
  getCurrentSubscription,
  getPushPermission,
  subscribePush,
  unsubscribePush,
  type PushPermission,
} from "@/lib/push"
import { agentApi } from "@/lib/agent-client"
import { useConnection } from "@/components/connection-provider"

export function PushCard() {
  const { config } = useConnection()
  const [permission, setPermission] = React.useState<PushPermission>("default")
  const [subscribed, setSubscribed] = React.useState(false)
  const [busy, setBusy] = React.useState(false)
  const [testing, setTesting] = React.useState(false)

  const refresh = React.useCallback(async () => {
    setPermission(getPushPermission())
    const sub = await getCurrentSubscription()
    setSubscribed(!!sub)
  }, [])

  React.useEffect(() => {
    void refresh()
  }, [refresh])

  async function onEnable() {
    setBusy(true)
    const r = await subscribePush()
    if (r.ok) toast.success("已开启推送通知")
    else toast.error("无法开启通知", { description: r.reason })
    await refresh()
    setBusy(false)
  }

  async function onDisable() {
    setBusy(true)
    const r = await unsubscribePush()
    if (r.ok) toast.message("已关闭推送通知")
    else toast.error("操作失败", { description: r.reason })
    await refresh()
    setBusy(false)
  }

  async function onTest() {
    setTesting(true)
    try {
      const r = await agentApi.push.test()
      if (r.sent > 0) toast.success(`已向 ${r.sent} 个设备发送测试通知`)
      else toast.warning("没有任何已订阅的设备")
    } catch (e) {
      toast.error("测试失败", { description: e instanceof Error ? e.message : String(e) })
    } finally {
      setTesting(false)
    }
  }

  const unsupported = permission === "unsupported"
  const blocked = permission === "denied"

  return (
    <div className="rounded-2xl border border-border bg-card p-4">
      <div className="flex items-start gap-3">
        <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10 text-primary">
          {subscribed ? <Bell className="h-5 w-5" /> : <BellOff className="h-5 w-5" />}
        </div>
        <div className="min-w-0 flex-1">
          <h3 className="text-sm font-semibold leading-tight">推送通知</h3>
          <p className="mt-1 text-xs leading-relaxed text-muted-foreground">
            CPU 飙升、错误心跳和系统升级完成时，桥接 Agent 会通过 Web Push 发送通知到这台设备。
          </p>
          {unsupported ? (
            <p className="mt-2 text-[11px] text-warning">
              当前浏览器不支持 Web Push（iOS 需 16.4+ 并通过『添加到主屏幕』启动 PWA）。
            </p>
          ) : null}
          {blocked ? (
            <p className="mt-2 text-[11px] text-destructive">
              通知权限已被拒绝，请到浏览器/系统设置中重新启用。
            </p>
          ) : null}
          {!config ? (
            <p className="mt-2 text-[11px] text-muted-foreground">先到设置页连接一个 Bridge Agent，才能订阅推送。</p>
          ) : null}
        </div>
      </div>

      <div className="mt-4 flex flex-wrap items-center gap-2">
        {subscribed ? (
          <Button variant="outline" size="sm" onClick={onDisable} disabled={busy}>
            {busy ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <BellOff className="mr-2 h-4 w-4" />}
            关闭通知
          </Button>
        ) : (
          <Button size="sm" onClick={onEnable} disabled={busy || unsupported || blocked || !config}>
            {busy ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Bell className="mr-2 h-4 w-4" />}
            开启通知
          </Button>
        )}
        <Button size="sm" variant="outline" onClick={onTest} disabled={testing || !config}>
          {testing ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Send className="mr-2 h-4 w-4" />}
          发送测试
        </Button>
      </div>
    </div>
  )
}
