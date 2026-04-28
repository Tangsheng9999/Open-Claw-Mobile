import { AppShell } from "@/components/app-shell"
import { ConnectCta } from "@/components/connect-cta"
import { StatusHero } from "@/components/dashboard/status-hero"
import { QuickMetrics } from "@/components/dashboard/quick-metrics"
import { RecentHeartbeats } from "@/components/dashboard/recent-heartbeats"
import { SectionHeader } from "@/components/section-header"

export default function DashboardPage() {
  return (
    <AppShell>
      <div className="flex flex-col gap-4">
        <ConnectCta />
        <StatusHero />
        <section className="flex flex-col gap-2">
          <SectionHeader title="实时指标" hint="每 5 秒刷新一次" />
          <QuickMetrics />
        </section>
        <section className="flex flex-col gap-2">
          <SectionHeader title="最近心跳" hint="主进程的实时事件" href="/system" />
          <RecentHeartbeats />
        </section>
      </div>
    </AppShell>
  )
}
</content>
<parameter name="taskNameActive">仪表盘主页
