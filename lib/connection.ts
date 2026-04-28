"use client"

// Client-side connection config — stored locally on the user's device.
// This is NOT app data; it's a pointer to the user's own VPS / macOS Bridge Agent.

export interface ConnectionConfig {
  agentUrl: string // e.g. https://claw.example.com   or   http://192.168.1.10:7878
  token: string // Bearer token shared with the Bridge Agent
  label?: string
}

const KEY = "claw-monitor.connection.v1"

export function loadConnection(): ConnectionConfig | null {
  if (typeof window === "undefined") return null
  try {
    const raw = window.localStorage.getItem(KEY)
    if (!raw) return null
    const parsed = JSON.parse(raw) as ConnectionConfig
    if (!parsed.agentUrl || !parsed.token) return null
    return parsed
  } catch {
    return null
  }
}

export function saveConnection(cfg: ConnectionConfig): void {
  if (typeof window === "undefined") return
  window.localStorage.setItem(KEY, JSON.stringify(cfg))
}

export function clearConnection(): void {
  if (typeof window === "undefined") return
  window.localStorage.removeItem(KEY)
}

export function normalizeAgentUrl(url: string): string {
  return url.trim().replace(/\/+$/, "")
}
</content>
<parameter name="taskNameActive">连接配置工具
