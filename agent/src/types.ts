// 与 PWA 端共享的接口契约（保持字段同步）
export interface Heartbeat {
  ts: string
  cpu: number
  memory: number
  loadAvg: number[]
  activeRequests: number
  queuedRequests: number
}

export interface SystemStatus {
  hostname: string
  platform: string
  uptimeSec: number
  openclawVersion: string
  defaultModel: string
  gatewayHealthy: boolean
  activeSessions: number
  totalRequestsToday: number
  tokensUsedToday: number
  lastError: string | null
  bridgeVersion: string
}

export interface Conversation {
  id: string
  title: string
  channel: "cli" | "api" | "web" | "mcp"
  model: string
  startedAt: string
  lastMessageAt: string
  messageCount: number
  tokensUsed: number
  status: "running" | "idle" | "error"
}

export interface Project {
  id: string
  name: string
  path: string
  activeAgents: number
  lastActivityAt: string
  status: "active" | "paused" | "error"
}

export interface ModelInfo {
  id: string
  name: string
  provider: string
  type: "local" | "remote"
  status: "ready" | "pulling" | "error" | "missing"
  sizeBytes?: number
  contextLength?: number
  isDefault: boolean
  pullProgress?: number
}

export interface DiagnosticCheck {
  id: string
  name: string
  status: "pass" | "warn" | "fail"
  detail: string
  latencyMs?: number
}

export type WSMessage =
  | { type: "heartbeat"; data: Heartbeat }
  | { type: "status"; data: SystemStatus }
  | { type: "conversation:update"; data: Conversation }
  | { type: "log"; data: { ts: string; level: string; message: string } }
