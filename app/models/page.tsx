"use client"

import { AppShell } from "@/components/app-shell"
import { ConnectCta } from "@/components/connect-cta"
import { SectionHeader } from "@/components/section-header"
import { useModels } from "@/lib/hooks"
import { ModelCard } from "@/components/models/model-card"
import { AddModelDialog } from "@/components/models/add-model-dialog"

export default function ModelsPage() {
  const { data: list = [] } = useModels()
  const ready = list.filter((m) => m.status === "ready")
  const downloading = list.filter((m) => m.status === "downloading")
  const others = list.filter((m) => m.status !== "ready" && m.status !== "downloading")

  return (
    <AppShell>
      <div className="flex flex-col gap-4">
        <ConnectCta />
        <header className="flex items-end justify-between gap-3">
          <div>
            <h1 className="text-xl font-semibold tracking-tight">模型</h1>
            <p className="mt-1 text-[12px] text-muted-foreground">
              {list.length} 个已配置 · {ready.length} 就绪
              {downloading.length ? ` · ${downloading.length} 拉取中` : ""}
            </p>
          </div>
          <AddModelDialog />
        </header>

        {downloading.length ? (
          <section className="flex flex-col gap-2">
            <SectionHeader title="正在拉取" hint="本地模型下载进度" />
            <ul className="flex flex-col gap-2">
              {downloading.map((m) => (
                <ModelCard key={m.id} m={m} />
              ))}
            </ul>
          </section>
        ) : null}

        <section className="flex flex-col gap-2">
          <SectionHeader title="可用模型" />
          <ul className="flex flex-col gap-2">
            {ready.length === 0 ? (
              <li className="rounded-xl border border-dashed border-border bg-card/40 p-6 text-center text-[12px] text-muted-foreground">
                暂无就绪的模型，点上方"添加模型"或拉取一个本地模型
              </li>
            ) : (
              ready.map((m) => <ModelCard key={m.id} m={m} />)
            )}
          </ul>
        </section>

        {others.length ? (
          <section className="flex flex-col gap-2">
            <SectionHeader title="未拉取 / 异常" />
            <ul className="flex flex-col gap-2">
              {others.map((m) => (
                <ModelCard key={m.id} m={m} />
              ))}
            </ul>
          </section>
        ) : null}
      </div>
    </AppShell>
  )
}
