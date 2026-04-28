"use client"

import * as React from "react"
import {
  type ConnectionConfig,
  loadStore,
  saveConnection as persistConnection,
  removeProfile as removeProfileStore,
  activateProfile as activateProfileStore,
  clearConnection,
} from "@/lib/connection"
import { RealtimeProvider } from "@/lib/realtime"

type ConnectionState = {
  /** 当前激活的 Agent 配置；nil 表示尚未连接 */
  config: ConnectionConfig | null
  /** 全部已保存的 Agent 列表 */
  profiles: ConnectionConfig[]
  /** 创建或更新一个 profile，并把它设为活动 */
  setConfig: (cfg: Omit<ConnectionConfig, "id" | "createdAt"> & { id?: string }) => ConnectionConfig
  /** 删除指定 profile */
  removeProfile: (id: string) => void
  /** 切换到指定 profile */
  activate: (id: string) => void
  /** 移除所有连接配置 */
  disconnect: () => void
  /** SSR 完毕后置 true（避免 hydration mismatch） */
  hydrated: boolean
}

const Ctx = React.createContext<ConnectionState | null>(null)

function syncCookies(cfg: ConnectionConfig | null) {
  if (typeof document === "undefined") return
  if (cfg) {
    document.cookie = `claw_agent_url=${encodeURIComponent(cfg.agentUrl)}; path=/; samesite=lax; max-age=31536000`
    document.cookie = `claw_agent_token=${encodeURIComponent(cfg.token)}; path=/; samesite=lax; max-age=31536000`
  } else {
    document.cookie = `claw_agent_url=; path=/; max-age=0`
    document.cookie = `claw_agent_token=; path=/; max-age=0`
  }
}

export function ConnectionProvider({ children }: { children: React.ReactNode }) {
  const [profiles, setProfiles] = React.useState<ConnectionConfig[]>([])
  const [activeId, setActiveId] = React.useState<string | null>(null)
  const [hydrated, setHydrated] = React.useState(false)

  React.useEffect(() => {
    const store = loadStore()
    setProfiles(store.profiles)
    setActiveId(store.activeId)
    setHydrated(true)
    const active = store.profiles.find((p) => p.id === store.activeId) ?? null
    syncCookies(active)
  }, [])

  const config = React.useMemo(
    () => profiles.find((p) => p.id === activeId) ?? null,
    [profiles, activeId],
  )

  const setConfig = React.useCallback(
    (cfg: Omit<ConnectionConfig, "id" | "createdAt"> & { id?: string }) => {
      const saved = persistConnection(cfg)
      const store = loadStore()
      setProfiles(store.profiles)
      setActiveId(store.activeId)
      syncCookies(saved)
      return saved
    },
    [],
  )

  const removeProfile = React.useCallback((id: string) => {
    removeProfileStore(id)
    const store = loadStore()
    setProfiles(store.profiles)
    setActiveId(store.activeId)
    const active = store.profiles.find((p) => p.id === store.activeId) ?? null
    syncCookies(active)
  }, [])

  const activate = React.useCallback((id: string) => {
    activateProfileStore(id)
    const store = loadStore()
    setProfiles(store.profiles)
    setActiveId(store.activeId)
    const active = store.profiles.find((p) => p.id === store.activeId) ?? null
    syncCookies(active)
  }, [])

  const disconnect = React.useCallback(() => {
    clearConnection()
    setProfiles([])
    setActiveId(null)
    syncCookies(null)
  }, [])

  return (
    <Ctx.Provider
      value={{ config, profiles, setConfig, removeProfile, activate, disconnect, hydrated }}
    >
      <RealtimeProvider config={config}>{children}</RealtimeProvider>
    </Ctx.Provider>
  )
}

export function useConnection() {
  const ctx = React.useContext(Ctx)
  if (!ctx) throw new Error("useConnection must be used inside <ConnectionProvider>")
  return ctx
}
