"use client"

import * as React from "react"
import { type ConnectionConfig, loadConnection, saveConnection, clearConnection } from "@/lib/connection"

type ConnectionState = {
  config: ConnectionConfig | null
  setConfig: (cfg: ConnectionConfig) => void
  disconnect: () => void
  hydrated: boolean
}

const Ctx = React.createContext<ConnectionState | null>(null)

export function ConnectionProvider({ children }: { children: React.ReactNode }) {
  const [config, setConfigState] = React.useState<ConnectionConfig | null>(null)
  const [hydrated, setHydrated] = React.useState(false)

  React.useEffect(() => {
    setConfigState(loadConnection())
    setHydrated(true)

    // Push config into cookies so the same-origin proxy at /api/agent/* can read it.
    const sync = () => {
      const c = loadConnection()
      if (c) {
        document.cookie = `claw_agent_url=${encodeURIComponent(c.agentUrl)}; path=/; samesite=lax; max-age=31536000`
        document.cookie = `claw_agent_token=${encodeURIComponent(c.token)}; path=/; samesite=lax; max-age=31536000`
      } else {
        document.cookie = `claw_agent_url=; path=/; max-age=0`
        document.cookie = `claw_agent_token=; path=/; max-age=0`
      }
    }
    sync()
  }, [])

  const setConfig = React.useCallback((cfg: ConnectionConfig) => {
    saveConnection(cfg)
    setConfigState(cfg)
    document.cookie = `claw_agent_url=${encodeURIComponent(cfg.agentUrl)}; path=/; samesite=lax; max-age=31536000`
    document.cookie = `claw_agent_token=${encodeURIComponent(cfg.token)}; path=/; samesite=lax; max-age=31536000`
  }, [])

  const disconnect = React.useCallback(() => {
    clearConnection()
    setConfigState(null)
    document.cookie = `claw_agent_url=; path=/; max-age=0`
    document.cookie = `claw_agent_token=; path=/; max-age=0`
  }, [])

  return <Ctx.Provider value={{ config, setConfig, disconnect, hydrated }}>{children}</Ctx.Provider>
}

export function useConnection() {
  const ctx = React.useContext(Ctx)
  if (!ctx) throw new Error("useConnection must be used inside <ConnectionProvider>")
  return ctx
}
</content>
<parameter name="taskNameActive">连接 Provider
