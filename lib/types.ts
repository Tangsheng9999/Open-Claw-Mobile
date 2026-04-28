// Shared types between PWA client and Bridge Agent

export type ConnectionStatus = "connected" | "connecting" | "disconnected" | "error" | "unconfigured"

export type AgentHealth = "healthy" | "degraded" | "down"

export interface AgentInfo {
  hostname: string
  platform: "darwin" | "linux" | string
  arch: string
  uptimeSec: number
  bridgeVersion: string
  openclawVersion: string | null
  openclawInstalled: boolean
}

export interface SystemMetrics {
  cpuPercent: number
  memUsedMb: number
  memTotalMb: number
  diskUsedGb: number
  diskTotalGb: number
  loadAvg: [number, number, number]
}

export interface ClawStatus {
  running: boolean
  pid: number | null
  startedAt: string | null
  health: AgentHealth
  activeConversations: number
  activeProjects: number
  pendingHeartbeats: number
  currentModel: string | null
  gateway: GatewayStatus
}

export interface GatewayStatus {
  running: boolean
  port: number
  url: string
  requestsPerMin: number
  errorsPerMin: number
}

export interface Conversation {
  id: string
  title: string
  channel: "telegram" | "whatsapp" | "imessage" | "discord" | "cli" | "api" | "web" | "mcp" | string
  participant: string
  lastMessageAt: string
  lastMessagePreview: string
  status: "active" | "idle" | "waiting"
  model: string
  tokenUsage: number
}

export interface Project {
  id: string
  name: string
  description: string
  status: "running" | "queued" | "paused" | "done" | "failed"
  progress: number // 0-100
  startedAt: string
  lastActivityAt: string
  tasksDone: number
  tasksTotal: number
}

export interface Heartbeat {
  id: string
  timestamp: string
  source: string
  message: string
  level: "info" | "warn" | "error"
}

export interface ModelInfo {
  id: string
  name: string
  provider: string // "openai" | "anthropic" | "ollama" | "openrouter" | custom
  family: string
  contextWindow: number
  status: "ready" | "downloading" | "error" | "not_pulled"
  sizeMb?: number
  isDefault: boolean
  isLocal: boolean
  lastUsedAt?: string
  pullProgress?: number // 0-100 when downloading
}

export interface ModelTestResult {
  modelId: string
  ok: boolean
  latencyMs: number
  tokensPerSec?: number
  sample?: string
  error?: string
}

export interface DiagnosticItem {
  id: string
  label: string
  status: "pass" | "warn" | "fail" | "running"
  detail: string
  fixHint?: string
}

export interface LogLine {
  ts: string
  level: "info" | "warn" | "error" | "debug"
  source: string
  message: string
}

// WebSocket events pushed from agent → client
export type WsEvent =
  | { type: "metrics"; data: SystemMetrics }
  | { type: "status"; data: ClawStatus }
  | { type: "heartbeat"; data: Heartbeat }
  | { type: "log"; data: LogLine }
  | { type: "model.pull.progress"; data: { id: string; progress: number } }
  | { type: "conversation.update"; data: Conversation }
  | { type: "project.update"; data: Project }
  | { type: "hello"; data: { bridgeVersion: string; serverTime: string } }

export interface PushSubscriptionInfo {
  endpoint: string
  keys: { p256dh: string; auth: string }
  ua?: string
  createdAt: string
}
