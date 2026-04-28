"use client"

// 浏览器直连 Bridge Agent 的 /ws 端点，把推送的事件喂回 SWR 缓存与本地订阅者。
//
// 使用：在最顶层 <RealtimeProvider> 下 mount 一次即可。其他组件通过 useRealtime() 读连接状态，
// 业务数据则通过 useStatus / useMetrics 等 SWR hook 自动接收，因为我们直接 mutate 它们的 key。

import * as React from "react"
import { mutate } from "swr"
import type { ConnectionConfig } from "./connection"
import type {
  ClawStatus,
  Conversation,
  Heartbeat,
  LogLine,
  Project,
  SystemMetrics,
  WsEvent,
} from "./types"

export type RealtimeStatus = "idle" | "connecting" | "open" | "closed" | "error"

interface RealtimeState {
  status: RealtimeStatus
  lastEventAt: number | null
  error: string | null
}

const Ctx = React.createContext<RealtimeState>({
  status: "idle",
  lastEventAt: null,
  error: null,
})

function buildWsUrl(cfg: ConnectionConfig): string {
  const u = new URL(cfg.agentUrl)
  u.protocol = u.protocol === "https:" ? "wss:" : "ws:"
  u.pathname = "/ws"
  u.searchParams.set("token", cfg.token)
  return u.toString()
}

export function RealtimeProvider({
  config,
  children,
}: {
  config: ConnectionConfig | null
  children: React.ReactNode
}) {
  const [state, setState] = React.useState<RealtimeState>({
    status: "idle",
    lastEventAt: null,
    error: null,
  })

  // 缓冲日志/心跳，避免每条事件都触发 mutate
  const heartbeatBuf = React.useRef<Heartbeat[]>([])
  const logBuf = React.useRef<LogLine[]>([])
  const flushTimer = React.useRef<ReturnType<typeof setInterval> | null>(null)

  React.useEffect(() => {
    if (!config) {
      setState({ status: "idle", lastEventAt: null, error: null })
      return
    }
    let ws: WebSocket | null = null
    let reconnect: ReturnType<typeof setTimeout> | null = null
    let attempt = 0
    let cancelled = false

    flushTimer.current = setInterval(() => {
      if (heartbeatBuf.current.length) {
        const items = heartbeatBuf.current.slice()
        heartbeatBuf.current = []
        mutate(
          "agent.heartbeats",
          (current?: Heartbeat[]) => mergeById([...items, ...(current ?? [])]).slice(0, 100),
          { revalidate: false },
        )
      }
      if (logBuf.current.length) {
        const items = logBuf.current.slice()
        logBuf.current = []
        mutate(
          (key) => Array.isArray(key) && key[0] === "agent.logs",
          (current?: LogLine[]) => mergeLogs([...items, ...(current ?? [])]).slice(0, 200),
          { revalidate: false },
        )
      }
    }, 500)

    function connect() {
      if (cancelled || !config) return
      setState((s) => ({ ...s, status: "connecting", error: null }))
      try {
        ws = new WebSocket(buildWsUrl(config))
      } catch (err) {
        setState({ status: "error", lastEventAt: null, error: err instanceof Error ? err.message : String(err) })
        scheduleReconnect()
        return
      }

      ws.onopen = () => {
        attempt = 0
        setState({ status: "open", lastEventAt: Date.now(), error: null })
      }
      ws.onmessage = (e) => {
        let evt: WsEvent
        try {
          evt = JSON.parse(typeof e.data === "string" ? e.data : "") as WsEvent
        } catch {
          return
        }
        setState((s) => ({ ...s, lastEventAt: Date.now() }))
        handleEvent(evt, heartbeatBuf, logBuf)
      }
      ws.onerror = () => {
        setState((s) => ({ ...s, status: "error", error: "ws error" }))
      }
      ws.onclose = () => {
        if (cancelled) return
        setState((s) => ({ ...s, status: "closed" }))
        scheduleReconnect()
      }
    }

    function scheduleReconnect() {
      if (cancelled) return
      attempt++
      const delay = Math.min(15000, 1000 * 2 ** Math.min(attempt, 4))
      reconnect = setTimeout(connect, delay)
    }

    connect()

    return () => {
      cancelled = true
      if (reconnect) clearTimeout(reconnect)
      if (flushTimer.current) clearInterval(flushTimer.current)
      flushTimer.current = null
      try {
        ws?.close()
      } catch {
        // ignore
      }
    }
  }, [config?.agentUrl, config?.token, config])

  return <Ctx.Provider value={state}>{children}</Ctx.Provider>
}

export function useRealtime() {
  return React.useContext(Ctx)
}

function handleEvent(
  evt: WsEvent,
  heartbeatBuf: React.MutableRefObject<Heartbeat[]>,
  logBuf: React.MutableRefObject<LogLine[]>,
) {
  switch (evt.type) {
    case "metrics":
      mutate<SystemMetrics>("agent.metrics", evt.data, { revalidate: false })
      break
    case "status":
      mutate<ClawStatus>("agent.status", evt.data, { revalidate: false })
      break
    case "heartbeat":
      heartbeatBuf.current.push(evt.data)
      break
    case "log":
      logBuf.current.push(evt.data)
      break
    case "conversation.update":
      mutate<Conversation[]>(
        "agent.conversations",
        (current) => mergeConv(current ?? [], evt.data),
        { revalidate: false },
      )
      break
    case "project.update":
      mutate<Project[]>(
        "agent.projects",
        (current) => mergeProj(current ?? [], evt.data),
        { revalidate: false },
      )
      break
    case "model.pull.progress":
      mutate(
        "agent.models",
        (current?: { id: string; pullProgress?: number; status?: string }[]) =>
          (current ?? []).map((m) =>
            m.id === evt.data.id
              ? { ...m, pullProgress: evt.data.progress, status: evt.data.progress >= 100 ? "ready" : "downloading" }
              : m,
          ),
        { revalidate: false },
      )
      break
    case "hello":
      // 仅打个时间戳
      break
  }
}

function mergeById<T extends { id: string }>(items: T[]): T[] {
  const seen = new Set<string>()
  const out: T[] = []
  for (const it of items) {
    if (seen.has(it.id)) continue
    seen.add(it.id)
    out.push(it)
  }
  return out
}

function mergeLogs(items: LogLine[]): LogLine[] {
  const seen = new Set<string>()
  const out: LogLine[] = []
  for (const it of items) {
    const key = it.ts + it.message
    if (seen.has(key)) continue
    seen.add(key)
    out.push(it)
  }
  return out
}

function mergeConv(list: Conversation[], next: Conversation): Conversation[] {
  const i = list.findIndex((x) => x.id === next.id)
  if (i < 0) return [next, ...list]
  const out = list.slice()
  out[i] = next
  return out
}

function mergeProj(list: Project[], next: Project): Project[] {
  const i = list.findIndex((x) => x.id === next.id)
  if (i < 0) return [next, ...list]
  const out = list.slice()
  out[i] = next
  return out
}
