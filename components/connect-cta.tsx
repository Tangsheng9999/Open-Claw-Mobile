"use client"

import Link from "next/link"
import { ArrowRight, Plug } from "lucide-react"
import { useConnection } from "@/components/connection-provider"

export function ConnectCta() {
  const { config, hydrated } = useConnection()
  if (!hydrated || config) return null
  return (
    <div className="rounded-xl border border-dashed border-primary/40 bg-primary/5 p-4">
      <div className="flex items-start gap-3">
        <span className="mt-0.5 inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-md bg-primary/15 text-primary">
          <Plug className="h-4.5 w-4.5" />
        </span>
        <div className="min-w-0 flex-1">
          <p className="text-sm font-semibold">尚未连接到 Bridge Agent</p>
          <p className="mt-1 text-[12px] leading-relaxed text-muted-foreground">
            当前显示的是演示数据。把 Bridge Agent 安装到你的 VPS / macOS 上，然后填入地址和 Token 即可开始监控。
          </p>
          <Link
            href="/settings"
            className="mt-3 inline-flex items-center gap-1.5 rounded-md bg-primary px-3 py-1.5 text-[12px] font-medium text-primary-foreground"
          >
            前往连接
            <ArrowRight className="h-3.5 w-3.5" />
          </Link>
        </div>
      </div>
    </div>
  )
}
