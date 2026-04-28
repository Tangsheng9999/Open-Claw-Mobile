"use client"

import { CheckCircle2, CircleDashed, CircleDot, PauseCircle, XCircle } from "lucide-react"
import { AppShell } from "@/components/app-shell"
import { ConnectCta } from "@/components/connect-cta"
import { SectionHeader } from "@/components/section-header"
import { useProjects } from "@/lib/hooks"
import { formatRelative } from "@/lib/format"
import { Progress } from "@/components/ui/progress"
import type { Project } from "@/lib/types"

const STATUS_META: Record<Project["status"], { label: string; tone: string; Icon: typeof CircleDot }> = {
  running: { label: "运行中", tone: "text-primary", Icon: CircleDot },
  queued: { label: "队列中", tone: "text-muted-foreground", Icon: CircleDashed },
  paused: { label: "已暂停", tone: "text-warning", Icon: PauseCircle },
  done: { label: "已完成", tone: "text-success", Icon: CheckCircle2 },
  failed: { label: "失败", tone: "text-destructive", Icon: XCircle },
}

export default function ProjectsPage() {
  const { data: list = [] } = useProjects()
  const running = list.filter((p) => p.status === "running")
  const others = list.filter((p) => p.status !== "running")

  return (
    <AppShell>
      <div className="flex flex-col gap-4">
        <ConnectCta />
        <header className="flex flex-col gap-1.5">
          <h1 className="text-xl font-semibold tracking-tight">项目</h1>
          <p className="text-[12px] text-muted-foreground">
            OpenClaw 当前在执行的所有任务 — {list.length} 个总计 · {running.length} 个运行中
          </p>
        </header>

        <section className="flex flex-col gap-2">
          <SectionHeader title="运行中" />
          <ProjectList items={running} />
        </section>

        <section className="flex flex-col gap-2">
          <SectionHeader title="其他" />
          <ProjectList items={others} />
        </section>
      </div>
    </AppShell>
  )
}

function ProjectList({ items }: { items: Project[] }) {
  if (items.length === 0) {
    return (
      <div className="rounded-xl border border-dashed border-border bg-card/40 p-6 text-center text-[12px] text-muted-foreground">
        没有匹配的项目
      </div>
    )
  }
  return (
    <ul className="flex flex-col gap-2">
      {items.map((p) => {
        const meta = STATUS_META[p.status]
        const Icon = meta.Icon
        return (
          <li key={p.id} className="rounded-xl border border-border bg-card p-3.5">
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2">
                  <Icon className={`h-4 w-4 shrink-0 ${meta.tone}`} />
                  <span className="truncate font-mono text-[13.5px] font-medium">{p.name}</span>
                </div>
                <p className="mt-1 line-clamp-2 text-[12.5px] leading-snug text-muted-foreground text-pretty">
                  {p.description}
                </p>
              </div>
              <span className={`shrink-0 text-[11px] font-medium ${meta.tone}`}>{meta.label}</span>
            </div>
            <div className="mt-3 flex items-center gap-3">
              <Progress value={p.progress} className="h-1.5 flex-1" />
              <span className="font-mono text-[11px] text-muted-foreground">
                {p.tasksDone}/{p.tasksTotal}
              </span>
            </div>
            <div className="mt-2 flex items-center justify-between text-[11px] text-muted-foreground">
              <span>开始：{formatRelative(p.startedAt)}</span>
              <span>更新：{formatRelative(p.lastActivityAt)}</span>
            </div>
          </li>
        )
      })}
    </ul>
  )
}
