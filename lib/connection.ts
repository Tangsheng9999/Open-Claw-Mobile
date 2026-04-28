"use client"

// 客户端连接配置 — 仅保存在用户设备本地（localStorage + cookie）。
// 这是指向用户自有 VPS / macOS Bridge Agent 的指针，不是应用数据。
//
// 支持多 Agent：profiles[] + activeId，可在顶部下拉切换。
// 自动迁移旧版（claw-monitor.connection.v1，单条）数据到 v2。

export interface ConnectionConfig {
  id: string
  agentUrl: string // e.g. https://claw.example.com   或   http://192.168.1.10:7878
  token: string // 与 Bridge Agent 共享的 Bearer token
  label?: string
  createdAt: string
}

interface ConnectionStore {
  version: 2
  activeId: string | null
  profiles: ConnectionConfig[]
}

const KEY_V2 = "claw-monitor.connections.v2"
const KEY_V1 = "claw-monitor.connection.v1"

function emptyStore(): ConnectionStore {
  return { version: 2, activeId: null, profiles: [] }
}

function migrateFromV1(raw: string): ConnectionStore | null {
  try {
    const v1 = JSON.parse(raw) as { agentUrl?: string; token?: string; label?: string }
    if (!v1.agentUrl || !v1.token) return null
    const id = makeId()
    return {
      version: 2,
      activeId: id,
      profiles: [
        {
          id,
          agentUrl: v1.agentUrl,
          token: v1.token,
          label: v1.label,
          createdAt: new Date().toISOString(),
        },
      ],
    }
  } catch {
    return null
  }
}

export function loadStore(): ConnectionStore {
  if (typeof window === "undefined") return emptyStore()
  try {
    const raw = window.localStorage.getItem(KEY_V2)
    if (raw) {
      const parsed = JSON.parse(raw) as ConnectionStore
      if (parsed.version === 2 && Array.isArray(parsed.profiles)) return parsed
    }
    const v1raw = window.localStorage.getItem(KEY_V1)
    if (v1raw) {
      const migrated = migrateFromV1(v1raw)
      if (migrated) {
        window.localStorage.setItem(KEY_V2, JSON.stringify(migrated))
        window.localStorage.removeItem(KEY_V1)
        return migrated
      }
    }
  } catch {
    // fall through
  }
  return emptyStore()
}

export function saveStore(store: ConnectionStore) {
  if (typeof window === "undefined") return
  window.localStorage.setItem(KEY_V2, JSON.stringify(store))
}

// 兼容旧调用：单条配置入口
export function loadConnection(): ConnectionConfig | null {
  const s = loadStore()
  if (!s.activeId) return null
  return s.profiles.find((p) => p.id === s.activeId) ?? null
}

export function saveConnection(cfg: Omit<ConnectionConfig, "id" | "createdAt"> & { id?: string }): ConnectionConfig {
  const store = loadStore()
  const id = cfg.id ?? makeId()
  const existing = store.profiles.find((p) => p.id === id)
  const next: ConnectionConfig = {
    id,
    agentUrl: cfg.agentUrl,
    token: cfg.token,
    label: cfg.label,
    createdAt: existing?.createdAt ?? new Date().toISOString(),
  }
  store.profiles = existing
    ? store.profiles.map((p) => (p.id === id ? next : p))
    : [...store.profiles, next]
  store.activeId = id
  saveStore(store)
  return next
}

export function removeProfile(id: string) {
  const store = loadStore()
  store.profiles = store.profiles.filter((p) => p.id !== id)
  if (store.activeId === id) store.activeId = store.profiles[0]?.id ?? null
  saveStore(store)
}

export function activateProfile(id: string) {
  const store = loadStore()
  if (store.profiles.some((p) => p.id === id)) {
    store.activeId = id
    saveStore(store)
  }
}

export function clearConnection(): void {
  if (typeof window === "undefined") return
  window.localStorage.removeItem(KEY_V2)
  window.localStorage.removeItem(KEY_V1)
}

export function normalizeAgentUrl(url: string): string {
  return url.trim().replace(/\/+$/, "")
}

function makeId(): string {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
    return crypto.randomUUID()
  }
  return `agt_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`
}
