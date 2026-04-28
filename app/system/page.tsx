import { AppShell } from "@/components/app-shell"
import { SectionHeader } from "@/components/section-header"
import { ActionCard } from "@/components/system/action-card"
import { DiagnosticsPanel } from "@/components/system/diagnostics-panel"
import { RotateCcw, ArrowUpCircle, Trash2, Power } from "lucide-react"

export default function SystemPage() {
  return (
    <AppShell title="系统控制" subtitle="网关、升级与诊断">
      <DiagnosticsPanel />

      <div>
        <SectionHeader title="运维操作" subtitle="重启、升级与维护" />
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <ActionCard
            icon={RotateCcw}
            title="重启网关"
            description="重启 OpenClaw 模型路由网关，清空连接池但保留会话历史。"
            endpoint="/api/system/gateway/restart"
            buttonLabel="重启网关"
            confirmTitle="确认重启网关？"
            confirmDescription="网关会中断 5-10 秒，正在进行的请求可能失败。"
          />
          <ActionCard
            icon={ArrowUpCircle}
            title="升级系统"
            description="拉取最新 OpenClaw 版本并自动重启，建议在低峰期执行。"
            endpoint="/api/system/upgrade"
            buttonLabel="检查并升级"
            confirmTitle="确认升级 OpenClaw？"
            confirmDescription="将运行 npm i -g openclaw@latest 并重启服务，预计 30 秒。"
          />
          <ActionCard
            icon={Trash2}
            title="清理缓存"
            description="清空模型响应缓存与临时文件，释放磁盘空间。"
            endpoint="/api/system/cache/clear"
            buttonLabel="清理缓存"
            confirmTitle="清理缓存？"
            confirmDescription="该操作不可撤销，将清理所有本地响应缓存。"
          />
          <ActionCard
            icon={Power}
            title="停止服务"
            description="停止 OpenClaw 主进程，所有会话与监听器都会断开。"
            endpoint="/api/system/stop"
            buttonLabel="停止服务"
            destructive
            confirmTitle="确认停止 OpenClaw？"
            confirmDescription="停止后需要在 VPS 上手动启动，或等待 systemd 自动拉起。"
          />
        </div>
      </div>
    </AppShell>
  )
}
