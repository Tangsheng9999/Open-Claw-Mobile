"use client"

import { Cpu, Hash } from "lucide-react"
import { AppShell } from "@/components/app-shell"
import { ConnectCta } from "@/components/connect-cta"
import { SectionHeader } from "@/components/section-header"
import { StatusDot } from "@/components/status-dot"
import { useConversations } from "@/lib/hooks"
import { formatRelative } from "@/lib/format"
import { cn } from "@/lib/utils"
import { channelIcon, channelLabel } from "@/components/channel-icon"

export default function ConversationsPage() {
  const { data: list = [] } = useConversations()
  const active = list.filter((c) => c.status === "active")
  const others = list.filter((c) => c.status !== "active")

  return (
    <AppShell>
      <div className="flex flex-col gap-4">
        <ConnectCta />
        <header className="flex flex-col gap-1.5">
          <h1 className="text-xl font-semibold tracking-tight">对话</h1>
          <p className="text-[12px] text-muted-foreground">
            正在进行中的所有对话，按渠道聚合 — 共 {list.length} 个，{active.length} 个活跃
          </p>
        </header>

        <section className="flex flex-col gap-2">
          <SectionHeader title="进行中" />
          <ConvoList items={active} />
        </section>

        <section className="flex flex-col gap-2">
          <SectionHeader title="其他" />
          <ConvoList items={others} />
        </section>
      </div>
    </AppShell>
  )
}

function ConvoList({ items }: { items: ReturnType<typeof useConversations>["data"] extends infer T ? T extends Array<infer U> ? U[] : never : never }) {
  if (!items || items.length === 0) {
    return (
      <div className="rounded-xl border border-dashed border-border bg-card/40 p-6 text-center text-[12px] text-muted-foreground">
        没有匹配的对话
      </div>
    )
  }
  return (
    <ul className="flex flex-col gap-2">
      {items.map((c) => {
        const Icon = channelIcon(c.channel)
        const dot = c.status === "active" ? "online" : c.status === "waiting" ? "warn" : "idle"
        return (
          <li key={c.id} className="rounded-xl border border-border bg-card p-3.5">
            <div className="flex items-start gap-3">
              <span
                className={cn(
                  "inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-md bg-muted text-muted-foreground",
                  c.status === "active" && "bg-primary/15 text-primary",
                )}
              >
                <Icon className="h-4.5 w-4.5" />
              </span>
              <div className="min-w-0 flex-1">
                <div className="flex items-center justify-between gap-2">
                  <span className="truncate text-[14px] font-medium">{c.title}</span>
                  <span className="shrink-0 text-[11px] text-muted-foreground">{formatRelative(c.lastMessageAt)}</span>
                </div>
                <p className="mt-1 line-clamp-2 text-[12.5px] leading-snug text-muted-foreground text-pretty">
                  {c.lastMessagePreview}
                </p>
                <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 text-[11px] text-muted-foreground">
                  <span className="inline-flex items-center gap-1">
                    <StatusDot variant={dot} pulse={c.status === "active"} />
                    {c.status === "active" ? "活跃" : c.status === "waiting" ? "等待回复" : "空闲"}
                  </span>
                  <span className="inline-flex items-center gap-1 font-mono">
                    <Cpu className="h-3 w-3" />
                    {c.model}
                  </span>
                  <span className="inline-flex items-center gap-1 font-mono">
                    <Hash className="h-3 w-3" />
                    {c.tokenUsage.toLocaleString()} tok
                  </span>
                  <span className="text-muted-foreground/70">{channelLabel(c.channel)}</span>
                </div>
              </div>
            </div>
          </li>
        )
      })}
    </ul>
  )
}
</content>
<parameter name="taskNameActive">对话页
