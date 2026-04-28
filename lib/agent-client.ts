// Agent client — talks to the user's Bridge Agent via the same-origin proxy
// at /api/agent/* (which forwards to the configured agent URL with the token).
//
// Falls back to mock data when no agent is configured, so the UI is always demo-able.

import type {
  AgentInfo,
  ClawStatus,
  Conversation,
  DiagnosticItem,
  Heartbeat,
  LogLine,
  ModelInfo,
  ModelTestResult,
  Project,
  SystemMetrics,
} from "./types"
import {
  mockAgentInfo,
  mockConversations,
  mockDiagnostics,
  mockHeartbeats,
  mockLogs,
  mockMetrics,
  mockModels,
  mockProjects,
  mockStatus,
} from "./mock-data"
import { loadConnection } from "./connection"

const PROXY_PREFIX = "/api/agent"

class AgentNotConfiguredError extends Error {
  constructor() {
    super("agent_not_configured")
    this.name = "AgentNotConfiguredError"
  }
}

async function callAgent<T>(path: string, init?: RequestInit): Promise<T> {
  const cfg = loadConnection()
  if (!cfg) throw new AgentNotConfiguredError()
  const res = await fetch(`${PROXY_PREFIX}${path}`, {
    ...init,
    headers: {
      "content-type": "application/json",
      ...(init?.headers ?? {}),
    },
    cache: "no-store",
  })
  if (!res.ok) {
    const body = await res.text().catch(() => "")
    throw new Error(`agent ${res.status}: ${body || res.statusText}`)
  }
  return (await res.json()) as T
}

async function withFallback<T>(promise: Promise<T>, fallback: T): Promise<T> {
  try {
    return await promise
  } catch (err) {
    if (err instanceof AgentNotConfiguredError) return fallback
    // Real error — bubble up so UI can show it
    throw err
  }
}

export const agentApi = {
  // Identity / health
  info: () => withFallback(callAgent<AgentInfo>("/info"), mockAgentInfo),
  ping: () => withFallback(callAgent<{ ok: true }>("/ping"), { ok: true as const }),

  // Live state
  status: () => withFallback(callAgent<ClawStatus>("/status"), mockStatus),
  metrics: () => withFallback(callAgent<SystemMetrics>("/metrics"), mockMetrics),

  // Conversations & projects
  conversations: () => withFallback(callAgent<Conversation[]>("/conversations"), mockConversations),
  projects: () => withFallback(callAgent<Project[]>("/projects"), mockProjects),
  heartbeats: () => withFallback(callAgent<Heartbeat[]>("/heartbeats"), mockHeartbeats),
  logs: (limit = 100) =>
    withFallback(callAgent<LogLine[]>(`/logs?limit=${limit}`), mockLogs.slice(0, limit)),

  // Models
  models: () => withFallback(callAgent<ModelInfo[]>("/models"), mockModels),
  setDefaultModel: (id: string) =>
    callAgent<{ ok: true }>(`/models/default`, {
      method: "POST",
      body: JSON.stringify({ id }),
    }),
  addModel: (input: { id: string; provider: string; apiKey?: string; baseUrl?: string }) =>
    callAgent<ModelInfo>(`/models`, {
      method: "POST",
      body: JSON.stringify(input),
    }),
  pullModel: (id: string) =>
    callAgent<{ ok: true }>(`/models/pull`, {
      method: "POST",
      body: JSON.stringify({ id }),
    }),
  testModel: (id: string, prompt = "Say hi in 5 words.") =>
    callAgent<ModelTestResult>(`/models/test`, {
      method: "POST",
      body: JSON.stringify({ id, prompt }),
    }),
  removeModel: (id: string) =>
    callAgent<{ ok: true }>(`/models/${encodeURIComponent(id)}`, { method: "DELETE" }),

  // System control
  restartGateway: () => callAgent<{ ok: true }>(`/system/restart-gateway`, { method: "POST" }),
  restartClaw: () => callAgent<{ ok: true }>(`/system/restart-claw`, { method: "POST" }),
  upgradeClaw: () => callAgent<{ ok: true; output: string }>(`/system/upgrade`, { method: "POST" }),
  diagnostics: () => withFallback(callAgent<DiagnosticItem[]>(`/diagnostics`), mockDiagnostics),

  // Connection probe (against /api/agent/ping with custom config — used by settings)
  probe: async (agentUrl: string, token: string) => {
    const res = await fetch(`/api/agent/ping`, {
      method: "GET",
      headers: {
        "x-claw-agent-url": agentUrl,
        "x-claw-agent-token": token,
      },
      cache: "no-store",
    })
    if (!res.ok) {
      const body = await res.text().catch(() => "")
      throw new Error(`probe ${res.status}: ${body || res.statusText}`)
    }
    return (await res.json()) as { ok: true; info?: AgentInfo }
  },
}

export { AgentNotConfiguredError }
</content>
<parameter name="taskNameActive">编写 Agent 客户端
