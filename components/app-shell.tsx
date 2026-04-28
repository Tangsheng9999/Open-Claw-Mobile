"use client"

import * as React from "react"
import Link from "next/link"
import { usePathname } from "next/navigation"
import {
  Activity,
  Box,
  Check,
  ChevronDown,
  Cpu,
  MessageSquare,
  Plus,
  Settings,
  Stethoscope,
} from "lucide-react"
import { cn } from "@/lib/utils"
import { ClawLogo } from "@/components/claw-logo"
import { useConnection } from "@/components/connection-provider"
import { useRealtime } from "@/lib/realtime"
import { useAgentInfo } from "@/lib/hooks"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"

const NAV = [
  { href: "/", label: "概览", icon: Activity },
  { href: "/conversations", label: "对话", icon: MessageSquare },
  { href: "/projects", label: "项目", icon: Box },
  { href: "/models", label: "模型", icon: Cpu },
  { href: "/system", label: "系统", icon: Stethoscope },
] as const

export function AppShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname()
  const { config, profiles, activate, hydrated } = useConnection()
  const rt = useRealtime()
  const { data: info } = useAgentInfo()

  // 实时连接状态：未连接 / 连接中 / 已连接 / 错误
  const dotClass = !hydrated
    ? "bg-muted-foreground/40"
    : !config
      ? "bg-muted-foreground"
      : rt.status === "open"
        ? "bg-success"
        : rt.status === "connecting"
          ? "bg-warning"
          : rt.status === "error" || rt.status === "closed"
            ? "bg-destructive"
            : "bg-warning"

  const headerLabel = config
    ? config.label || info?.hostname || displayHost(config.agentUrl)
    : hydrated
      ? "未连接"
      : "加载中"

  return (
    <div className="mx-auto flex min-h-screen w-full max-w-3xl flex-col">
      <header className="safe-top sticky top-0 z-30 border-b border-border/60 bg-background/80 px-4 py-3 backdrop-blur supports-[backdrop-filter]:bg-background/60">
        <div className="flex items-center justify-between gap-3">
          <Link href="/" className="flex items-center gap-2.5">
            <ClawLogo />
            <div className="flex flex-col leading-tight">
              <span className="text-sm font-semibold tracking-tight">Open Claw</span>
              <span className="text-[11px] text-muted-foreground">监控台</span>
            </div>
          </Link>

          <div className="flex items-center gap-1.5">
            {profiles.length > 0 ? (
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <button
                    type="button"
                    className="flex max-w-[180px] items-center gap-2 rounded-full border border-border bg-card px-3 py-1.5 text-xs"
                  >
                    <span
                      className={cn(
                        "inline-block h-1.5 w-1.5 shrink-0 rounded-full",
                        dotClass,
                        rt.status === "open" ? "claw-pulse" : "",
                      )}
                    />
                    <span className="truncate font-medium">{headerLabel}</span>
                    <ChevronDown className="h-3.5 w-3.5 text-muted-foreground" />
                  </button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="min-w-[240px]">
                  <DropdownMenuLabel className="text-[11px] uppercase tracking-wide text-muted-foreground">
                    切换 Agent
                  </DropdownMenuLabel>
                  {profiles.map((p) => (
                    <DropdownMenuItem
                      key={p.id}
                      onClick={() => activate(p.id)}
                      className="flex items-center justify-between gap-2"
                    >
                      <div className="min-w-0 flex-1">
                        <div className="truncate text-[13px]">{p.label || displayHost(p.agentUrl)}</div>
                        <div className="truncate font-mono text-[10.5px] text-muted-foreground">
                          {displayHost(p.agentUrl)}
                        </div>
                      </div>
                      {p.id === config?.id ? <Check className="h-4 w-4 text-primary" /> : null}
                    </DropdownMenuItem>
                  ))}
                  <DropdownMenuSeparator />
                  <DropdownMenuItem asChild>
                    <Link href="/settings" className="flex items-center gap-2">
                      <Plus className="h-4 w-4" />
                      添加 / 管理 Agent
                    </Link>
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            ) : (
              <Link
                href="/settings"
                className="flex items-center gap-2 rounded-full border border-border bg-card px-3 py-1.5 text-xs"
              >
                <span className={cn("inline-block h-1.5 w-1.5 rounded-full", dotClass)} />
                <span className="font-medium">未连接</span>
              </Link>
            )}

            <Link
              href="/settings"
              aria-label="设置"
              className="flex h-8 w-8 items-center justify-center rounded-full border border-border bg-card text-muted-foreground"
            >
              <Settings className="h-3.5 w-3.5" />
            </Link>
          </div>
        </div>
      </header>

      <main className="flex-1 px-4 py-4 pb-nav">{children}</main>

      <nav className="safe-bottom fixed inset-x-0 bottom-0 z-30 mx-auto w-full max-w-3xl border-t border-border/60 bg-background/85 backdrop-blur">
        <ul className="flex items-stretch justify-between px-2 py-1.5">
          {NAV.map((item) => {
            const active = pathname === item.href || (item.href !== "/" && pathname.startsWith(item.href))
            const Icon = item.icon
            return (
              <li key={item.href} className="flex-1">
                <Link
                  href={item.href}
                  className={cn(
                    "flex flex-col items-center justify-center gap-0.5 rounded-md px-2 py-1.5 text-[11px] transition-colors",
                    active ? "text-primary" : "text-muted-foreground hover:text-foreground",
                  )}
                >
                  <Icon className={cn("h-5 w-5", active && "text-primary")} />
                  <span className="font-medium">{item.label}</span>
                </Link>
              </li>
            )
          })}
        </ul>
      </nav>
    </div>
  )
}

function displayHost(url: string): string {
  try {
    const u = new URL(url)
    return u.host
  } catch {
    return url
  }
}
