"use client"

import { ArrowUpCircle, Power, RotateCcw, Trash2 } from "lucide-react"
import { AppShell } from "@/components/app-shell"
import { ConnectCta } from "@/components/connect-cta"
import { SectionHeader } from "@/components/section-header"
import { ActionCard } from "@/components/system/action-card"
import { DiagnosticsPanel } from "@/components/system/diagnostics-panel"
import { PushCard } from "@/components/system/push-card"
import { LogStream } from "@/components/system/log-stream"
import { agentApi } from "@/lib/agent-client"

export default function SystemPage() {
  return (
    <AppShell>
      <div className="flex flex-col gap-4">
        <ConnectCta />
        <header className="flex flex-col gap-1.5">
          <h1 className="text-xl font-semibold tracking-tight">系统控制</h1>
          <p className="text-[12px] text-muted-foreground">网关、升级、推送通知与诊断 — 所有操作直达你 VPS / Mac 上的 Bridge Agent</p>
        </header>

        <DiagnosticsPanel />

        <PushCard />

        <section className="flex flex-col gap-2">
          <SectionHeader title="运维操作" hint="重启、升级与维护" />
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <ActionCard
              icon={RotateCcw}
              title="重启网关"
              description="重启 OpenClaw 模型路由网关，清空连接池但保留会话历史。"
              buttonLabel="重启网关"
              confirmTitle="确认重启网关？"
              confirmDescription="网关会中断 5-10 秒，正在进行的请求可能失败。"
              action={() => agentApi.restartGateway()}
            />
            <ActionCard
              icon={RotateCcw}
              title="重启 OpenClaw"
              description="重启 OpenClaw 主进程；当前正在执行的项目会被中断。"
              buttonLabel="重启服务"
              confirmTitle="确认重启 OpenClaw？"
              confirmDescription="所有进行中的会话与心跳会被打断，systemd / launchd 会自动拉起。"
              action={() => agentApi.restartClaw()}
            />
            <ActionCard
              icon={ArrowUpCircle}
              title="升级 OpenClaw"
              description="拉取最新 OpenClaw 版本并自动重启，建议在低峰期执行。"
              buttonLabel="检查并升级"
              confirmTitle="确认升级 OpenClaw？"
              confirmDescription="将运行 npm i -g openclaw@latest 并重启服务，预计 30 秒。"
              action={() => agentApi.upgradeClaw()}
            />
            <ActionCard
              icon={Trash2}
              title="清理缓存"
              description="清空模型响应缓存与临时文件，释放磁盘空间。"
              buttonLabel="清理缓存"
              confirmTitle="清理缓存？"
              confirmDescription="该操作不可撤销，将清理所有本地响应缓存。"
              action={() => agentApi.clearCache()}
            />
            <ActionCard
              icon={Power}
              title="停止服务"
              description="停止 OpenClaw 主进程，所有会话与监听器都会断开。"
              buttonLabel="停止服务"
              destructive
              confirmTitle="确认停止 OpenClaw？"
              confirmDescription="停止后需要在 VPS 上手动启动，或等待 systemd / launchd 自动拉起。"
              action={() => agentApi.stopClaw()}
            />
          </div>
        </section>

        <section className="flex flex-col gap-2">
          <SectionHeader title="实时日志" hint="WebSocket 推送 · 最近 200 条" />
          <LogStream />
        </section>
      </div>
    </AppShell>
  )
}
